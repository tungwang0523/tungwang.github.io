const isWhitespace = (node) => node?.type === 'text' && !node.value?.trim();

const imageFromMedia = (node) => {
  if (node?.type !== 'element') return null;
  if (node.tagName === 'img') return node;
  if (
    node.tagName === 'a' &&
    node.children?.filter((child) => !isWhitespace(child)).length === 1 &&
    node.children?.filter((child) => !isWhitespace(child))[0]?.tagName === 'img'
  ) {
    return node.children.filter((child) => !isWhitespace(child))[0];
  }
  return null;
};

const imageMediaInBlock = (block) => {
  if (block?.type !== 'element' || block.tagName !== 'p') return null;
  const media = block.children.filter((child) => !isWhitespace(child));
  return media.length > 0 && media.every(imageFromMedia) ? media : null;
};

const addClass = (node, className) => {
  node.properties ??= {};
  const classes = Array.isArray(node.properties.className)
    ? node.properties.className
    : node.properties.className
      ? [node.properties.className]
      : [];
  if (!classes.includes(className)) classes.push(className);
  node.properties.className = classes;
};

const prepareImage = (image) => {
  image.properties ??= {};
  const caption =
    typeof image.properties.title === 'string'
      ? image.properties.title.trim()
      : typeof image.properties.alt === 'string'
        ? image.properties.alt.trim()
        : '';

  image.properties.dataBlogImage = '';
  image.properties.dataLightboxImage = '';
  image.properties.dataCaption = caption;
  image.properties.tabIndex = 0;
  image.properties.role = 'button';
  image.properties.ariaLabel = caption ? `View image: ${caption}` : 'View full-size image';
  image.properties.draggable = false;
  delete image.properties.title;
  if (caption) addClass(image, 'has-blog-caption');
};

const captionNode = (caption) => ({
  type: 'element',
  tagName: 'small',
  properties: { className: ['blog-image-caption'] },
  children: [{ type: 'text', value: caption }],
});

const decorateLooseImages = (node) => {
  if (!Array.isArray(node?.children)) return;

  const children = [];
  for (const child of node.children) {
    const image = imageFromMedia(child);
    children.push(child);
    if (image) {
      const caption = image.properties?.dataCaption;
      if (typeof caption === 'string' && caption) children.push(captionNode(caption));
    } else {
      decorateLooseImages(child);
    }
  }
  node.children = children;
};

const gridItem = (media) => {
  const image = imageFromMedia(media);
  if (image?.properties?.srcSet) {
    image.properties.sizes = '(max-width: 560px) calc((100vw - 50px) / 3), 157px';
  }
  const caption = image?.properties?.dataCaption;
  const children = [
    {
      type: 'element',
      tagName: 'span',
      properties: { className: ['blog-image-grid__media'] },
      children: [media],
    },
  ];
  if (typeof caption === 'string' && caption) children.push(captionNode(caption));

  return {
    type: 'element',
    tagName: 'span',
    properties: { className: ['blog-image-grid__item'] },
    children,
  };
};

const groupImageRuns = (tree) => {
  // Markdown emits formatting-only text nodes between block elements. They are
  // invisible in HTML but would otherwise interrupt a run of adjacent images.
  tree.children = tree.children.filter((child) => !isWhitespace(child));
  const output = [];
  for (let index = 0; index < tree.children.length; ) {
    const run = [];
    let imageCount = 0;
    let cursor = index;

    while (cursor < tree.children.length) {
      const media = imageMediaInBlock(tree.children[cursor]);
      if (!media) break;
      run.push(media);
      imageCount += media.length;
      cursor += 1;
    }

    if (imageCount >= 2) {
      output.push({
        type: 'element',
        tagName: 'div',
        properties: { className: ['blog-image-grid'] },
        children: run.flat().map(gridItem),
      });
      index = cursor;
      continue;
    }

    const child = tree.children[index];
    if (child) {
      decorateLooseImages(child);
      output.push(child);
    }
    index += 1;
  }
  tree.children = output;
};

const visitImages = (node) => {
  if (!node || typeof node !== 'object') return;
  if (node.type === 'element' && node.tagName === 'img') prepareImage(node);
  if (Array.isArray(node.children)) node.children.forEach(visitImages);
};

export default function rehypeBlogImages() {
  return (tree, file) => {
    const sourcePath = String(file?.path ?? file?.history?.[0] ?? '').replaceAll('\\', '/');
    if (sourcePath && !sourcePath.includes('/src/content/posts/')) return;
    visitImages(tree);
    if (tree?.type === 'root' && Array.isArray(tree.children)) groupImageRuns(tree);
  };
}
