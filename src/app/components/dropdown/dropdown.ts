import { Component, computed, ElementRef, inject, input, output, signal, viewChild } from '@angular/core';

export interface DropdownOption {
  value: string;
  label: string;
  /** Shows a colored dot before the label (e.g. a folder color). */
  color?: string;
  /** Bootstrap Icons class shown before the label when there's no color. */
  icon?: string;
}

let nextDropdownId = 0;

/**
 * Custom single-select dropdown that replaces the native <select>, so the option list
 * can match the app's theme. Follows the ARIA select-only combobox pattern
 * (arrow keys, Home/End, Enter/Space, Esc, Tab to close).
 */
@Component({
  selector: 'app-dropdown',
  templateUrl: './dropdown.html',
  styleUrl: './dropdown.scss',
  host: {
    // pointerdown (not click) so it still fires where a parent stops click propagation.
    '(document:pointerdown)': 'onOutsidePointer($event)',
    '(keydown.escape)': 'onEscape($event)',
  },
})
export class Dropdown {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly trigger = viewChild<ElementRef<HTMLButtonElement>>('trigger');

  readonly options = input.required<readonly DropdownOption[]>();
  readonly value = input('');
  readonly label = input('Select an option');
  readonly compact = input(false);
  readonly triggerIcon = input<string | null>(null);
  readonly placement = input<'down' | 'up'>('down');
  readonly align = input<'start' | 'end'>('start');
  readonly valueChange = output<string>();

  protected readonly open = signal(false);
  protected readonly activeIndex = signal(0);
  protected readonly listId = `app-dropdown-${nextDropdownId++}`;

  protected readonly selectedOption = computed(
    () => this.options().find((o) => o.value === this.value()) ?? this.options()[0] ?? null,
  );

  protected toggle(): void {
    if (this.open()) {
      this.open.set(false);
    } else {
      this.activeIndex.set(Math.max(0, this.options().findIndex((o) => o.value === this.value())));
      this.open.set(true);
    }
  }

  protected choose(option: DropdownOption): void {
    this.valueChange.emit(option.value);
    this.open.set(false);
    this.trigger()?.nativeElement.focus();
  }

  protected onKeydown(event: KeyboardEvent): void {
    const options = this.options();
    if (options.length === 0) {
      return;
    }
    const last = options.length - 1;

    if (!this.open()) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        this.toggle();
      }
      return;
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.moveTo(Math.min(this.activeIndex() + 1, last));
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.moveTo(Math.max(this.activeIndex() - 1, 0));
        break;
      case 'Home':
        event.preventDefault();
        this.moveTo(0);
        break;
      case 'End':
        event.preventDefault();
        this.moveTo(last);
        break;
      case 'Enter':
      case ' ': {
        event.preventDefault();
        const option = options[this.activeIndex()];
        if (option) {
          this.choose(option);
        }
        break;
      }
      case 'Tab':
        this.open.set(false);
        break;
    }
  }

  protected onEscape(event: Event): void {
    if (this.open()) {
      // Close just the list; don't let Esc also close the studio or deselect a card.
      event.stopPropagation();
      this.open.set(false);
    }
  }

  protected onOutsidePointer(event: Event): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) {
      this.open.set(false);
    }
  }

  private moveTo(index: number): void {
    this.activeIndex.set(index);
    this.host.nativeElement.querySelector(`#${this.listId}-${index}`)?.scrollIntoView({ block: 'nearest' });
  }
}
