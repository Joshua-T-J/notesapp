import { Note } from '../models/note.model';

export const DEFAULT_FOLDERS: readonly string[] = [
  'Work & Projects',
  'Personal Vault',
  'Reading & Ideas',
];

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

export function createDefaultNotes(now: number = Date.now()): Note[] {
  return [
    {
      id: 'note-1',
      title: 'Morning Reflections & Daily Mindful Checklist',
      folder: null,
      tags: ['journal', 'daily', 'mindful'],
      pinned: true,
      sensitive: false,
      trashed: false,
      createdAt: now - 3 * DAY,
      updatedAt: now - 8 * MIN,
      content: `# Morning Reflections & Daily Mindful Checklist

Welcome to the refreshed **Nota** workspace with a lively yet serene **Emerald Teal & Soft Indigo** palette. Notice how this note has **no folder assigned** (\`Unfiled\`)—you can jot down thoughts immediately without ever needing to categorize them into folders first.

## Today's Priorities
- [x] Refresh UI with crisp mint-alabaster & rich Emerald Teal (#0D9488)
- [x] Allow creating standalone notes without any folder requirement
- [x] Add color-coded folder badges and interactive task progress bars
- [ ] Review afternoon writing goals in Split Studio

> "Clarity and calm go hand in hand when every detail has room to breathe."`,
    },
    {
      id: 'note-2',
      title: 'Quick Scratchpad: Grocery & Weekend Errands',
      folder: null,
      tags: ['personal', 'errands'],
      pinned: false,
      sensitive: false,
      trashed: false,
      createdAt: now - 2 * DAY,
      updatedAt: now - 42 * MIN,
      content: `# Weekend Errands & Market List

A quick standalone note created without a folder. You can keep it unfiled forever or move it into a folder anytime from the toolbar dropdown.

## Farmers Market
- [x] Sourdough country loaf
- [x] Fresh basil & heirloom tomatoes
- [ ] Cold-pressed olive oil
- [ ] Oat milk & roasted almonds`,
    },
    {
      id: 'note-3',
      title: 'Production API Credentials & Recovery Vault',
      folder: 'Personal Vault',
      tags: ['security', 'vault', 'keys'],
      pinned: true,
      sensitive: true,
      trashed: false,
      createdAt: now - 5 * DAY,
      updatedAt: now - 2 * HOUR,
      content: `# Production API Credentials & Recovery Vault

This note is marked **Sensitive**. Even when double-clicked on the card grid, a calm privacy curtain shields the text until you click **Reveal Note Content**.

## Environment Keys (Sample)
\`\`\`bash
NOTA_CLOUD_SYNC_KEY="sage_live_98a7bc650192f83e"
BACKUP_VAULT_PASSPHRASE="correct-horse-calm-meadow-breeze"
\`\`\`

## Security Audit Tasks
- [x] Verify hardware security key backup
- [ ] Rotate staging read-only token next month`,
    },
    {
      id: 'note-4',
      title: 'Q4 Calm Software Architecture & Design Principles',
      folder: 'Work & Projects',
      tags: ['work', 'architecture', 'design'],
      pinned: false,
      sensitive: false,
      trashed: false,
      createdAt: now - 4 * DAY,
      updatedAt: now - 5 * HOUR,
      content: `# Calm Software Architecture & Design Principles

Software should feel like a quiet study room rather than a noisy command center.

## Core Design Tenets
- **Zero Forced Categorization**: New notes default to \`No Folder (Unfiled)\` unless the user is browsing inside a specific folder.
- **Safe Folder Deletion**: Deleting a custom folder never deletes your notes—it gently moves them back to \`Unfiled Notes\`.
- **Shoulder-Surf Protection**: The global **Privacy Shield** masks body text on the card grid by default.

## Milestone Tracker
- [x] Warm Sage, Nordic Mist, and Quiet Dusk theme tokens
- [x] Single-click Quick Dock & Double-click Detail Studio
- [ ] Export workspace archive as Markdown bundle`,
    },
    {
      id: 'note-5',
      title: 'Private Compensation & Financial Planning',
      folder: null,
      tags: ['finance', 'private'],
      pinned: false,
      sensitive: true,
      trashed: false,
      createdAt: now - 3 * DAY,
      updatedAt: now - 1 * DAY,
      content: `# Annual Financial & Savings Allocation

An example of a **Sensitive** standalone note that doesn't belong to any folder.

## Portfolio Allocation Targets
- **Emergency Reserve**: 12 months liquid high-yield savings
- **Index Funds**: 70% global equity / 30% treasury bonds
- [x] Max out annual tax-advantaged retirement contribution
- [ ] Review quarterly rebalance schedule`,
    },
    {
      id: 'note-6',
      title: 'Autumn Reading List & Book Notes',
      folder: 'Reading & Ideas',
      tags: ['reading', 'books', 'ideas'],
      pinned: false,
      sensitive: false,
      trashed: false,
      createdAt: now - 2 * DAY,
      updatedAt: now - 2 * DAY,
      content: `# Autumn Reading List & Essay Ideas

Books and essays exploring calm technology, architecture, and craft:

- *In Praise of Shadows* — Jun'ichirō Tanizaki
- *The Timeless Way of Building* — Christopher Alexander
- *Calm Technology* — Amber Case

## Reading Habits
- [x] Read 25 pages every morning before checking messages
- [ ] Summarize key highlights into standalone unfiled notes`,
    },
  ];
}
