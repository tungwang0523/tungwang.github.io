import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import { unified } from '@astrojs/markdown-remark';
import sitemap from '@astrojs/sitemap';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeImageLoading from './src/plugins/rehype-image-loading.mjs';
import rehypeBlogImages from './src/plugins/rehype-blog-images.mjs';
import rehypeYouTubeEmbeds from './src/plugins/rehype-youtube-embeds.mjs';

const remarkPlugins = [remarkGfm, remarkMath];
const rehypePlugins = [rehypeImageLoading, rehypeYouTubeEmbeds, rehypeKatex, rehypeBlogImages];

export default defineConfig({
  site: 'https://tung.mockingbird.team',
  trailingSlash: 'ignore',
  vite: {
    // OneDrive occasionally drops macOS file-system events. Polling keeps
    // Markdown content updates reliable during local authoring.
    server: {
      watch: {
        usePolling: true,
        interval: 300,
      },
    },
  },
  integrations: [mdx({ gfm: false, remarkPlugins, rehypePlugins }), sitemap()],
  markdown: {
    // Image structure is finalized at build time; the browser only handles interaction.
    processor: unified({
      gfm: false,
      remarkPlugins,
      rehypePlugins,
    }),
  },
});
