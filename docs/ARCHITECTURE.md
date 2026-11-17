# Architecture

## Data model

A user's data is one `Workspace` (`core/notes/note.model.ts`):

- `Folder { id, name, color, createdAt, updatedAt }`
- `Note { id, title, folderId, tags, pinned, locked, trashedAt, createdAt, updatedAt, body }`

Ids are UUIDs (`crypto.randomUUID()`), so a server can use them as primary keys. Notes point to
folders by id, so renaming a folder touches one record.

### Note bodies are blocks, not HTML or Markdown

`body` is a `Block[]` (`core/content/blocks.ts`): `p`, `h2`, `h3`, `bullet`, `ol`, `todo` (with
`checked`), `quote`, `code` and `image` (with an asset id, description and width), each with
optional `align`. Text is held in spans with optional marks: `bold`, `italic`, `underline`,
`strike`, `code`, `color` and `highlight` (named, so each theme picks a readable shade), `size`
(a step from -2 to 4) and `href` (http, https or mailto only).

Formatting commands work on the model, not the DOM: `core/content/ranges.ts` applies a change
to a text range (split spans, set marks, merge), the editor re-renders and restores the
selection. That keeps every result valid and makes undo/redo a stack of model snapshots.

- **Safe:** the editor builds the DOM from blocks with `createElement` and text nodes, and reads it
  back into blocks. No HTML string is ever stored or parsed back in, and paste is plain text only.
- **Portable:** `toMarkdown()` and `toPlainText()` drive export; `fromMarkdown()` migrated v1 notes.
- **Sync-friendly:** small, validated JSON that diffs well.

## Storage

`NotesRepository` (`core/notes/notes.repository.ts`) is the only way data is loaded or saved:

```ts
abstract class NotesRepository {
  load(): Promise<LoadResult>;   // workspace + where it came from
  save(ws: Workspace): Promise<void>;
  clear(): Promise<void>;
  usage(): Promise<number | null>;
}
```

Today `LocalStorageNotesRepository` stores the workspace as one JSON document under
`nota.workspace.v2`:

- Everything read is validated with `zod/mini` (`workspace.schema.ts`).
- Unreadable data is never overwritten: it is copied to `nota.workspace.v2.unreadable` and the app
  starts empty.
- On first run it migrates v1 data (`nota_lively_*_v4` keys, Markdown bodies) and removes the old keys.

`NotesStore` keeps notes and folders in signals and saves through the repository, debounced 400 ms,
and flushed on `pagehide` / tab hide. Save state (`saved | saving | error`) is shown in the UI.

Images are not stored in the workspace. `AssetStore` (`core/assets`) keeps them in IndexedDB,
resized to at most 1600 px and re-encoded as WebP (which also strips metadata); blocks refer to
them by id. Unused images are removed when the app loads. Exports put them in an `images/`
folder next to the Markdown, and backups embed them as base64.

Per-device preferences (theme, hide previews, re-lock) are separate (`nota.theme`,
`nota.settings.v1`) and are not part of the workspace, so they will not sync.

The repository, store and export service are provided by the `/app` routes (`notes.routes.ts`),
so the public pages do not load them.

## Adding a sync backend later

1. Upload images by asset id (an `AssetStore` backed by the API), so note bodies stay small.
2. Add `HttpNotesRepository` (or a local-first `SyncingNotesRepository` that wraps the local one)
   implementing `NotesRepository`. Validate every response with the same schema.
3. Select it in `features/notes/notes.routes.ts`. Components and the store do not change.
4. Suggested API shape: `GET /api/workspace`, `PUT /api/notes/:id`, `DELETE /api/notes/:id`, same
   for folders, using `updatedAt` for last-write-wins (as backup import already does). Soft delete
   is already modelled by `trashedAt`.
5. Auth: backend-for-frontend with httpOnly, sealed session cookies and CSRF protection. No tokens
   in localStorage.
6. Before launch: update the privacy policy (it already promises this), add `connect-src` for the
   API origin to the CSP, and keep "use without an account" working.

## Security

- `vercel.json`: strict CSP (`script-src 'self'` plus the hash of the one inline theme script,
  Trusted Types required), HSTS, `X-Frame-Options: DENY`, `nosniff`, Referrer-Policy,
  Permissions-Policy. `/app` gets `noindex` and `no-store`.
- `npm run check:security` (runs before `test` and `build`) fails on raw HTML sinks,
  sanitizer bypasses, `eval`, `srcdoc`, inline event handlers, hidden Unicode, and a CSP hash
  that does not match `src/index.html`.
- Hydration runs without incremental hydration/event replay, which would need inline scripts.
- JSON-LD is inserted through a named Trusted Types policy (`nota-jsonld`).
- Locking a note hides it on screen; it is not encryption, and the UI and privacy policy say so.
