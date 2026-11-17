import { parseInline, parseMarkdown, toggleTaskLine } from './markdown';

describe('markdown utils', () => {
  it('parses inline code, bold and italic segments', () => {
    expect(parseInline('a **b** `c` *d*')).toEqual([
      { kind: 'text', text: 'a ' },
      { kind: 'bold', text: 'b' },
      { kind: 'text', text: ' ' },
      { kind: 'code', text: 'c' },
      { kind: 'text', text: ' ' },
      { kind: 'em', text: 'd' },
    ]);
  });

  it('returns no blocks for empty content', () => {
    expect(parseMarkdown('  \n ')).toEqual([]);
  });

  it('parses headings, tasks, lists, quotes and code fences', () => {
    const blocks = parseMarkdown(
      ['# Title', '- [x] done', '- [ ] todo', '- item one', '- item two', '> quote', '```', 'a < b', '```'].join('\n'),
    );
    expect(blocks.map((b) => b.type)).toEqual(['h1', 'task', 'task', 'list', 'quote', 'code']);
    expect(blocks[1].checked).toBe(true);
    expect(blocks[1].lineIdx).toBe(1);
    expect(blocks[3].items.length).toBe(2);
    expect(blocks[5].code).toBe('a < b');
  });

  it('toggles a task line in place', () => {
    expect(toggleTaskLine('- [ ] a\n- [x] b', 0, true)).toBe('- [x] a\n- [x] b');
    expect(toggleTaskLine('- [ ] a\n- [x] b', 1, false)).toBe('- [ ] a\n- [ ] b');
  });
});
