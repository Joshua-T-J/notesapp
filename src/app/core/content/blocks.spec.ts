import {
  bodyStats,
  firstLine,
  fromMarkdown,
  normalizeHref,
  normalizeSpans,
  toMarkdown,
  toPlainText,
} from './blocks';

describe('blocks', () => {
  it('merges adjacent spans with the same marks', () => {
    expect(
      normalizeSpans([{ text: 'a' }, { text: 'b' }, { text: '' }, { text: 'c', bold: true }]),
    ).toEqual([{ text: 'ab' }, { text: 'c', bold: true }]);
  });

  it('exports headings, lists, checklists and inline marks to Markdown', () => {
    const md = toMarkdown('Plan', [
      { type: 'p', spans: [{ text: 'Hello ' }, { text: 'world', bold: true }] },
      { type: 'h2', spans: [{ text: 'Today' }] },
      { type: 'todo', checked: true, spans: [{ text: 'Done' }] },
      { type: 'todo', spans: [{ text: 'Open' }] },
      { type: 'bullet', spans: [{ text: 'note', italic: true }] },
      { type: 'p', spans: [{ text: 'a_b*c' }] },
    ]);
    expect(md).toBe(
      '# Plan\n\nHello **world**\n\n## Today\n\n- [x] Done\n- [ ] Open\n- _note_\n\na\\_b\\*c\n',
    );
  });

  it('round-trips the essentials through Markdown', () => {
    const blocks = fromMarkdown('## Today\n- [x] Done\n- [ ] **Open**\n- item\n\nSome *text* here');
    expect(blocks.map((b) => b.type)).toEqual(['h2', 'todo', 'todo', 'bullet', 'p']);
    expect(blocks[1]?.checked).toBe(true);
    expect(blocks[2]?.spans).toEqual([{ text: 'Open', bold: true }]);
    expect(blocks[4]?.spans).toEqual([
      { text: 'Some ' },
      { text: 'text', italic: true },
      { text: ' here' },
    ]);
  });

  it('derives plain text, first line and stats', () => {
    const blocks = fromMarkdown('\n- [x] One two\n- [ ] Three');
    expect(toPlainText(blocks)).toBe('[x] One two\n[ ] Three');
    expect(firstLine(blocks)).toBe('One two');
    expect(bodyStats(blocks)).toEqual({ words: 3, tasks: 2, done: 1 });
  });

  it('exports numbered lists, quotes, code, links, strikethrough and images', () => {
    const md = toMarkdown('', [
      { type: 'ol', spans: [{ text: 'One' }] },
      { type: 'ol', spans: [{ text: 'Two', strike: true }] },
      { type: 'quote', spans: [{ text: 'Said' }] },
      { type: 'code', spans: [{ text: 'let a = 1;\nlet b = 2;' }] },
      {
        type: 'p',
        spans: [
          { text: 'site', href: 'https://example.com/' },
          { text: ' and ' },
          { text: 'x()', code: true },
        ],
      },
      { type: 'image', spans: [], image: { assetId: 'abc', alt: 'A cat', width: 'md' } },
    ]);
    expect(md).toBe(
      '1. One\n2. ~~Two~~\n\n> Said\n\n```\nlet a = 1;\nlet b = 2;\n```\n\n[site](https://example.com/) and `x()`\n\n![A cat](images/abc.webp)\n',
    );
  });

  it('imports numbered lists, quotes, code fences and links', () => {
    const blocks = fromMarkdown('1. a\n2. b\n> q\n```\ncode\n```\n[x](https://e.com) ~~gone~~');
    expect(blocks.map((b) => b.type)).toEqual(['ol', 'ol', 'quote', 'code', 'p']);
    expect(blocks[4]?.spans).toEqual([
      { text: 'x', href: 'https://e.com/' },
      { text: ' ' },
      { text: 'gone', strike: true },
    ]);
  });

  it('only accepts web and mail links', () => {
    expect(normalizeHref('example.com')).toBe('https://example.com/');
    expect(normalizeHref('me@example.com')).toBe('mailto:me@example.com');
    expect(normalizeHref('javascript:alert(1)')).toBeNull();
    expect(normalizeHref('  ')).toBeNull();
  });
});
