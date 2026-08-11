import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import { unified } from '@astrojs/markdown-remark';
import sitemap from '@astrojs/sitemap';
import rehypeImageLoading from './src/plugins/rehype-image-loading.mjs';
import rehypeBlogImages from './src/plugins/rehype-blog-images.mjs';
import rehypeYouTubeEmbeds from './src/plugins/rehype-youtube-embeds.mjs';

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
  integrations: [mdx(), sitemap()],
  markdown: {
    // Image structure is finalized at build time; the browser only handles interaction.
    processor: unified({
      rehypePlugins: [rehypeImageLoading, rehypeYouTubeEmbeds, rehypeBlogImages],
    }),
  },
});
