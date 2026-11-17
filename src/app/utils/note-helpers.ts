import { NoteMetrics } from '../models/note.model';

export function formatRelativeTime(timestamp: number, now: number = Date.now()): string {
  const seconds = Math.floor((now - timestamp) / 1000);
  if (seconds < 45) {
    return 'Just now';
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  if (days < 7) {
    return `${days}d ago`;
  }
  return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function getNoteMetrics(rawContent: string): NoteMetrics {
  const raw = rawContent ?? '';
  const content = raw.trim();
  const words = content ? content.split(/\s+/).length : 0;
  const tasks = content.match(/^\s*[-*]\s+\[([ xX])\]/gm) ?? [];
  const done = content.match(/^\s*[-*]\s+\[([xX])\]/gm) ?? [];

  return {
    words,
    chars: raw.length,
    readMins: Math.max(1, Math.ceil(words / 200)),
    totalTasks: tasks.length,
    doneTasks: done.length,
  };
}

/** Strips Markdown markers so a note body can be shown as a short plain-text peek. */
export function toPlainSnippet(content: string): string {
  return (
    (content ?? '')
      .replace(/^[#>*`-]+\s*/gm, '')
      .replace(/\[([ xX])\]\s*/g, '')
      .replace(/[*_`~]/g, '')
      .trim() || 'No additional text...'
  );
}
