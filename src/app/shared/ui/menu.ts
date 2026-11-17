import { Directive, ElementRef, Injector, afterNextRender, inject, signal } from '@angular/core';

/**
 * Behaviour for a small popover menu: put `appMenu` on the wrapper, `#trigger` on the button and
 * render the `.menu` element while `open()` is true. Handles outside clicks, Esc, focus on open,
 * arrow keys between items and focus return on close.
 */
@Directive({
  selector: '[appMenu]',
  exportAs: 'appMenu',
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(keydown)': 'onKeydown($event)',
  },
})
export class MenuDirective {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  readonly open = signal(false);

  toggle(): void {
    this.open() ? this.close(true) : this.show();
  }

  show(): void {
    this.open.set(true);
    // The menu renders on the next change detection; focus its first item once it exists.
    afterNextRender(() => this.items()[0]?.focus(), { injector: this.injector });
  }

  close(restoreFocus = false): void {
    if (!this.open()) return;
    this.open.set(false);
    if (restoreFocus)
      this.host.nativeElement.querySelector<HTMLElement>('[aria-haspopup]')?.focus();
  }

  protected onDocumentClick(event: MouseEvent): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) this.close();
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (!this.open()) return;
    if (event.key === 'Escape') {
      event.stopPropagation();
      this.close(true);
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const items = this.items();
    const index = items.indexOf(document.activeElement as HTMLElement);
    const next = event.key === 'ArrowDown' ? index + 1 : index - 1;
    items[(next + items.length) % items.length]?.focus();
  }

  private items(): HTMLElement[] {
    return [...this.host.nativeElement.querySelectorAll<HTMLElement>('[role^="menuitem"]')];
  }
}
