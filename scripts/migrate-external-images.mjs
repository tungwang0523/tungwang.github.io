import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const postsRoot = join(root, 'src/content/posts');
const cacheRoot = join(root, '.gallery-cache');
const mappingPath = join(cacheRoot, 'external-image-migration.json');
const configPaths = [join(root, 'gallery-r2-config.json'), join(cacheRoot, 'r2.json')];
const publicOrigin = (process.env.GALLERY_PUBLIC_ORIGIN || 'https://img.mockingbird.team').replace(
  /\/$/,
  '',
);
const ownHost = new URL(publicOrigin).host;
const concurrency = Math.max(1, Number.parseInt(process.env.MIGRATION_CONCURRENCY || '3', 10));
const urlPattern = /https?:\/\/[^\s)\]>'"]+/gi;
const markdownImagePattern = /!\[[^\]]*\]\(([^)]+)\)/gi;
const htmlImagePattern = /<img\b[^>]*?\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi;
const frontmatterImagePattern = /^(?:cover|image):\s*["']?(https?:\/\/[^\s"']+)/gim;

const contentTypeExtensions = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
  ['image/avif', '.avif'],
  ['image/gif', '.gif'],
  ['image/svg+xml', '.svg'],
  ['image/tiff', '.tiff'],
  ['image/heic', '.heic'],
  ['image/heif', '.heif'],
]);

const readJson = async (path, fallback = {}) => {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') return fallback;
    throw error;
  }
};

const loadR2Config = async () => {
  for (const path of configPaths) {
    if (!existsSync(path)) continue;
    const local = await readJson(path);
    const picgo = local?.picBed?.['aws-s3'];
    const config = picgo
      ? {
          endpoint: picgo.endpoint,
          bucket: picgo.bucketName,
          accessKeyId: picgo.accessKeyID,
          secretAccessKey: picgo.secretAccessKey,
          forcePathStyle: Boolean(picgo.pathStyleAccess),
        }
      : local;
    if (config.endpoint && config.bucket && config.accessKeyId && config.secretAccessKey) {
      return config;
    }
  }
  throw new Error('R2 configuration was not found.');
};

const imageUrlsIn = (text) => {
  const urls = [];
  for (const pattern of [markdownImagePattern, htmlImagePattern, frontmatterImagePattern]) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(text))) {
      const value = match[1].trim().replace(/\s+["'][^"']*["']$/, '');
      const url = value.match(urlPattern)?.[0];
      if (url) urls.push(url);
    }
  }
  return urls;
};

const originalWikimediaUrl = (url) => {
  const parsed = new URL(url);
  const match = parsed.pathname.match(/^\/wikipedia\/commons\/thumb\/(.+\/([^/]+))\/[^/]+$/);
  if (!match) return undefined;
  parsed.pathname = `/wikipedia/commons/${match[1]}`;
  return parsed.toString();
};

const candidatesFor = (url) => {
  const candidates = [url];
  if (url.startsWith('http://')) candidates.push(`https://${url.slice('http://'.length)}`);
  if (new URL(url).host === 'upload.wikimedia.org') {
    const original = originalWikimediaUrl(url);
    if (original) candidates.push(original);
  }
  return [...new Set(candidates)];
};

const download = async (url) => {
  let lastError;
  for (const candidate of candidatesFor(url)) {
    try {
      const response = await fetch(candidate, {
        redirect: 'follow',
        signal: AbortSignal.timeout(30_000),
        headers: {
          Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
          Referer: new URL(candidate).host.endsWith('zhimg.com')
            ? 'https://www.zhihu.com/'
            : new URL(candidate).origin,
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/140 Safari/537.36',
        },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const contentType = response.headers.get('content-type')?.split(';')[0].toLowerCase() || '';
      if (!contentType.startsWith('image/')) throw new Error(`unexpected ${contentType || 'content'}`);
      const body = Buffer.from(await response.arrayBuffer());
      if (!body.length) throw new Error('empty response');
      return { body, contentType, finalUrl: response.url };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
};

const extensionFor = (url, contentType) => {
  const known = contentTypeExtensions.get(contentType);
  if (known) return known;
  const suffix = extname(new URL(url).pathname).toLowerCase();
  return /^\.(?:jpe?g|png|webp|avif|gif|svg|tiff?|heic|heif)$/.test(suffix) ? suffix : '.bin';
};

const files = await Promise.all(
  (await readdir(postsRoot))
    .filter((name) => /\.(?:md|mdx)$/.test(name))
    .sort()
    .map(async (name) => ({
      name,
      path: join(postsRoot, name),
      text: await readFile(join(postsRoot, name), 'utf8'),
    })),
);

const urls = [
  ...new Set(
    files
      .flatMap(({ text }) => imageUrlsIn(text))
      .filter((url) => {
        try {
          return new URL(url).host !== ownHost;
        } catch {
          return false;
        }
      }),
  ),
];

if (!urls.length) {
  console.log('No external post images are waiting for migration.');
  process.exit(0);
}

await mkdir(cacheRoot, { recursive: true });
const mapping = await readJson(mappingPath);
const config = await loadR2Config();
const client = new S3Client({
  region: 'auto',
  endpoint: config.endpoint,
  forcePathStyle: Boolean(config.forcePathStyle),
  credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
});
let cursor = 0;
let succeeded = 0;
const failed = [];
let mappingWrite = Promise.resolve();
const saveMapping = () => {
  mappingWrite = mappingWrite.then(() =>
    writeFile(mappingPath, `${JSON.stringify(mapping, null, 2)}\n`),
  );
  return mappingWrite;
};

const worker = async () => {
  while (cursor < urls.length) {
    const index = cursor++;
    const url = urls[index];
    if (mapping[url]) {
      console.log(`[${index + 1}/${urls.length}] cached ${url}`);
      continue;
    }
    try {
      const downloaded = await download(url);
      const hash = createHash('sha256').update(downloaded.body).digest('hex');
      const extension = extensionFor(downloaded.finalUrl, downloaded.contentType);
      const key = `blog/external/${hash}${extension}`;
      await client.send(
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: key,
          Body: downloaded.body,
          ContentType: downloaded.contentType,
          CacheControl: 'public, max-age=31536000, immutable',
        }),
      );
      mapping[url] = `${publicOrigin}/${key}`;
      succeeded += 1;
      console.log(`[${index + 1}/${urls.length}] uploaded ${url}`);
      await saveMapping();
    } catch (error) {
      failed.push({ url, error: error instanceof Error ? error.message : String(error) });
      console.error(`[${index + 1}/${urls.length}] skipped ${url}: ${failed.at(-1).error}`);
    }
  }
};

await Promise.all(Array.from({ length: Math.min(concurrency, urls.length) }, () => worker()));

let replacements = 0;
for (const file of files) {
  let next = file.text;
  for (const [oldUrl, newUrl] of Object.entries(mapping)) {
    const count = next.split(oldUrl).length - 1;
    if (count > 0) {
      next = next.replaceAll(oldUrl, newUrl);
      replacements += count;
    }
  }
  if (next !== file.text) await writeFile(file.path, next);
}

console.log(`Migrated ${succeeded} new image(s); replaced ${replacements} reference(s).`);
if (failed.length) {
  console.log(`Left ${failed.length} inaccessible image(s) unchanged.`);
  for (const item of failed) console.log(`- ${item.url} (${item.error})`);
}
