import { Routes } from '@angular/router';
import { AssetStore } from '../../core/assets/asset-store';
import { ExportService } from '../../core/export/export.service';
import { LocalStorageNotesRepository } from '../../core/notes/local-notes.repository';
import { NotesRepository } from '../../core/notes/notes.repository';
import { NotesStore } from '../../core/notes/notes.store';
import { NoteNavigator } from './note-navigator';

/**
 * Everything under /app shares one store. Where notes live is chosen here: swap
 * `LocalStorageNotesRepository` for a sync-capable implementation later and nothing else changes.
 */
export const NOTES_ROUTES: Routes = [
  {
    path: '',
    providers: [
      { provide: NotesRepository, useClass: LocalStorageNotesRepository },
      NotesStore,
      AssetStore,
      ExportService,
      NoteNavigator,
    ],
    children: [
      {
        path: 'settings',
        loadComponent: () => import('../settings/settings-page').then((m) => m.SettingsPage),
      },
      {
        path: '',
        loadComponent: () => import('./notes-shell').then((m) => m.NotesShell),
        children: [
          { path: '', loadComponent: () => import('./no-note').then((m) => m.NoNote) },
          {
            path: 'note/:id',
            loadComponent: () => import('./editor/note-editor-page').then((m) => m.NoteEditorPage),
          },
        ],
      },
    ],
  },
];
