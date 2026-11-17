export type SortBy = 'updated' | 'created' | 'alpha';
export type EditorMode = 'write' | 'split' | 'preview';
export type QuickView = 'all' | 'unfiled' | 'pinned' | 'sensitive' | 'trash';
export type ActiveView = QuickView | `folder:${string}`;
export type ThemeValue = 'teal' | 'breeze' | 'aurora';
export type FolderColorKey = 'teal' | 'indigo' | 'amber' | 'rose' | 'sky';

export interface Note {
  id: string;
  title: string;
  /** `null` means the note is unfiled (no folder). */
  folder: string | null;
  tags: string[];
  pinned: boolean;
  sensitive: boolean;
  trashed: boolean;
  createdAt: number;
  updatedAt: number;
  content: string;
}

export type NotePatch = Partial<Omit<Note, 'id' | 'createdAt'>>;

export interface FolderTone {
  cls: string;
  hex: string;
}

export interface NoteMetrics {
  words: number;
  chars: number;
  readMins: number;
  totalTasks: number;
  doneTasks: number;
}
