const youtubeIdFromUrl = (value) => {
  let url;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  const hostname = url.hostname.replace(/^www\./, '');
  let videoId = null;

  if (hostname === 'youtu.be') {
    videoId = url.pathname.split('/').filter(Boolean)[0];
  } else if (hostname === 'youtube.com' || hostname === 'm.youtube.com') {
    if (url.pathname === '/watch') videoId = url.searchParams.get('v');
    if (url.pathname.startsWith('/shorts/') || url.pathname.startsWith('/embed/')) {
      videoId = url.pathname.split('/').filter(Boolean)[1];
    }
  }

  return videoId && /^[A-Za-z0-9_-]{11}$/.test(videoId) ? videoId : null;
};

const textContent = (node) =>
  node?.children
    ?.filter((child) => child.type === 'text')
    .map((child) => child.value)
    .join('')
    .trim() || 'YouTube video';

const playerNode = ({ videoId, title }) => {
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
  return {
    type: 'element',
    tagName: 'div',
    properties: {
      className: ['youtube-embed-lite'],
      'data-youtube-embed': '',
      'data-video-id': videoId,
      'data-video-title': title,
    },
    children: [
      {
        type: 'element',
        tagName: 'div',
        properties: { className: ['youtube-embed-lite__stage'] },
        children: [
          {
            type: 'element',
            tagName: 'img',
            properties: {
              className: ['youtube-embed-lite__poster'],
              src: `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
              alt: '',
              loading: 'lazy',
              decoding: 'async',
              referrerPolicy: 'no-referrer',
              'data-youtube-poster': '',
              'data-fallback-src': `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
            },
            children: [],
          },
          {
            type: 'element',
            tagName: 'button',
            properties: {
              className: ['youtube-embed-lite__play'],
              type: 'button',
              ariaLabel: `Play ${title}`,
            },
            children: [
              {
                type: 'element',
                tagName: 'span',
                properties: { className: ['youtube-embed-lite__play-icon'], ariaHidden: 'true' },
                children: [],
              },
              { type: 'element', tagName: 'span', properties: {}, children: [{ type: 'text', value: 'Play video' }] },
            ],
          },
        ],
      },
      {
        type: 'element',
        tagName: 'p',
        properties: { className: ['youtube-embed-lite__external'] },
        children: [
          { type: 'text', value: 'If the player is unavailable, ' },
          {
            type: 'element',
            tagName: 'a',
            properties: { href: watchUrl, target: '_blank', rel: ['noreferrer'] },
            children: [{ type: 'text', value: 'open it on YouTube ↗' }],
          },
        ],
      },
    ],
  };
};

export default function rehypeYouTubeEmbeds() {
  return (tree) => {
    const visit = (node) => {
      if (!node?.children) return;

      node.children = node.children.map((child) => {
        if (child.type !== 'element' || child.tagName !== 'p') {
          visit(child);
          return child;
        }

        const meaningfulChildren = child.children.filter(
          (item) => item.type !== 'text' || item.value.trim(),
        );
        if (meaningfulChildren.length !== 1) return child;

        const link = meaningfulChildren[0];
        if (link.type !== 'element' || link.tagName !== 'a') return child;

        const videoId = youtubeIdFromUrl(link.properties?.href);
        if (!videoId) return child;
        return playerNode({ videoId, title: textContent(link) });
      });
    };

    visit(tree);
  };
}
