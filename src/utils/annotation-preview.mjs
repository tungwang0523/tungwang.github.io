const textOnly = (html) =>
  html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const punctuationEntities = {
  quot: '"',
  apos: "'",
  hellip: '…',
  laquo: '«',
  raquo: '»',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  ndash: '–',
  mdash: '—',
  nbsp: ' ',
};

function trimEnding(text) {
  // Treat HTML entities as whole tokens: stripping a trailing semicolon alone
  // would corrupt an entity such as &amp; in the rendered preview.
  const tokens = text.match(/&(?:#x[\da-f]+|#\d+|[a-z][a-z\d]+);|[\s\S]/giu) ?? [];
  while (tokens.length) {
    const token = tokens.at(-1);
    let character = token;
    if (token.startsWith('&#')) {
      const numeric = token.slice(2, -1);
      const codePoint =
        numeric[0].toLowerCase() === 'x'
          ? Number.parseInt(numeric.slice(1), 16)
          : Number.parseInt(numeric, 10);
      character = codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : token;
    } else if (token.startsWith('&')) {
      character = punctuationEntities[token.slice(1, -1)] ?? token;
    }
    if (!/^[\p{P}\s]+$/u.test(character)) break;
    tokens.pop();
  }
  return tokens.join('');
}

export function annotationPreview(content) {
  for (const paragraph of content.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)) {
    const preview = textOnly(paragraph[1]);
    if (!preview) continue;
    const remaining =
      content.slice(0, paragraph.index) + content.slice(paragraph.index + paragraph[0].length);
    const hasMore =
      Boolean(textOnly(remaining)) ||
      /<(?:img|picture|video|audio|iframe|svg|canvas|hr)\b/i.test(content);
    return hasMore ? `${trimEnding(preview)}…` : preview;
  }
  return '';
}
