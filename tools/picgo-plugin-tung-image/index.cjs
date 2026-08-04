const { readFile } = require('node:fs/promises');
const { basename, extname, resolve } = require('node:path');

const pluginName = 'picgo-plugin-tung-image';
const defaultWatermark =
  '/Users/tungwang/Library/CloudStorage/OneDrive-Personal/Library/Websites/Tung Wang/public/pictures/watermark.png';
let imageProcessor;

function getImageProcessor() {
  imageProcessor ||= require('sharp');
  return imageProcessor;
}

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const toNumber = (value, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const toBoolean = (value, fallback) => {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return fallback;
};

async function sourceBuffer(image) {
  if (Buffer.isBuffer(image.buffer)) return image.buffer;

  if (typeof image.base64Image === 'string') {
    const base64 = image.base64Image.replace(/^data:[^;]+;base64,/, '');
    return Buffer.from(base64, 'base64');
  }

  if (image.fileName) return readFile(image.fileName);

  throw new Error('PicGo did not provide a readable image buffer.');
}

async function processImage(image, config) {
  const sharp = getImageProcessor();
  const input = await sourceBuffer(image);
  const resized = await sharp(input)
    .rotate()
    .resize({
      width: config.maxEdge,
      height: config.maxEdge,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .png()
    .toBuffer();

  const base = sharp(resized);
  const metadata = await base.metadata();
  const width = metadata.width;
  const height = metadata.height;

  if (!width || !height) throw new Error('Could not determine processed image dimensions.');

  const watermark = await sharp(config.watermarkPath)
    .ensureAlpha()
    .resize({ width: Math.max(1, Math.round(width * config.watermarkScale)), withoutEnlargement: true })
    .linear([1, 1, 1, config.opacity], [0, 0, 0, 0])
    .png()
    .toBuffer();
  const watermarkMeta = await sharp(watermark).metadata();
  const watermarkWidth = watermarkMeta.width ?? 0;
  const watermarkHeight = watermarkMeta.height ?? 0;

  const output = await base
    .composite([
      {
        input: watermark,
        left: Math.max(0, width - watermarkWidth - config.margin),
        top: Math.max(0, height - watermarkHeight - config.margin),
      },
    ])
    .webp({
      lossless: config.lossless,
      quality: config.quality,
      effort: 6,
      smartSubsample: false,
    })
    .toBuffer();

  const originalName = image.fileName || 'image';
  const fileName = `${basename(originalName, extname(originalName))}.webp`;

  const processed = {
    ...image,
    buffer: output,
    fileName,
    extname: '.webp',
  };

  // picgo-plugin-s3 prefers base64Image over buffer and then writes an
  // incorrect `Content-Encoding: base64` metadata value to R2. Keeping only
  // the binary buffer produces a normal `image/webp` object instead.
  delete processed.base64Image;
  return processed;
}

function getSettings(ctx) {
  const settings = ctx.getConfig(pluginName) || {};
  const requestedWatermarkScale = toNumber(settings.watermarkScale, 0.06);
  const watermarkScale = clamp(
    requestedWatermarkScale > 0.1 ? 0.06 : requestedWatermarkScale,
    0.01,
    0.1,
  );
  const transparency =
    settings.transparency !== undefined
      ? toNumber(settings.transparency, 0)
      : settings.opacity !== undefined
        ? 1 - toNumber(settings.opacity, 1)
        : 0;

  return {
    maxEdge: Math.round(clamp(toNumber(settings.maxEdge, 2560), 320, 8192)),
    quality: Math.round(clamp(toNumber(settings.quality, 88), 1, 100)),
    lossless: toBoolean(settings.lossless, false),
    watermarkPath: resolve(settings.watermarkPath || defaultWatermark),
    // The square site mark needs less area than the former wide watermark.
    watermarkScale,
    opacity: 1 - clamp(transparency, 0, 1),
    transparency: clamp(transparency, 0, 1),
    margin: Math.round(clamp(toNumber(settings.margin, 64), 64, 512)),
  };
}

function config(ctx) {
  const settings = getSettings(ctx);
  return [
    { name: 'maxEdge', type: 'input', default: settings.maxEdge, message: 'Longest image edge in pixels (2560 recommended)' },
    { name: 'quality', type: 'input', default: settings.quality, message: 'WebP quality, 1 to 100' },
    { name: 'lossless', type: 'confirm', default: settings.lossless, message: 'Use lossless WebP' },
    { name: 'watermarkPath', type: 'input', default: settings.watermarkPath, message: 'Absolute watermark PNG path' },
    { name: 'watermarkScale', type: 'input', default: settings.watermarkScale, message: 'Watermark width as a fraction of image width' },
    { name: 'transparency', type: 'input', default: settings.transparency, message: 'Watermark transparency, 0 to 1 (0 is opaque)' },
    { name: 'margin', type: 'input', default: settings.margin, message: 'Right and bottom margin in pixels' },
  ];
}

module.exports = (ctx) => ({
  register: () => {
    ctx.helper.beforeUploadPlugins.register(pluginName, {
      handle: async (picgo) => {
        const settings = getSettings(picgo);
        picgo.output = await Promise.all(picgo.output.map((image) => processImage(image, settings)));
        return picgo.output;
      },
    });
  },
  config,
});
