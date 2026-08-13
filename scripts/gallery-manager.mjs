import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, readdir, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { homedir, platform } from 'node:os';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import exifr from 'exifr';
import sharp from 'sharp';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const cacheRoot = join(root, '.gallery-cache');
const sourceRoot = join(cacheRoot, 'source');
const exportDatabase = join(cacheRoot, 'osxphotos.db');
const manifestPath = join(root, 'src/data/gallery.json');
const adminPath = join(root, 'tools/gallery-admin/index.html');
const watermarkPath = join(root, 'public/pictures/watermark.png');
const picgoConfigPath = join(homedir(), 'Library/Application Support/picgo/data.json');
const osxphotosPath = join(homedir(), '.local/bin/osxphotos');
const photosLibraryPath =
  process.env.PHOTOS_LIBRARY || join(homedir(), 'Pictures/Photos Library.photoslibrary');
const publicImageOrigin = 'https://img.mockingbird.team';
const port = Number.parseInt(process.env.GALLERY_PORT || '4177', 10);
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

const job = {
  running: false,
  phase: 'idle',
  current: 0,
  total: 0,
  message: 'Ready.',
  logs: [],
  errors: [],
  imported: 0,
};

const log = (message) => {
  const line = `${new Date().toLocaleTimeString('en-GB')}  ${message}`;
  job.logs.push(line);
  if (job.logs.length > 160) job.logs.splice(0, job.logs.length - 160);
  job.message = message;
  process.stdout.write(`${line}\n`);
};

const jsonResponse = (response, status, payload) => {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(JSON.stringify(payload));
};

const readJsonBody = async (request) => {
  const chunks = [];
  let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length > 64 * 1024) throw new Error('Request is too large.');
    chunks.push(chunk);
  }
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
};

const pathExists = async (path) => {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
};

