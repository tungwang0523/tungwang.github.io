const IMAGE_HOST = 'img.mockingbird.team';

export const isCloudflareImage = (source) => {
  if (typeof source !== 'string' || source.length === 0) return false;

  try {
    const url = new URL(source);
    return url.hostname === IMAGE_HOST && !url.pathname.startsWith('/cdn-cgi/image/');
  } catch {
    return false;
  }
};

export const cloudflareImage = (source, options = {}) => {
  if (!isCloudflareImage(source)) return source;

  const url = new URL(source);
  const parameters = [];
  const orderedKeys = ['width', 'height', 'fit', 'quality', 'format', 'dpr', 'anim'];

  for (const key of orderedKeys) {
    const value = options[key];
    if (value === undefined || value === null || value === '') continue;
    parameters.push(`${key}=${value}`);
  }

  if (parameters.length === 0) return source;

  return `${url.origin}/cdn-cgi/image/${parameters.join(',')}${url.pathname}${url.search}`;
};

export const cloudflareSrcset = (source, widths, options = {}) => {
  if (!isCloudflareImage(source)) return undefined;

  return widths
    .map((width) => `${cloudflareImage(source, { ...options, width })} ${width}w`)
    .join(', ');
};

export const imagePresets = {
  article: {
    srcWidth: 480,
    widths: [320, 480, 960],
    sizes: '(max-width: 560px) calc(100vw - 40px), 480px',
    quality: 85,
  },
  lightbox: {
    width: 1920,
    quality: 85,
  },
  lightboxMobile: {
    width: 1280,
    quality: 85,
  },
  microblogGrid: {
    width: 320,
    height: 320,
    quality: 82,
  },
  listing: {
    widths: [320, 640, 960],
    sizes: '(max-width: 560px) calc(100vw - 40px), 220px',
    quality: 82,
  },
  hero: {
    widths: [640, 960, 1440, 1920],
    sizes: '(max-width: 920px) calc(100vw - 40px), 856px',
    quality: 85,
  },
};
