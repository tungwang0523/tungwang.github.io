import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const posts = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    listTitle: z.string().optional(),
    excerpt: z.string(),
    author: z.string(),
    date: z.coerce.date(),
    cover: z.union([
      z.string().url(),
      z.string().regex(/^\/(?!\/)/, 'Use a full URL or a site path beginning with /'),
    ]),
    featured: z.boolean().default(false),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
    lang: z.enum(['zh', 'en']).default('zh'),
    translationKey: z.string().optional(),
  }),
});

const featured = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/featured' }),
  schema: z.object({
    title: z.string(),
    subtitle: z.string(),
    date: z.coerce.date(),
    order: z.number(),
  }),
});

const microblog = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/microblog' }),
  schema: z.object({
    date: z.coerce.date(),
    images: z
      .array(
        z.object({
          src: z.union([
            z.string().url(),
            z.string().regex(/^\/(?!\/)/, 'Use a full URL or a site path beginning with /'),
          ]),
          alt: z.string().default(''),
        }),
      )
      .max(9)
      .optional(),
    translation: z.string().default(''),
    imageTextEn: z
      .array(
        z.object({
          page: z.number().int().positive(),
          text: z.array(z.string()).min(1),
        }),
      )
      .optional(),
    imageTextZh: z
      .array(
        z.object({
          page: z.number().int().positive(),
          text: z.array(z.string()).min(1),
        }),
      )
      .optional(),
    comment: z.string().optional(),
    commentEn: z.string().optional(),
    location: z.string().optional(),
    locationEn: z.string().optional(),
    link: z.string().url().optional(),
    linkLabel: z.string().optional(),
    linkLabelEn: z.string().optional(),
    draft: z.boolean().default(false),
  }),
});

const home = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/home' }),
  schema: z.object({
    bigTitle: z.string(),
    emphasis: z.string().optional(),
    headline: z.string(),
    excerpt: z.string(),
    metaLeft: z.string(),
    metaRight: z.string(),
    label: z.string(),
    cover: z.union([
      z.string().url(),
      z.string().regex(/^\/(?!\/)/, 'Use a full URL or a site path beginning with /'),
    ]),
    href: z.string(),
    order: z.number(),
  }),
});

const work = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/work' }),
  schema: z.object({
    title: z.string(),
    year: z.string(),
    cover: z.union([
      z.string().url(),
      z.string().regex(/^\/(?!\/)/, 'Use a full URL or a site path beginning with /'),
    ]),
    summary: z.string(),
    href: z.string().regex(/^\/(?!\/)/, 'Use a site path beginning with /'),
    category: z.string(),
    role: z.string().optional(),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    featured: z.boolean().default(false),
    coverFit: z.enum(['contain', 'cover']).default('cover'),
    coverPosition: z.string().default('center'),
    compactMedia: z.boolean().default(false),
    draft: z.boolean().default(false),
    order: z.number().default(0),
  }),
});

export const collections = { posts, featured, microblog, home, work };
