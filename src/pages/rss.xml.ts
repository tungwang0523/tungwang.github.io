import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';

function plain(text: string): string {
  return text
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`~-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeHtml(text: string): string {
  return text.replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[character] ?? character,
  );
}

function absoluteUrl(path: string, site: URL): string {
  return new URL(path, site).href;
}

function imageHtml(src: string, alt: string, site: URL): string {
  return `<p><img src="${escapeHtml(absoluteUrl(src, site))}" alt="${escapeHtml(alt)}" loading="lazy" decoding="async" /></p>`;
}

export async function GET(context: APIContext) {
  const site = context.site ?? new URL('https://tung.mockingbird.team');
  const posts = (await getCollection('posts', ({ data }) => !data.draft)).sort(
    (a, b) => +b.data.date - +a.data.date,
  );
  const microblog = (await getCollection('microblog', ({ data }) => !data.draft)).sort(
    (a, b) => +b.data.date - +a.data.date,
  );

  const postItems = posts.map((post) => {
    const cover = imageHtml(post.data.cover, post.data.title, site);
    return {
      title: post.data.title,
      pubDate: post.data.date,
      description: post.data.excerpt,
      author: post.data.author,
      link: `/blog/${post.id}`,
      content: `${cover}<p>${escapeHtml(post.data.excerpt)}</p>`,
    };
  });

  const microblogItems = microblog.map((entry) => {
    const text = plain(entry.body);
    const images = (entry.data.images ?? [])
      .map((image) => imageHtml(image.src, image.alt, site))
      .join('');
    const content = `${images}<p>${escapeHtml(text || 'A microblog note.')}</p>`;
    return {
      title: (text.slice(0, 80) || `Microblog note · ${entry.id}`).replace(/\s+$/, ''),
      pubDate: entry.data.date,
      description: text.slice(0, 280) || 'A microblog note.',
      link: absoluteUrl(`/microblog#${entry.id}`, site),
      content,
    };
  });

  return rss({
    title: 'Tung’s',
    description: 'Blog essays and microblog notes by Tung Wang.',
    site,
    items: [...postItems, ...microblogItems].sort((a, b) => +b.pubDate - +a.pubDate),
  });
}
