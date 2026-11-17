import { Component, inject } from '@angular/core';
import { ToastService } from '../../core/feedback/toast.service';
import { Icon } from './icon';

@Component({
  selector: 'app-toaster',
  imports: [Icon],
  template: `
    <div class="region" role="status" aria-live="polite">
      @for (t of toasts.toasts(); track t.id) {
        <div class="toast" [class.error]="t.tone === 'error'">
          @if (t.tone === 'error') {
            <app-icon name="alert" [size]="16" />
          }
          <span>{{ t.text }}</span>
          <button type="button" class="close" aria-label="Dismiss" (click)="toasts.dismiss(t.id)">
            <app-icon name="x" [size]="14" />
          </button>
        </div>
      }
    </div>
  `,
  styles: `
    .region {
      position: fixed;
      left: 50%;
      bottom: 20px;
      z-index: 60;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      transform: translateX(-50%);
      pointer-events: none;
    }
    .toast {
      display: flex;
      align-items: center;
      gap: 10px;
      min-height: 40px;
      padding: 0 6px 0 14px;
      border-radius: 10px;
      background: var(--ink);
      color: var(--bg);
      font-size: 14px;
      box-shadow: var(--shadow-pop);
      pointer-events: auto;
    }
    .toast.error {
      background: var(--danger);
      color: var(--on-primary);
    }
    .close {
      display: grid;
      place-items: center;
      width: 30px;
      height: 30px;
      border: 0;
      border-radius: 6px;
      background: transparent;
      color: inherit;
      opacity: 0.75;
    }
  `,
})
export class Toaster {
  protected readonly toasts = inject(ToastService);
}
