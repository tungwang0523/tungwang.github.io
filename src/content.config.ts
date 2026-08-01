import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const posts = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    bigTitle: z.string(),
    emphasis: z.string().optional(),
    headline: z.string(),
    excerpt: z.string(),
    author: z.string(),
    readTime: z.string().default('5 Min Read'),
    date: z.coerce.date(),
    cover: z.union([
      z.string().url(),
      z.string().regex(/^\/(?!\/)/, 'Use a full URL or a site path beginning with /'),
    ]),
    featured: z.boolean().default(false),
    pageNumber: z.string().optional(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
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
    type: z.enum(['note', 'image', 'quote', 'link']).default('note'),
    image: z
      .union([
        z.string().url(),
        z.string().regex(/^\/(?!\/)/, 'Use a full URL or a site path beginning with /'),
      ])
      .optional(),
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
    alt: z.string().optional(),
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
    tags: z.array(z.string()).default([]),
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
    cover: z.string().url(),
    summary: z.string(),
    url: z.string().url().optional(),
    order: z.number().default(0),
  }),
});

export const collections = { posts, featured, microblog, home, work };
