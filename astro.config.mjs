import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import { unified } from '@astrojs/markdown-remark';
import sitemap from '@astrojs/sitemap';
import rehypeImageLoading from './src/plugins/rehype-image-loading.mjs';

export default defineConfig({
  site: 'https://example.com',
  trailingSlash: 'ignore',
  integrations: [mdx(), sitemap()],
  markdown: {
    processor: unified({ rehypePlugins: [rehypeImageLoading] }),
  },
});
