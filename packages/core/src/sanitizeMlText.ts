// eslint-disable-next-line no-misleading-character-class
const EMOJI_REGEX = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{200D}\u{20E3}\u{FE0F}\u{E0020}-\u{E007F}\u{2B50}\u{2B55}\u{2728}\u{274C}\u{274E}\u{2705}\u{2611}\u{2612}\u{23F0}-\u{23FA}\u{231A}\u{231B}\u{25AA}\u{25AB}\u{25FB}-\u{25FE}\u{2934}\u{2935}\u{2B05}-\u{2B07}\u{3030}\u{303D}\u{3297}\u{3299}\u{00A9}\u{00AE}\u{203C}\u{2049}\u{2122}\u{2139}\u{2194}-\u{2199}\u{21A9}\u{21AA}\u{23E9}-\u{23EF}]/gu;

const MARKDOWN_BOLD_ITALIC = /(\*{1,3}|_{1,3})(.*?)\1/g;
const MARKDOWN_HEADERS = /^#{1,6}\s+/gm;
const MARKDOWN_LINKS = /\[([^\]]*)\]\([^)]*\)/g;
const MARKDOWN_IMAGES = /!\[([^\]]*)\]\([^)]*\)/g;
const MARKDOWN_STRIKETHROUGH = /~~(.*?)~~/g;
const MARKDOWN_INLINE_CODE = /`([^`]*)`/g;
const MARKDOWN_CODE_BLOCK = /```[\s\S]*?```/g;

const DECORATIVE_BULLETS = /^[\s]*[•◦▪▸►▶★☆✦✧✩✪✫✬✭✮✯✰❖❂⦿⁃◈◉◊♦♠♣♥♡→⟶⟹⇒⮕➜➝➞➡]+\s*/gm;

export function sanitizeMlText(text: string): string {
  if (!text) return '';

  let result = text;

  result = result.replace(MARKDOWN_CODE_BLOCK, '');
  result = result.replace(MARKDOWN_IMAGES, '$1');
  result = result.replace(MARKDOWN_LINKS, '$1');
  result = result.replace(MARKDOWN_STRIKETHROUGH, '$1');
  result = result.replace(MARKDOWN_BOLD_ITALIC, '$2');
  result = result.replace(MARKDOWN_HEADERS, '');
  result = result.replace(MARKDOWN_INLINE_CODE, '$1');

  result = result.replace(DECORATIVE_BULLETS, '- ');

  result = result.replace(EMOJI_REGEX, '');

  result = result.replace(/[ \t]+/g, ' ');
  result = result.replace(/\n{3,}/g, '\n\n');
  result = result.trim();

  return result;
}
