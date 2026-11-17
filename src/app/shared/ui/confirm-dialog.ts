import { Component, ElementRef, effect, inject, viewChild } from '@angular/core';
import { ConfirmService } from '../../core/feedback/confirm.service';

/** Native modal <dialog>: focus is trapped and Esc cancels; focus returns to the opener on close. */
@Component({
  selector: 'app-confirm-dialog',
  template: `
    <dialog
      #dialog
      class="dialog"
      aria-labelledby="confirm-title"
      aria-describedby="confirm-message"
      (cancel)="answer(false, $event)"
    >
      @if (confirm.request(); as req) {
        <h2 id="confirm-title">{{ req.title }}</h2>
        <p id="confirm-message">{{ req.message }}</p>
        <div class="actions">
          <button type="button" class="btn btn-secondary" autofocus (click)="answer(false)">
            {{ req.cancelLabel ?? 'Cancel' }}
          </button>
          <button
            type="button"
            class="btn"
            [class.btn-primary]="!req.danger"
            [class.btn-danger]="req.danger"
            (click)="answer(true)"
          >
            {{ req.confirmLabel }}
          </button>
        </div>
      }
    </dialog>
  `,
  styles: `
    .dialog {
      width: min(420px, calc(100vw - 32px));
      padding: 24px;
      border: 1px solid var(--border);
      border-radius: var(--r-panel);
      background: var(--surface);
      color: var(--ink);
      box-shadow: var(--shadow-pop);
    }
    .dialog::backdrop {
      background: rgb(0 0 0 / 0.35);
    }
    h2 {
      margin: 0 0 8px;
      font-size: 19px;
      font-weight: 600;
    }
    p {
      margin: 0 0 24px;
      color: var(--ink-2);
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }
  `,
})
export class ConfirmDialog {
  protected readonly confirm = inject(ConfirmService);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private opener: HTMLElement | null = null;

  constructor() {
    effect(() => {
      const el = this.dialog().nativeElement;
      if (this.confirm.request() && !el.open) {
        this.opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        el.showModal();
      } else if (!this.confirm.request() && el.open) {
        el.close();
        this.opener?.focus();
        this.opener = null;
      }
    });
  }

  protected answer(value: boolean, event?: Event): void {
    event?.preventDefault();
    this.confirm.answer(value);
  }
}
