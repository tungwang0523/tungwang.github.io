const CJK_CHARACTERS_PER_MINUTE = 350;
const WORDS_PER_MINUTE = 225;

function imageViewingSeconds(imageCount: number) {
  let seconds = 0;
  for (let index = 0; index < imageCount; index += 1) {
    seconds += Math.max(3, 12 - index);
  }
  return seconds;
}

export function calculateReadingTime(body = '') {
  const markdownImages = body.match(/!\[[^\]]*\]\([^\n)]+(?:\([^\n)]*\)[^\n)]*)?\)/g) ?? [];
  const htmlImages = body.match(/<img\b[^>]*>/gi) ?? [];
  const imageCount = markdownImages.length + htmlImages.length;

  const readable = body
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/~~~[\s\S]*?~~~/g, ' ')
    .replace(/<!--([\s\S]*?)-->/g, ' ')
    .replace(/!\[([^\]]*)\]\([^\n)]+(?:\([^\n)]*\)[^\n)]*)?\)/g, ' $1 ')
    .replace(/<img\b[^>]*alt=["']([^"']*)["'][^>]*>/gi, ' $1 ')
    .replace(/<img\b[^>]*>/gi, ' ')
    .replace(/\[([^\]]+)\]\([^\n)]+\)/g, ' $1 ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/^\s{0,3}(?:#{1,6}|>|[-+*]\s|\d+[.)]\s)/gm, ' ')
    .replace(/[*_~`|]/g, ' ');

  const cjkPattern = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu;
  const cjkCharacters = readable.match(cjkPattern)?.length ?? 0;
  const words =
    readable.replace(cjkPattern, ' ').match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu)?.length ?? 0;
  const textSeconds = (cjkCharacters / CJK_CHARACTERS_PER_MINUTE + words / WORDS_PER_MINUTE) * 60;
  const minutes = Math.max(1, Math.ceil((textSeconds + imageViewingSeconds(imageCount)) / 60));

  return `${minutes} Min Read`;
}