const loadManifest = async () => {
  try {
    const parsed = JSON.parse(await readFile(manifestPath, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
};

let manifestWrite = Promise.resolve();
const saveManifest = (photos) => {
  manifestWrite = manifestWrite.then(async () => {
    const sorted = [...photos].sort((a, b) => (b.takenAt || '').localeCompare(a.takenAt || ''));
    const temporary = `${manifestPath}.tmp`;
    await writeFile(temporary, `${JSON.stringify(sorted, null, 2)}\n`);
    await rename(temporary, manifestPath);
  });
  return manifestWrite;
};

const loadR2Config = async () => {
  const picgo = JSON.parse(await readFile(picgoConfigPath, 'utf8'));
  const config = picgo?.picBed?.['aws-s3'];
  if (
    !config?.endpoint ||
    !config?.bucketName ||
    !config?.accessKeyID ||
    !config?.secretAccessKey
  ) {
    throw new Error('The PicGo R2 configuration is incomplete.');
  }
  return {
    endpoint: config.endpoint,
    bucket: config.bucketName,
    accessKeyId: config.accessKeyID,
    secretAccessKey: config.secretAccessKey,
    forcePathStyle: Boolean(config.pathStyleAccess),
  };
};

const s3For = (config) =>
  new S3Client({
    region: 'auto',
    endpoint: config.endpoint,
    forcePathStyle: config.forcePathStyle,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

const walk = async (directory) => {
  if (!(await pathExists(directory))) return [];
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

const cleanCamera = (make, model) => {
  const maker = typeof make === 'string' ? make.trim() : '';
  const camera = typeof model === 'string' ? model.trim() : '';
  if (!maker) return camera || undefined;
  if (!camera) return maker;
  return camera.toLowerCase().startsWith(maker.toLowerCase()) ? camera : `${maker} ${camera}`;
};

const formatShutter = (value) => {
  if (!Number.isFinite(value) || value <= 0) return undefined;
  if (value >= 1) return `${Number(value.toFixed(1))} s`;
  return `1/${Math.max(1, Math.round(1 / value))} s`;
};

const formatSigned = (value) => {
  if (!Number.isFinite(value)) return undefined;
  if (value === 0) return '0 EV';
  return `${value > 0 ? '+' : '−'}${Math.abs(Number(value.toFixed(1)))} EV`;
};

const technicalMetadata = async (path) => {
  const metadata = await exifr
    .parse(path, {
      pick: [
        'Make',
        'Model',
        'LensModel',
        'Lens',
        'FocalLength',
        'FNumber',
        'ExposureTime',
        'ISO',
        'ExposureCompensation',
        'DateTimeOriginal',
        'CreateDate',
        'OffsetTimeOriginal',
      ],
      reviveValues: true,
      translateValues: false,
    })
    .catch(() => ({}));

  const date = metadata?.DateTimeOriginal || metadata?.CreateDate;
  return {
    takenAt: date instanceof Date && !Number.isNaN(date.getTime()) ? date.toISOString() : undefined,
    exif: {
      camera: cleanCamera(metadata?.Make, metadata?.Model),
      lens: metadata?.LensModel || metadata?.Lens || undefined,
      focalLength: Number.isFinite(metadata?.FocalLength)
        ? `${Number(metadata.FocalLength.toFixed(1))} mm`
        : undefined,
      aperture: Number.isFinite(metadata?.FNumber)
        ? `f/${Number(metadata.FNumber.toFixed(1))}`
        : undefined,
      shutter: formatShutter(metadata?.ExposureTime),
      iso: Number.isFinite(metadata?.ISO) ? Math.round(metadata.ISO) : undefined,
      exposureCompensation: formatSigned(metadata?.ExposureCompensation),
    },
  };
};

const removeEmpty = (value) =>
  Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== ''));

const watermarkBuffer = async (width, scale, opacity) => {
  const resized = await sharp(watermarkPath)
    .resize({ width: Math.max(24, Math.round(width * scale)), withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (opacity >= 0.999) return sharp(resized.data, { raw: resized.info }).png().toBuffer();
  for (let index = 3; index < resized.data.length; index += 4) {
    resized.data[index] = Math.round(resized.data[index] * opacity);
  }
  return sharp(resized.data, { raw: resized.info }).png().toBuffer();
};

const makeDerivatives = async (path, options) => {
  const displayBase = await sharp(path, { failOn: 'none' })
    .rotate()
    .resize({ width: 2560, height: 2560, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 88, effort: 5 })
    .toBuffer();
  const displayInfo = await sharp(displayBase).metadata();
  let display = displayBase;

  if (options.watermark && displayInfo.width && displayInfo.height) {
    const mark = await watermarkBuffer(
      displayInfo.width,
      options.watermarkScale,
      options.watermarkOpacity,
    );
    const markInfo = await sharp(mark).metadata();
    const margin = Math.max(18, Math.round(displayInfo.width * 0.018));
    display = await sharp(displayBase)
      .composite([
        {
          input: mark,
          left: Math.max(0, displayInfo.width - (markInfo.width || 0) - margin),
          top: Math.max(0, displayInfo.height - (markInfo.height || 0) - margin),
        },
      ])
      .webp({ quality: 88, effort: 5 })
      .toBuffer();
  }

  const thumb = await sharp(path, { failOn: 'none' })
    .rotate()
    .resize({ width: 720, height: 720, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82, effort: 5 })
    .toBuffer();
  const finalInfo = await sharp(display).metadata();
  return {
    display,
    thumb,
    width: finalInfo.width,
    height: finalInfo.height,
  };
};

const putIfMissing = async (client, bucket, key, body) => {
  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return 'existing';
  } catch (error) {
    const status = error?.$metadata?.httpStatusCode;
    if (status && status !== 404) throw error;
  }
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: 'image/webp',
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  );
  return 'uploaded';
};

const runCommand = (command, args) =>
  new Promise((resolveCommand, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      const text = chunk.toString().trim();
      if (text) log(text.split('\n').at(-1));
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolveCommand();
      else if (stderr.includes('PermissionError') || stderr.includes('Operation not permitted')) {
        reject(
          new Error(
            'macOS denied access to Photos. Enable Full Disk Access for Terminal in System Settings → Privacy & Security, then restart the manager.',
          ),
        );
      } else {
        reject(
          new Error(
            stderr.trim().split('\n').at(-1) || `${basename(command)} exited with code ${code}.`,
          ),
        );
      }
    });
  });

const exportFromPhotos = async (album) => {
  await mkdir(sourceRoot, { recursive: true });
  await runCommand(osxphotosPath, [
    'export',
    '--library',
    photosLibraryPath,
    sourceRoot,
    '--album',
    album,
    '--skip-edited',
    '--skip-live',
    '--sidecar',
    'json',
    '--update',
    '--only-new',
    '--exportdb',
    exportDatabase,
    '--verbose',
  ]);
};

const sidecarFor = async (path) => {
  const candidates = [`${path}.json`, join(dirname(path), `${basename(path, extname(path))}.json`)];
  for (const candidate of candidates) {
    if (await pathExists(candidate)) return candidate;
  }
  return undefined;
};

const removeExportCopy = async (path) => {
  await unlink(path).catch(() => undefined);
  const sidecar = await sidecarFor(path);
  if (sidecar) await unlink(sidecar).catch(() => undefined);
};

const processPhoto = async (path, options, r2, client, manifest, manifestIds) => {
  const hash = await hashFile(path);
  const id = hash.slice(0, 24);
  if (manifestIds.has(id)) {
    await removeExportCopy(path);
    return { status: 'skipped', id };
  }

  const technical = await technicalMetadata(path);
  const derivatives = await makeDerivatives(path, options);
  if (!derivatives.width || !derivatives.height)
    throw new Error('Could not determine output dimensions.');
  const date = technical.takenAt ? new Date(technical.takenAt) : new Date();
  const prefix = `gallery/${date.getUTCFullYear()}/${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  const displayKey = `${prefix}/display/${id}${options.watermark ? '-wm' : ''}.webp`;
  const thumbKey = `${prefix}/thumb/${id}.webp`;

  await Promise.all([
    putIfMissing(client, r2.bucket, displayKey, derivatives.display),
    putIfMissing(client, r2.bucket, thumbKey, derivatives.thumb),
  ]);

  const entry = {
    id,
    src: `${publicImageOrigin}/${displayKey}`,
    thumb: `${publicImageOrigin}/${thumbKey}`,
    width: derivatives.width,
    height: derivatives.height,
    ...(technical.takenAt ? { takenAt: technical.takenAt } : {}),
    caption: { zh: '', en: '' },
    location: { zh: '', en: '' },
    tags: [],
    exif: removeEmpty(technical.exif),
    watermarked: options.watermark,
    draft: false,
  };

  manifest.push(entry);
  manifestIds.add(id);
  await saveManifest(manifest);
  await removeExportCopy(path);
  return { status: 'imported', id };
};

const runSync = async (rawOptions) => {
  const options = {
    album: String(rawOptions.album || 'Website Gallery').trim() || 'Website Gallery',
    watermark: Boolean(rawOptions.watermark),
    watermarkScale: Math.min(0.2, Math.max(0.03, Number(rawOptions.watermarkScale) || 0.065)),
    watermarkOpacity: Math.min(1, Math.max(0.1, Number(rawOptions.watermarkOpacity) || 1)),
  };

  Object.assign(job, {
    running: true,
    phase: 'exporting',
    current: 0,
    total: 0,
    imported: 0,
    errors: [],
    logs: [],
  });

  try {
    log(`Reading new originals from Photos album “${options.album}”…`);
    await exportFromPhotos(options.album);
    const files = (await walk(sourceRoot)).filter((path) =>
      supportedExtensions.has(extname(path).toLowerCase()),
    );
    job.phase = 'uploading';
    job.total = files.length;
    if (files.length === 0) {
      log('No new supported photos are waiting for upload.');
      job.phase = 'complete';
      return;
    }

    const r2 = await loadR2Config();
    const client = s3For(r2);
    const manifest = await loadManifest();
    const manifestIds = new Set(manifest.map((photo) => photo.id));
    let cursor = 0;

    const worker = async () => {
      while (cursor < files.length) {
        const index = cursor;
        cursor += 1;
        const path = files[index];
        log(`[${index + 1}/${files.length}] ${basename(path)}`);
        try {
          const result = await processPhoto(path, options, r2, client, manifest, manifestIds);
          if (result.status === 'imported') job.imported += 1;
        } catch (error) {
          const message = `${basename(path)} — ${error instanceof Error ? error.message : String(error)}`;
          job.errors.push(message);
          log(`FAILED: ${message}`);
        } finally {
          job.current += 1;
        }
      }
    };

    await Promise.all([worker(), worker()]);
    await manifestWrite;
    job.phase = job.errors.length > 0 ? 'complete-with-errors' : 'complete';
    log(`Finished. ${job.imported} new photograph${job.imported === 1 ? '' : 's'} added.`);
  } catch (error) {
    job.phase = 'failed';
    job.errors.push(error instanceof Error ? error.message : String(error));
    log(`FAILED: ${job.errors.at(-1)}`);
  } finally {
    job.running = false;
  }
};

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || '/', `http://127.0.0.1:${port}`);
    if (request.method === 'GET' && url.pathname === '/') {
      response.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      });
      response.end(await readFile(adminPath));
      return;
    }
    if (request.method === 'GET' && url.pathname === '/api/status') {
      const [photos, hasOsxphotos, hasR2, hasPhotosLibrary] = await Promise.all([
        loadManifest(),
        pathExists(osxphotosPath),
        pathExists(picgoConfigPath),
        pathExists(photosLibraryPath),
      ]);
      jsonResponse(response, 200, {
        hasOsxphotos,
        hasR2,
        hasPhotosLibrary,
        photoCount: photos.length,
        job,
      });
      return;
    }
    if (request.method === 'GET' && url.pathname === '/api/job') {
      jsonResponse(response, 200, job);
      return;
    }
    if (request.method === 'POST' && url.pathname === '/api/sync') {
      if (job.running) {
        jsonResponse(response, 409, { message: 'A Gallery sync is already running.' });
        return;
      }
      const options = await readJsonBody(request);
      void runSync(options);
      jsonResponse(response, 202, { started: true });
      return;
    }
    jsonResponse(response, 404, { message: 'Not found.' });
  } catch (error) {
    jsonResponse(response, 500, {
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

await mkdir(cacheRoot, { recursive: true });
server.listen(port, '127.0.0.1', () => {
  const url = `http://127.0.0.1:${port}`;
  process.stdout.write(`Gallery Manager is running at ${url}\n`);
  if (process.env.GALLERY_NO_OPEN === '1') return;
  const command = platform() === 'darwin' ? 'open' : platform() === 'win32' ? 'cmd' : 'xdg-open';
  const args = platform() === 'win32' ? ['/c', 'start', '', url] : [url];
  const opener = spawn(command, args, { detached: true, stdio: 'ignore' });
  opener.unref();
});
