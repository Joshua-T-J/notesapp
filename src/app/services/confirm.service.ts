import { Injectable, signal } from '@angular/core';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

export interface ConfirmRequest extends ConfirmOptions {
  resolve: (confirmed: boolean) => void;
}

/** Promise-based confirmation. `<app-confirm-dialog>` renders whatever request is pending. */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  readonly request = signal<ConfirmRequest | null>(null);

  ask(options: ConfirmOptions): Promise<boolean> {
    // A newer question supersedes an unanswered one.
    this.request()?.resolve(false);
    return new Promise<boolean>((resolve) => this.request.set({ ...options, resolve }));
  }

  answer(confirmed: boolean): void {
    const pending = this.request();
    if (!pending) {
      return;
    }
    this.request.set(null);
    pending.resolve(confirmed);
  }
}
