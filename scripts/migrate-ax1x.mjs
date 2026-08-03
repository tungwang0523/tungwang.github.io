import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { PicGo } = require('/Users/tungwang/Library/Application Support/picgo/node_modules/picgo');

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const postsDir = join(root, 'src/content/posts');
const configPath = process.env.PICGO_CONFIG || join(homedir(), 'Library/Application Support/picgo/data.json');
const mapPath = join('/tmp', 'tung-ax1x-migration-map.json');
const urlPattern = /https?:\/\/(?:[a-z0-9-]+\.)*ax1x\.com\/[^\s)\]>'"]+/gi;
const retryCount = 3;

const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));

async function postFiles() {
  const names = (await readdir(postsDir)).filter((name) => name.endsWith('.md')).sort();
  return Promise.all(names.map(async (name) => ({
    name,
    path: join(postsDir, name),
    text: await readFile(join(postsDir, name), 'utf8'),
  })));
}

async function existingMapping() {
  try {
    const saved = JSON.parse(await readFile(mapPath, 'utf8'));
    return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
  } catch (error) {
    if (error?.code === 'ENOENT' || error instanceof SyntaxError) return {};
    throw error;
  }
}

function collectUrls(files) {
  return [...new Set(files.flatMap(({ text }) => text.match(urlPattern) || []))];
}

async function uploadWithRetry(picgo, oldUrl) {
  let lastError;
  for (let attempt = 1; attempt <= retryCount; attempt += 1) {
    try {
      const [result] = await picgo.upload([oldUrl]);
      const newUrl = result?.imgUrl || result?.url;
      if (!newUrl || result?.error) {
        throw new Error(result?.error?.message || 'PicGo returned no uploaded URL.');
      }
      return newUrl;
    } catch (error) {
      lastError = error;
      if (attempt < retryCount) await sleep(1500 * attempt);
    }
  }
  throw lastError;
}

const files = await postFiles();
const oldUrls = collectUrls(files);
if (oldUrls.length === 0) {
  console.log('No ax1x.com image URLs found in src/content/posts.');
  process.exit(0);
}

console.log(`Found ${oldUrls.length} unique old image URLs in ${files.length} blog posts.`);
const picgo = new PicGo(configPath);
const mapping = await existingMapping();
const failedUrls = [];
const cachedCount = oldUrls.filter((url) => mapping[url]).length;
if (cachedCount > 0) console.log(`Resuming with ${cachedCount} previously uploaded images.`);

for (const [index, oldUrl] of oldUrls.entries()) {
  process.stdout.write(`[${index + 1}/${oldUrls.length}] ${oldUrl} ... `);
  if (mapping[oldUrl]) {
    console.log(`${mapping[oldUrl]} (cached)`);
    continue;
  }

  try {
    mapping[oldUrl] = await uploadWithRetry(picgo, oldUrl);
    console.log(mapping[oldUrl]);
    await writeFile(mapPath, JSON.stringify(mapping, null, 2) + '\n');
  } catch (error) {
    failedUrls.push(oldUrl);
    console.error(`FAILED: ${error instanceof Error ? error.message : String(error)}`);
  }
}

let replacements = 0;
for (const file of files) {
  let nextText = file.text;
  for (const [oldUrl, newUrl] of Object.entries(mapping)) {
    const matches = nextText.split(oldUrl).length - 1;
    if (matches > 0) {
      replacements += matches;
      nextText = nextText.replaceAll(oldUrl, newUrl);
    }
  }
  if (nextText !== file.text) await writeFile(file.path, nextText);
}

console.log(`Replaced ${replacements} image references.`);
console.log(`Mapping saved to ${mapPath}.`);
if (failedUrls.length > 0) {
  console.error(`Could not migrate ${failedUrls.length} image(s):`);
  failedUrls.forEach((url) => console.error(`- ${url}`));
  process.exitCode = 1;
}
