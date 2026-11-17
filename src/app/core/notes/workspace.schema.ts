import * as z from 'zod/mini';
import { HIGHLIGHTS, MAX_SIZE, MIN_SIZE, SAFE_HREF, TEXT_COLORS } from '../content/blocks';
import { Workspace, WORKSPACE_VERSION } from './note.model';

/**
 * Runtime validation for anything that enters the app from outside: localStorage, backup files and,
 * later, API responses. Unknown keys are stripped and sizes are capped. Uses `zod/mini` to keep the
 * bundle small.
 */
const spanSchema = z.object({
  text: z.string().check(z.maxLength(100_000)),
  bold: z.optional(z.boolean()),
  italic: z.optional(z.boolean()),
  underline: z.optional(z.boolean()),
  strike: z.optional(z.boolean()),
  code: z.optional(z.boolean()),
  color: z.optional(z.enum(TEXT_COLORS)),
  highlight: z.optional(z.enum(HIGHLIGHTS)),
  size: z.optional(z.int().check(z.gte(MIN_SIZE), z.lte(MAX_SIZE))),
  // Only web and mail links: never javascript:, data: or other schemes.
  href: z.optional(z.string().check(z.maxLength(2_000), z.regex(SAFE_HREF))),
});

const imageSchema = z.object({
  assetId: z.string().check(z.minLength(1), z.maxLength(100)),
  alt: z.string().check(z.maxLength(1_000)),
  width: z.enum(['sm', 'md', 'full']),
});

const blockSchema = z.object({
  type: z.enum(['p', 'h2', 'h3', 'bullet', 'ol', 'todo', 'quote', 'code', 'image']),
  spans: z.array(spanSchema).check(z.maxLength(10_000)),
  checked: z.optional(z.boolean()),
  align: z.optional(z.enum(['left', 'center', 'right', 'justify'])),
  image: z.optional(imageSchema),
});

const id = z.string().check(z.minLength(1), z.maxLength(100));
const timestamp = z.int().check(z.gte(0));

export const folderSchema = z.object({
  id,
  name: z.string().check(z.minLength(1), z.maxLength(120)),
  color: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
    z.literal(6),
    z.literal(7),
    z.literal(8),
  ]),
  createdAt: timestamp,
  updatedAt: timestamp,
});

export const noteSchema = z.object({
  id,
  title: z.string().check(z.maxLength(500)),
  folderId: z.nullable(id),
  tags: z.array(z.string().check(z.minLength(1), z.maxLength(60))).check(z.maxLength(50)),
  pinned: z.boolean(),
  locked: z.boolean(),
  trashedAt: z.nullable(timestamp),
  createdAt: timestamp,
  updatedAt: timestamp,
  body: z.array(blockSchema).check(z.maxLength(20_000)),
});

export const workspaceSchema = z.object({
  version: z.literal(WORKSPACE_VERSION),
  notes: z.array(noteSchema).check(z.maxLength(20_000)),
  folders: z.array(folderSchema).check(z.maxLength(1_000)),
});

export function parseWorkspace(value: unknown): Workspace | null {
  const result = workspaceSchema.safeParse(value);
  if (!result.success) return null;
  const ws: Workspace = result.data;
  // Drop dangling folder references rather than rejecting the whole workspace.
  const folderIds = new Set(ws.folders.map((f) => f.id));
  for (const note of ws.notes) {
    if (note.folderId && !folderIds.has(note.folderId)) note.folderId = null;
  }
  return ws;
}

/** Images inside a backup file: base64 data, raster types only, capped in size. */
const backupAssetSchema = z.object({
  id: z.string().check(z.minLength(1), z.maxLength(100)),
  type: z.enum(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif']),
  data: z.string().check(z.maxLength(20 * 1024 * 1024), z.regex(/^[A-Za-z0-9+/]*={0,2}$/)),
});

export type BackupAsset = z.infer<typeof backupAssetSchema>;

export function parseBackupAssets(value: unknown): BackupAsset[] {
  const list = z.array(backupAssetSchema).check(z.maxLength(5_000)).safeParse(value);
  return list.success ? list.data : [];
}
