import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const contentRoot = new URL('../src/content/', import.meta.url);
const manifestUrl = new URL('../src/data/image-dimensions.json', import.meta.url);
const imagePattern = /https:\/\/img\.mockingbird\.team\/[^\s)\]"'<>]+/g;

const filesIn = async (directory) => {
  const entries = await readdir(directory);
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry);
    const details = await stat(path);
    if (details.isDirectory()) files.push(...(await filesIn(path)));
    else if (/\.(?:md|mdx)$/i.test(entry)) files.push(path);
  }
  return files;
};

const contentFiles = await filesIn(fileURLToPath(contentRoot));
const sources = new Set();
for (const file of contentFiles) {
  const content = await readFile(file, 'utf8');
  const searchableContent = content.replace(/^#\s*image:\s*.*$/gim, '');
  for (const match of searchableContent.matchAll(imagePattern)) {
    const url = new URL(match[0]);
    if (!url.pathname.startsWith('/cdn-cgi/image/')) sources.add(url.href);
  }
}

let dimensions = {};
try {
  dimensions = JSON.parse(await readFile(manifestUrl, 'utf8'));
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}

const waiting = [...sources].filter((source) => !dimensions[source]);
let completed = 0;
let failed = 0;

const probe = async (source) => {
  const url = new URL(source);
  const probeUrl = `${url.origin}/cdn-cgi/image/width=64,fit=scale-down,quality=60,format=webp${url.pathname}${url.search}`;
  const response = await fetch(probeUrl);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  const metadata = await sharp(Buffer.from(await response.arrayBuffer())).metadata();
  if (!metadata.width || !metadata.height) throw new Error('Image dimensions were not returned.');
  dimensions[source] = { width: metadata.width, height: metadata.height };
  completed += 1;
  process.stdout.write(`\rMeasured ${completed + failed}/${waiting.length}`);
};

const queue = [...waiting];
const worker = async () => {
  while (queue.length > 0) {
    const source = queue.shift();
    try {
      await probe(source);
    } catch (error) {
      failed += 1;
      process.stderr.write(
        `\nSkipped ${source}: ${error instanceof Error ? error.message : error}`,
      );
    }
  }
};

await Promise.all(Array.from({ length: Math.min(8, waiting.length) }, worker));

dimensions = Object.fromEntries(
  Object.entries(dimensions)
    .filter(([source]) => sources.has(source))
    .sort(([a], [b]) => a.localeCompare(b)),
);
await writeFile(manifestUrl, `${JSON.stringify(dimensions, null, 2)}\n`);

process.stdout.write(
  `\nStored ${Object.keys(dimensions).length} image ratios in ${fileURLToPath(manifestUrl).replace(projectRoot, '')}.`,
);
if (failed > 0) process.stdout.write(` ${failed} image(s) remain unresolved.`);
process.stdout.write('\n');
