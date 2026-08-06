import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';

function plain(text: string): string {
  return text
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`~-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function GET(context: APIContext) {
  const posts = (await getCollection('posts', ({ data }) => !data.draft)).sort(
    (a, b) => +b.data.date - +a.data.date,
  );
  const microblog = (await getCollection('microblog', ({ data }) => !data.draft)).sort(
    (a, b) => +b.data.date - +a.data.date,
  );

  const postItems = posts.map((post) => ({
    title: post.data.title,
    pubDate: post.data.date,
    description: post.data.excerpt,
    author: post.data.author,
    link: `/blog/${post.id}`,
    categories: post.data.tags,
  }));

  const microblogItems = microblog.map((entry) => {
    const text = plain(entry.body);
    return {
      title: (text.slice(0, 80) || `Microblog note · ${entry.id}`).replace(/\s+$/, ''),
      pubDate: entry.data.date,
      description: text.slice(0, 280) || 'A microblog note.',
      link: '/microblog',
      categories: entry.data.tags,
    };
  });

  return rss({
    title: 'Tung’s',
    description: 'A magazine on attention, motivation, and the inner life.',
    site: context.site ?? 'https://example.com',
    items: [...postItems, ...microblogItems].sort((a, b) => +b.pubDate - +a.pubDate),
  });
}
