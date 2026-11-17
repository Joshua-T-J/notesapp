# Nota — UI design spec (v2, "paper")

Design canvas: https://claude.ai/artifact/YHvdqaDvs5JKkeNYEFhrgp (landing, privacy, app light/dark,
settings, phone). Implemented in `src/styles.scss` (tokens) and the feature components.

**Direction:** near-monochrome paper and ink, one warm amber accent used sparingly (pins,
checkboxes). No gradients, no glass, no emoji, sentence-case labels. Three-pane layout like a real
notes app: library · note list · editor.

## Colour tokens

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--bg` | `#FAFAF9` | `#111113` | Page, note list |
| `--bg-side` | `#F3F3F1` | `#161618` | Library sidebar |
| `--surface` | `#FFFFFF` | `#1A1A1D` | Editor, cards, menus, active nav item |
| `--surface-2` / `-3` | `#F0F0EE` / `#E7E6E3` | `#232326` / `#2C2C30` | Hover, search field, selected note |
| `--border` / `-strong` | `#E5E4E1` / `#D6D5D1` | `#2B2B2F` / `#3A3A3F` | Dividers, secondary buttons |
| `--ink` / `-2` / `-3` | `#18181A` / `#4E4E54` / `#6B6B71` | `#EDEDEF` / `#B3B3B9` / `#8E8E95` | Text: primary / secondary / meta |
| `--primary` / `--on-primary` | `#18181A` / `#FFF` | `#EDEDEF` / `#141416` | Primary buttons |
| `--accent` | `#9A5B00` | `#E3AC55` | Pin, checked boxes |
| `--danger` | `#B42318` | `#F08A7E` | Delete actions |
| `--folder-1…8` | slate, plum, clay, olive, sand, teal, rose, graphite | lighter variants | Folder dots and colour swatches only |

All text pairs pass WCAG AA (axe clean in both themes). Muted text on the selected note row steps
up to `--ink-2` to keep 4.5:1.

## Type

- Titles and headings: **Schibsted Grotesk** (variable, self-hosted). View title 21 px, note title
  32 px (26 px phone), editor headings 21 / 17.5 px, landing hero up to 58 px.
- Body and UI: **Figtree** (variable, self-hosted). 15 px base, 16.5 px / 1.7 in the editor.
- No monospace and no all-caps labels.

## Shape

Controls 40 px (36 px in toolbars, 44–48 px CTAs), radius 9–10 px; cards 14 px; dialogs 18 px.
Icons: 2 px line icons, 16–18 px, in `<app-icon>`.

## Screens

- **Landing `/`** — header (wordmark, Privacy, Open Nota), headline, two CTAs, real app screenshot
  (light/dark), three plain statements, honest "Sync is on the roadmap" card, footer.
- **Privacy `/privacy`** — sticky table of contents with scroll spy + policy text matching actual
  behaviour.
- **App `/app`** — library (views with counts, folders with rename / colour / delete menu, tag
  chips with counts, storage status, theme menu, settings; collapses to a 64 px icon rail with
  tooltips) · note list (title, previews toggle, sort menu, search, pinned group,
  empty states, Empty Trash) · editor (folder dropdown with "New folder…", text style, bold, italic, bullets, checklist,
  pin, lock, Export menu, more menu; title, tags, body; word/task count and save status).
- **No note open** — "New note" button (inherits the folder, tag, pinned or locked view being
  browsed, and says so), with the `N` / `/` shortcuts as a tip. Links to missing notes land here.
- **Settings `/app/settings`** — theme, privacy toggles, storage meter, export .zip, backup/import,
  delete all, account & sync (not yet).
- **404** — Angular route and a static `404.html`.

## Editor behaviour

Formatting toolbar under the note's top bar (ARIA toolbar: one Tab stop, arrow keys between
tools): undo / redo · text style (Body, Heading, Subheading, Quote, Code block) · smaller /
larger text · bold, italic, underline, strikethrough, inline code · text colour (7 + default),
highlight (6 + none), link · bulleted, numbered, checklist · alignment (paragraphs, headings and
images; lists, quotes and code stay left) · insert image · clear formatting. Text colours and
highlights are theme tokens (`--tc-*`, `--hl-*`) that keep text at ≥ 4.5:1 in both themes,
including coloured text on a highlight. Images get a description dialog when added and a small
toolbar (description, S/M/L width, remove).

Shortcuts: Ctrl/⌘+Z, Shift+Z or Y (redo), B, I, U, Shift+X (strike), E (inline code), K (link),
Shift+< / > (size), Shift+7 / 8 / 9 (numbered / bulleted / checklist), \ (clear formatting).

Plain writing, no Markdown syntax shown. Shortcuts: `- ` bullet, `1. ` numbered, `[] ` checklist, `> ` quote, ` ``` ` code block, `# ` / `## `
headings, Enter continues a list (Enter on an empty item exits), Backspace at the start of a list
item or heading turns it back into text, Ctrl/Cmd+B / I, Ctrl/Cmd+Enter ticks a checklist item,
click the box to tick. Paste is plain text. Global: `N` new note, `/` search, `Esc` closes menus.

## Responsive

- ≤ 1100 px: the library becomes a drawer (menu button in the list header).
- ≤ 760 px: one pane at a time — the list, or the open note with a back button; the formatting
  toolbar wraps to its own row.

## Privacy UI

- "Hide previews" shows "Preview hidden" in place of the first line (no blur).
- Locked notes show "Locked" in the list and a "This note is locked · Show note" panel; they
  re-lock when you leave (setting). Search never matches a locked note's text.

## Folders

Colour is chosen when a folder is created (Random, the default, prefers colours not yet used) and
can be changed from the folder's menu. Switching folder, view or tag closes the open note if it is
not in the new list. Moving a note to Trash asks for confirmation.

## Not yet designed

- Account sign-in and sync states (synced, offline, conflict)
- Note version history
