import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  text: string;
  tone: 'info' | 'error';
}

const MAX_VISIBLE = 3;
const LIFETIME_MS = 4000;

/** Short confirmations ("Exported", "Copied") and errors, announced through an aria-live region. */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 1;
  readonly toasts = signal<Toast[]>([]);

  show(text: string, tone: Toast['tone'] = 'info'): void {
    const toast = { id: this.nextId++, text, tone };
    this.toasts.update((list) => [...list, toast].slice(-MAX_VISIBLE));
    setTimeout(() => this.dismiss(toast.id), LIFETIME_MS);
  }

  dismiss(id: number): void {
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }
}
