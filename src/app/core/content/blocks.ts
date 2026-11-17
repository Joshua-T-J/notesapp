/**
 * Note bodies are stored as a small, editor-independent block model rather than HTML or Markdown.
 * It is easy to validate, safe to render (no HTML is ever parsed back in), diffable for a future
 * sync backend, and converts to Markdown and plain text for export.
 */
export type BlockType = 'p' | 'h2' | 'h3' | 'bullet' | 'ol' | 'todo' | 'quote' | 'code' | 'image';
export type Align = 'left' | 'center' | 'right' | 'justify';
export type ImageWidth = 'sm' | 'md' | 'full';

/** Colours are stored as names; each theme maps them to a readable shade. */
export const TEXT_COLORS = ['gray', 'red', 'orange', 'green', 'blue', 'purple', 'pink'] as const;
export type TextColor = (typeof TEXT_COLORS)[number];
export const HIGHLIGHTS = ['yellow', 'green', 'blue', 'pink', 'purple', 'orange'] as const;
export type Highlight = (typeof HIGHLIGHTS)[number];

/** Relative text size steps; 0 is normal. */
export const MIN_SIZE = -2;
export const MAX_SIZE = 4;

export interface Span {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  code?: boolean;
  color?: TextColor;
  highlight?: Highlight;
  /** Size step, MIN_SIZE…MAX_SIZE, omitted when 0. */
  size?: number;
  /** http(s) or mailto link. */
  href?: string;
}

export type Marks = Omit<Span, 'text'>;
export const MARK_KEYS = [
  'bold',
  'italic',
  'underline',
  'strike',
  'code',
  'color',
  'highlight',
  'size',
  'href',
] as const;
export type MarkKey = (typeof MARK_KEYS)[number];

export interface ImageRef {
  /** Id of the image in the asset store (IndexedDB), not the image data itself. */
  assetId: string;
  alt: string;
  width: ImageWidth;
}

export interface Block {
  type: BlockType;
  spans: Span[];
  /** Only meaningful for `todo` blocks. */
  checked?: boolean;
  /** Omitted for left. */
  align?: Align;
  /** Only for `image` blocks. */
  image?: ImageRef;
}

export const BLOCK_TYPES: readonly BlockType[] = [
  'p',
  'h2',
  'h3',
  'bullet',
  'ol',
  'todo',
  'quote',
  'code',
  'image',
];

/** Lists, quotes and code keep their markers on the left, so only these can be aligned. */
export const ALIGNABLE: readonly BlockType[] = ['p', 'h2', 'h3', 'image'];

export const SAFE_HREF = /^(https?:\/\/|mailto:)/i;

