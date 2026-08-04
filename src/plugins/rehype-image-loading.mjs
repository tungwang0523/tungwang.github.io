import {
  cloudflareImage,
  cloudflareSrcset,
  imagePresets,
  isCloudflareImage,
} from '../utils/cloudflare-image.mjs';

const visitImages = (node) => {
  if (!node || typeof node !== 'object') return;

  if (node.type === 'element' && node.tagName === 'img') {
    node.properties ??= {};
    node.properties.loading ??= 'lazy';
    node.properties.decoding ??= 'async';

    const source = node.properties.src;
    if (typeof source === 'string' && isCloudflareImage(source)) {
      const { srcWidth, widths, sizes, quality } = imagePresets.article;
      node.properties.dataOriginalSrc = source;
      node.properties.dataLightboxSrc = cloudflareImage(source, {
        ...imagePresets.lightbox,
        fit: 'scale-down',
        format: 'auto',
      });
      node.properties.dataLightboxMobileSrc = cloudflareImage(source, {
        ...imagePresets.lightboxMobile,
        fit: 'scale-down',
        format: 'auto',
      });
      node.properties.src = cloudflareImage(source, {
        width: srcWidth,
        fit: 'scale-down',
        quality,
        format: 'auto',
      });
      node.properties.srcSet = cloudflareSrcset(source, widths, {
        fit: 'scale-down',
        quality,
        format: 'auto',
      });
      node.properties.sizes = sizes;
    }
  }

  if (Array.isArray(node.children)) node.children.forEach(visitImages);
};

export default function rehypeImageLoading() {
  return (tree) => visitImages(tree);
}
