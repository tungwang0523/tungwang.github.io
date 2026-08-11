import { access, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve } from 'node:path';

const slug = process.argv[2];

if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
  console.error('Usage: npm run new:blog -- your-post-slug');
  process.exit(1);
}

const filePath = resolve('src/content/posts', `${slug}.md`);

try {
  await access(filePath, constants.F_OK);
  console.error(`Refusing to overwrite existing post: ${filePath}`);
  process.exit(1);
} catch (error) {
  if (error.code !== 'ENOENT') throw error;

  const date = new Date().toISOString().slice(0, 10);
  const content = `---
title: 'Untitled'
excerpt: 'A short summary of this post.'
author: 'Tung Wang'
date: ${date}
cover: '/hero.jpeg'
featured: false
tags: []
draft: true
lang: zh
---

Start writing here.
`;

  await writeFile(filePath, content, 'utf8');
  console.log(`Created draft: ${filePath}`);
}