/** Accepts what people type ("example.com") and returns a safe link, or null. */
export function normalizeHref(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  const withScheme = SAFE_HREF.test(value)
    ? value
    : /^[\w.-]+@[\w-]+\.[\w.]+$/.test(value)
      ? `mailto:${value}`
      : `https://${value}`;
  try {
    const url = new URL(withScheme);
    return ['http:', 'https:', 'mailto:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

export function emptyParagraph(): Block {
  return { type: 'p', spans: [] };
}

export function blockText(block: Block): string {
  return block.spans.map((s) => s.text).join('');
}

export function sameMarks(a: Marks, b: Marks): boolean {
  return MARK_KEYS.every((k) => (a[k] ?? false) === (b[k] ?? false));
}

/** A span with only the marks that are actually set. */
export function cleanSpan(text: string, marks: Marks): Span {
  const span: Span = { text };
  if (marks.bold) span.bold = true;
  if (marks.italic) span.italic = true;
  if (marks.underline) span.underline = true;
  if (marks.strike) span.strike = true;
  if (marks.code) span.code = true;
  if (marks.color) span.color = marks.color;
  if (marks.highlight) span.highlight = marks.highlight;
  if (marks.size) span.size = Math.max(MIN_SIZE, Math.min(MAX_SIZE, marks.size));
  if (marks.href) span.href = marks.href;
  return span;
}

/** Kept for readability in seed data and tests. */
export function markSpan(text: string, bold: boolean, italic: boolean): Span {
  return cleanSpan(text, { bold, italic });
}

/** Joins adjacent spans with identical marks and drops empty ones. */
export function normalizeSpans(spans: readonly Span[]): Span[] {
  const out: Span[] = [];
  for (const span of spans) {
    if (!span.text) continue;
    const prev = out.at(-1);
    if (prev && sameMarks(prev, span)) prev.text += span.text;
    else out.push(cleanSpan(span.text, span));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Derived values
// ---------------------------------------------------------------------------

/** Number of each `ol` block within its run of consecutive `ol` blocks (1-based). */
export function listNumbers(blocks: readonly Block[]): number[] {
  let n = 0;
  return blocks.map((b) => (b.type === 'ol' ? ++n : ((n = 0), 0)));
}

export function toPlainText(blocks: readonly Block[]): string {
  const numbers = listNumbers(blocks);
  return blocks
    .map((b, i) => {
      const text = blockText(b);
      switch (b.type) {
        case 'bullet':
          return `• ${text}`;
        case 'ol':
          return `${numbers[i]}. ${text}`;
        case 'todo':
          return `${b.checked ? '[x]' : '[ ]'} ${text}`;
        case 'quote':
          return `“${text}”`;
        case 'image':
          return `[Image${b.image?.alt ? `: ${b.image.alt}` : ''}]`;
        default:
          return text;
      }
    })
    .join('\n');
}

/** First non-empty line, for the note list. */
export function firstLine(blocks: readonly Block[]): string {
  for (const b of blocks) {
    if (b.type === 'image') continue;
    const text = blockText(b).trim();
    if (text) return text.replace(/\s+/g, ' ');
  }
  return blocks.some((b) => b.type === 'image') ? 'Image' : '';
}

export function searchableText(blocks: readonly Block[]): string {
  return blocks
    .map((b) => (b.type === 'image' ? (b.image?.alt ?? '') : blockText(b)))
    .join(' ')
    .toLowerCase();
}

export function imageIds(blocks: readonly Block[]): string[] {
  return blocks.flatMap((b) => (b.type === 'image' && b.image ? [b.image.assetId] : []));
}

export interface BodyStats {
  words: number;
  tasks: number;
  done: number;
}

export function bodyStats(blocks: readonly Block[]): BodyStats {
  let words = 0;
  let tasks = 0;
  let done = 0;
  for (const b of blocks) {
    const text = blockText(b).trim();
    if (text) words += text.split(/\s+/).length;
    if (b.type === 'todo') {
      tasks++;
      if (b.checked) done++;
    }
  }
  return { words, tasks, done };
}

// ---------------------------------------------------------------------------
// Markdown export
// ---------------------------------------------------------------------------

const MD_SPECIAL = /([\\`*_[\]#<>~])/g;

function escapeMarkdown(text: string): string {
  return text.replace(MD_SPECIAL, '\\$1');
}

function spanToMarkdown(span: Span): string {
  if (span.code) {
    const ticks = span.text.includes('`') ? '``' : '`';
    let out = `${ticks}${span.text}${ticks}`;
    if (span.href) out = `[${out}](${span.href})`;
    return out;
  }
  // Keep surrounding whitespace outside the markers, or `** bold**` would not render.
  const match = /^(\s*)(.*?)(\s*)$/s.exec(span.text);
  const [, lead = '', core = '', trail = ''] = match ?? [];
  if (!core) return span.text;
  let out = escapeMarkdown(core);
  if (span.strike) out = `~~${out}~~`;
  if (span.italic) out = `_${out}_`;
  if (span.bold) out = `**${out}**`;
  if (span.href) out = `[${out}](${span.href})`;
  return `${lead}${out}${trail}`;
}

function inlineMarkdown(block: Block): string {
  return block.spans.map(spanToMarkdown).join('').replace(/\n/g, '  \n');
}

export interface MarkdownOptions {
  /** Path used for an image in the Markdown, e.g. `images/<id>.webp`. */
  imagePath?: (image: ImageRef) => string;
}

/**
 * Colour, highlight, size, underline and alignment have no Markdown syntax and are left out;
 * everything else (headings, lists, checklists, quotes, code, links, images) is kept.
 */
export function toMarkdown(
  title: string,
  blocks: readonly Block[],
  options: MarkdownOptions = {},
): string {
  const lines: string[] = [];
  if (title.trim()) lines.push(`# ${escapeMarkdown(title.trim())}`, '');
  const numbers = listNumbers(blocks);
  const isList = (b: Block | undefined) =>
    !!b && (b.type === 'bullet' || b.type === 'todo' || b.type === 'ol');
  blocks.forEach((b, i) => {
    const prev = blocks[i - 1];
    if (isList(prev) && !isList(b)) lines.push('');
    const text = inlineMarkdown(b);
    switch (b.type) {
      case 'h2':
        lines.push(`## ${text}`, '');
        break;
      case 'h3':
        lines.push(`### ${text}`, '');
        break;
      case 'bullet':
        lines.push(`- ${text}`);
        break;
      case 'ol':
        lines.push(`${numbers[i]}. ${text}`);
        break;
      case 'todo':
        lines.push(`- [${b.checked ? 'x' : ' '}] ${text}`);
        break;
      case 'quote':
        lines.push(...text.split('\n').map((l) => `> ${l.replace(/ {2}$/, '')}`), '');
        break;
      case 'code': {
        const raw = blockText(b);
        const fence = raw.includes('```') ? '~~~' : '```';
        lines.push(fence, raw, fence, '');
        break;
      }
      case 'image':
        if (b.image) {
          const path = options.imagePath?.(b.image) ?? `images/${b.image.assetId}.webp`;
          lines.push(`![${escapeMarkdown(b.image.alt)}](${path})`, '');
        }
        break;
      default:
        lines.push(text, '');
    }
  });
  return (
    lines
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim() + '\n'
  );
}

// ---------------------------------------------------------------------------
// Markdown import (used to migrate notes written in the previous Markdown editor)
// ---------------------------------------------------------------------------

function parseInline(text: string): Span[] {
  const spans: Span[] = [];
  const pattern = /\[([^\]]+)\]\(([^)\s]+)\)|(\*\*|__)(.+?)\3|~~(.+?)~~|(\*|_)(.+?)\6|`([^`]+)`/g;
  let last = 0;
  for (const m of text.matchAll(pattern)) {
    const index = m.index ?? 0;
    if (index > last) spans.push({ text: text.slice(last, index) });
    if (m[1] !== undefined) {
      const href = normalizeHref(m[2] ?? '');
      spans.push(href ? cleanSpan(m[1], { href }) : { text: m[1] });
    } else if (m[4] !== undefined) spans.push(cleanSpan(m[4], { bold: true }));
    else if (m[5] !== undefined) spans.push(cleanSpan(m[5], { strike: true }));
    else if (m[7] !== undefined) spans.push(cleanSpan(m[7], { italic: true }));
    else if (m[8] !== undefined) spans.push(cleanSpan(m[8], { code: true }));
    last = index + m[0].length;
  }
  if (last < text.length) spans.push({ text: text.slice(last) });
  return normalizeSpans(
    spans.map((s) => (s.code ? s : { ...s, text: s.text.replace(/\\([\\`*_[\]#<>~])/g, '$1') })),
  );
}

export function fromMarkdown(markdown: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let code: string[] | null = null;
  const flush = () => {
    if (paragraph.length) {
      blocks.push({ type: 'p', spans: parseInline(paragraph.join(' ')) });
      paragraph = [];
    }
  };
  for (const raw of (markdown ?? '').replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trimEnd();
    if (code) {
      if (/^(```|~~~)/.test(line)) {
        blocks.push({ type: 'code', spans: code.length ? [{ text: code.join('\n') }] : [] });
        code = null;
      } else code.push(raw);
      continue;
    }
    let m: RegExpExecArray | null;
    if (/^(```|~~~)/.test(line)) {
      flush();
      code = [];
    } else if (!line.trim()) {
      flush();
    } else if ((m = /^\s*[-*+]\s+\[([ xX])\]\s*(.*)$/.exec(line))) {
      flush();
      blocks.push({ type: 'todo', checked: m[1] !== ' ', spans: parseInline(m[2] ?? '') });
    } else if ((m = /^\s*\d+[.)]\s+(.*)$/.exec(line))) {
      flush();
      blocks.push({ type: 'ol', spans: parseInline(m[1] ?? '') });
    } else if ((m = /^\s*[-*+]\s+(.*)$/.exec(line))) {
      flush();
      blocks.push({ type: 'bullet', spans: parseInline(m[1] ?? '') });
    } else if ((m = /^(#{1,6})\s+(.*)$/.exec(line))) {
      flush();
      const level = (m[1] ?? '#').length;
      blocks.push({ type: level <= 2 ? 'h2' : 'h3', spans: parseInline(m[2] ?? '') });
    } else if ((m = /^>\s?(.*)$/.exec(line))) {
      flush();
      blocks.push({ type: 'quote', spans: parseInline(m[1] ?? '') });
    } else {
      paragraph.push(line.trim());
    }
  }
  if (code) blocks.push({ type: 'code', spans: code.length ? [{ text: code.join('\n') }] : [] });
  flush();
  return blocks;
}
