import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, extname, join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { coordinatesFor, createLocationResolver } from './gallery-location-utils.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const cacheRoot = join(root, '.gallery-cache');
const manifestPath = join(root, 'src/data/gallery.json');
const locationCachePath = join(cacheRoot, 'geocoding.json');
const osxphotosPath = join(homedir(), '.local/bin/osxphotos');
const photosLibraryPath =
  process.env.PHOTOS_LIBRARY || join(homedir(), 'Pictures/Photos Library.photoslibrary');
const album = process.env.GALLERY_PHOTOS_ALBUM || 'Website Gallery';
const supportedExtensions = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.heic',
  '.heif',
  '.tif',
  '.tiff',
  '.webp',
  '.avif',
]);

if (process.platform !== 'darwin') {
  throw new Error('Gallery location backfill from Apple Photos must run on macOS.');
}

const log = (message) => process.stdout.write(`${message}\n`);

const runCommand = (command, args) =>
  new Promise((resolveCommand, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: 'inherit' });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolveCommand();
      else reject(new Error(`${basename(command)} exited with code ${code}.`));
    });
  });

const walk = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? walk(path) : [path];
    }),
  );
  return nested.flat();
};

const hashFile = (path) =>
  new Promise((resolveHash, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(path);
    stream.on('error', reject);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolveHash(hash.digest('hex')));
  });

const saveManifest = async (photos) => {
  const temporary = `${manifestPath}.tmp`;
  await writeFile(temporary, `${JSON.stringify(photos, null, 2)}\n`);
  await rename(temporary, manifestPath);
};

await mkdir(cacheRoot, { recursive: true });
const exportRoot = await mkdtemp(join(cacheRoot, 'location-backfill-'));
try {
  log(`Exporting originals from Photos album “${album}” for metadata matching…`);
  await runCommand(osxphotosPath, [
    'export',
    '--library',
    photosLibraryPath,
    exportRoot,
    '--album',
    album,
    '--skip-edited',
    '--skip-live',
    '--sidecar',
    'json',
    '--verbose',
  ]);

  const photos = JSON.parse(await readFile(manifestPath, 'utf8'));
  const pending = new Map(photos.map((photo) => [photo.id, photo]));
  const files = (await walk(exportRoot)).filter((path) =>
    supportedExtensions.has(extname(path).toLowerCase()),
  );
  const resolveLocation = await createLocationResolver({ cachePath: locationCachePath, log });
  let matched = 0;
  let updated = 0;

  for (const [index, path] of files.entries()) {
    const id = (await hashFile(path)).slice(0, 24);
    const photo = pending.get(id);
    if (!photo) continue;
    matched += 1;
    const coordinates = await coordinatesFor(path);
    if (!coordinates) {
      log(`[${index + 1}/${files.length}] ${basename(path)} has no GPS coordinates.`);
      continue;
    }
    try {
      const place = await resolveLocation(coordinates);
      if (!place) continue;
      photo.location = { ...(photo.location || {}), en: place };
      updated += 1;
      await saveManifest(photos);
      log(`[${index + 1}/${files.length}] ${basename(path)} → ${place}`);
    } catch (error) {
      log(`[${index + 1}/${files.length}] ${basename(path)} — ${error.message}`);
    }
  }

  log(`Finished. ${matched} existing records matched; ${updated} locations updated.`);
} finally {
  await rm(exportRoot, { recursive: true, force: true });
}
