import { fromMarkdown } from '../content/blocks';
import { Folder, FolderColor, Note, Workspace, WORKSPACE_VERSION } from './note.model';

/** Keys written by Nota v1 (Markdown editor). Read once, migrated, then removed. */
export const LEGACY_KEYS = {
  notes: 'nota_lively_notes_v4',
  folders: 'nota_lively_folders_v4',
  folderColors: 'nota_lively_folder_colors_v4',
  theme: 'nota_lively_theme_v4',
} as const;

const LEGACY_COLOR: Record<string, FolderColor> = { teal: 4, indigo: 1, amber: 5, rose: 3, sky: 2 };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);
const num = (v: unknown, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : fallback;

/**
 * Converts v1 data (folders by name, Markdown `content`, `sensitive`, `trashed`) into a v2
 * workspace. Tolerant by design: anything unreadable is skipped rather than failing the migration.
 */
export function migrateLegacy(
  rawNotes: unknown,
  rawFolders: unknown,
  rawColors: unknown,
  newId: () => string,
  now: number,
): Workspace {
  const colors = isRecord(rawColors) ? rawColors : {};
  const names = new Set<string>(
    Array.isArray(rawFolders) ? rawFolders.filter((f): f is string => typeof f === 'string') : [],
  );
  const notesIn = Array.isArray(rawNotes) ? rawNotes.filter(isRecord) : [];
  for (const n of notesIn) {
    if (typeof n['folder'] === 'string' && n['folder']) names.add(n['folder']);
  }

  const folders: Folder[] = [...names].map((name, i) => ({
    id: newId(),
    name: name.slice(0, 120),
    color: LEGACY_COLOR[str(colors[name])] ?? (((i % 5) + 1) as FolderColor),
    createdAt: now,
    updatedAt: now,
  }));
  const idByName = new Map(folders.map((f) => [f.name, f.id]));

  const notes: Note[] = notesIn.map((n) => {
    const updatedAt = num(n['updatedAt'], now);
    const folderName = str(n['folder']);
    return {
      id: str(n['id']) || newId(),
      title: str(n['title']).slice(0, 500),
      folderId: (folderName && idByName.get(folderName)) || null,
      tags: Array.isArray(n['tags'])
        ? n['tags'].filter((t): t is string => typeof t === 'string' && !!t).slice(0, 50)
        : [],
      pinned: n['pinned'] === true,
      locked: n['sensitive'] === true,
      trashedAt: n['trashed'] === true ? updatedAt : null,
      createdAt: num(n['createdAt'], updatedAt),
      updatedAt,
      body: fromMarkdown(stripLeadingTitle(str(n['content']), str(n['title']))),
    };
  });

  return { version: WORKSPACE_VERSION, notes, folders };
}

/** v1 notes usually repeated the title as a `# Heading` on the first line. */
function stripLeadingTitle(content: string, title: string): string {
  const lines = content.replace(/\r\n?/g, '\n').split('\n');
  const first = lines[0]?.replace(/^#\s+/, '').trim();
  return first && first === title.trim() && lines[0]?.startsWith('#')
    ? lines.slice(1).join('\n')
    : content;
}
