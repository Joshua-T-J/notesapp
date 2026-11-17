import { Workspace } from './note.model';

export type LoadSource = 'stored' | 'migrated' | 'new' | 'recovered';

export interface LoadResult {
  workspace: Workspace;
  /** `recovered` = stored data was unreadable; a copy was kept and the app started empty. */
  source: LoadSource;
}

/**
 * Where notes live. The app depends on this abstraction only; today it is backed by localStorage
 * (`LocalStorageNotesRepository`). A sync backend is a new implementation selected in
 * `app.config.ts` — components and the store do not change.
 */
export abstract class NotesRepository {
  abstract load(): Promise<LoadResult>;
  abstract save(workspace: Workspace): Promise<void>;
  /** Permanently removes everything this repository stores. */
  abstract clear(): Promise<void>;
  /** Approximate bytes used, or `null` when unknown. */
  abstract usage(): Promise<number | null>;
}
