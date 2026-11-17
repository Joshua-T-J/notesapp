import { afterRenderEffect, Component, ElementRef, inject, viewChild } from '@angular/core';
import { ConfirmService } from '../../services/confirm.service';

/**
 * Accessible confirmation dialog built on the native <dialog> element
 * (focus trap, Esc to cancel and top-layer rendering come from the browser).
 */
@Component({
  selector: 'app-confirm-dialog',
  templateUrl: './confirm-dialog.html',
  styleUrl: './confirm-dialog.scss',
})
export class ConfirmDialog {
  protected readonly confirm = inject(ConfirmService);

  private readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('dialog');
  private readonly cancelButton = viewChild<ElementRef<HTMLButtonElement>>('cancelButton');

  constructor() {
    // Runs after rendering, so the request's text and buttons exist before the dialog opens.
    afterRenderEffect(() => {
      const open = this.confirm.request() !== null;
      const element = this.dialog()?.nativeElement;
      if (!element) {
        return;
      }
      if (open && !element.open) {
        element.showModal();
        // Default focus goes to the safe choice.
        this.cancelButton()?.nativeElement.focus();
      } else if (!open && element.open) {
        element.close();
      }
    });
  }

  /** Fired when the dialog closes natively (Esc). If a question is still pending, it counts as "cancel". */
  protected onClose(): void {
    this.confirm.answer(false);
  }

  protected onBackdropClick(event: MouseEvent, dialog: HTMLDialogElement): void {
    if (event.target === dialog) {
      this.confirm.answer(false);
    }
  }
}
