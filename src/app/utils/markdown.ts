export type InlineKind = 'text' | 'code' | 'bold' | 'em';

export interface InlineSegment {
  kind: InlineKind;
  text: string;
}

export type MdBlockType = 'h1' | 'h2' | 'h3' | 'quote' | 'p' | 'task' | 'list' | 'code';

/**
 * A flat block model. Every field is always present so templates can read
 * them without type-narrowing; only the fields relevant to `type` are meaningful.
 */
export interface MdBlock {
  type: MdBlockType;
  inline: InlineSegment[];
  items: InlineSegment[][];
  lineIdx: number;
  checked: boolean;
  code: string;
}

const TASK_RE = /^\s*[-*]\s+\[([ xX])\]\s+(.*)$/;
const BULLET_RE = /^\s*[-*]\s+(.*)$/;
const INLINE_RE = /`([^`]+)`|\*\*([^*]+)\*\*|\*([^*]+)\*/g;

function createBlock(type: MdBlockType, partial: Partial<MdBlock> = {}): MdBlock {
  return { type, inline: [], items: [], lineIdx: -1, checked: false, code: '', ...partial };
}

export function parseInline(text: string): InlineSegment[] {
  const segments: InlineSegment[] = [];
  const re = new RegExp(INLINE_RE.source, 'g');
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      segments.push({ kind: 'text', text: text.slice(last, match.index) });
    }
    if (match[1] !== undefined) {
      segments.push({ kind: 'code', text: match[1] });
    } else if (match[2] !== undefined) {
      segments.push({ kind: 'bold', text: match[2] });
    } else {
      segments.push({ kind: 'em', text: match[3] ?? '' });
    }
    last = re.lastIndex;
  }

  if (last < text.length) {
    segments.push({ kind: 'text', text: text.slice(last) });
  }
  return segments;
}

/**
 * Parses the small Markdown subset Nota supports into render-ready blocks.
 * Output is plain data (no HTML), so templates render it safely without innerHTML.
 */
export function parseMarkdown(text: string): MdBlock[] {
  if (!text || !text.trim()) {
    return [];
  }

  const blocks: MdBlock[] = [];
  const lines = text.split('\n');
  let inCode = false;
  let codeBuffer: string[] = [];
  let list: MdBlock | null = null;

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx] ?? '';

    if (line.trim().startsWith('```')) {
      list = null;
      if (!inCode) {
        inCode = true;
        codeBuffer = [];
      } else {
        inCode = false;
        blocks.push(createBlock('code', { code: codeBuffer.join('\n') }));
      }
      continue;
    }

    if (inCode) {
      codeBuffer.push(line);
      continue;
    }

    const task = TASK_RE.exec(line);
    if (task) {
      list = null;
      blocks.push(
        createBlock('task', {
          lineIdx: idx,
          checked: (task[1] ?? '').toLowerCase() === 'x',
          inline: parseInline(task[2] ?? ''),
        }),
      );
      continue;
    }

    const bullet = BULLET_RE.exec(line);
    if (bullet) {
      if (!list) {
        list = createBlock('list');
        blocks.push(list);
      }
      list.items.push(parseInline(bullet[1] ?? ''));
      continue;
    }
    list = null;

    if (line.startsWith('### ')) {
      blocks.push(createBlock('h3', { inline: parseInline(line.slice(4)) }));
    } else if (line.startsWith('## ')) {
      blocks.push(createBlock('h2', { inline: parseInline(line.slice(3)) }));
    } else if (line.startsWith('# ')) {
      blocks.push(createBlock('h1', { inline: parseInline(line.slice(2)) }));
    } else if (line.startsWith('> ')) {
      blocks.push(createBlock('quote', { inline: parseInline(line.slice(2)) }));
    } else if (line.trim()) {
      blocks.push(createBlock('p', { inline: parseInline(line) }));
    }
  }

  if (inCode) {
    blocks.push(createBlock('code', { code: codeBuffer.join('\n') }));
  }
  return blocks;
}

/** Flips the checkbox on a single `- [ ]` / `- [x]` line and returns the new content. */
export function toggleTaskLine(content: string, lineIdx: number, checked: boolean): string {
  const lines = content.split('\n');
  const line = lines[lineIdx];
  if (line === undefined) {
    return content;
  }
  lines[lineIdx] = checked ? line.replace(/\[ \]/, '[x]') : line.replace(/\[[xX]\]/, '[ ]');
  return lines.join('\n');
}
