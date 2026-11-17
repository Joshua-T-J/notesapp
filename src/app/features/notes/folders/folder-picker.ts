import {
  Component,
  ElementRef,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FolderColorChoice } from '../../../core/notes/note.model';
import { NotesStore } from '../../../core/notes/notes.store';
import { Icon } from '../../../shared/ui/icon';
import { MenuDirective } from '../../../shared/ui/menu';
import { ClipTooltip } from '../../../shared/ui/tooltip';
import { FolderColorPicker } from './folder-color-picker';

/** Folder dropdown for the editor: pick a folder, "No folder", or create one in place. */
@Component({
  selector: 'app-folder-picker',
  imports: [Icon, MenuDirective, ClipTooltip, FolderColorPicker],
  template: `
    <div class="picker" appMenu #menu="appMenu">
      <button
        type="button"
        class="trigger"
        aria-haspopup="menu"
        [attr.aria-expanded]="menu.open() || creating()"
        [attr.aria-label]="'Folder: ' + currentName()"
        appClipTooltip
        clipTarget=".name"
        (click)="creating() ? closeCreate() : menu.toggle()"
      >
        @if (current(); as f) {
          <span class="dot" [style.background]="'var(--folder-' + f.color + ')'"></span>
        } @else {
          <app-icon name="folder" [size]="15" />
        }
        <span class="name">{{ currentName() }}</span>
        <app-icon name="chevronDown" [size]="14" [stroke]="2.4" />
      </button>

      @if (menu.open()) {
        <div class="menu list" role="menu" aria-label="Move to folder">
          <button
            type="button"
            role="menuitemradio"
            class="menu-item"
            [attr.aria-checked]="!folderId()"
            (click)="pick(null, menu)"
          >
            <app-icon name="folder" [size]="15" />
            <span class="grow">No folder</span>
            @if (!folderId()) {
              <app-icon name="check" [size]="15" />
            }
          </button>
          @for (f of store.folders(); track f.id) {
            <button
              type="button"
              role="menuitemradio"
              class="menu-item"
              [attr.aria-checked]="folderId() === f.id"
              appClipTooltip
              clipTarget=".grow"
              tooltipSide="right"
              (click)="pick(f.id, menu)"
            >
              <span class="dot-box"
                ><span class="dot" [style.background]="'var(--folder-' + f.color + ')'"></span
              ></span>
              <span class="grow">{{ f.name }}</span>
              @if (folderId() === f.id) {
                <app-icon name="check" [size]="15" />
              }
            </button>
          }
          <div class="menu-sep" role="separator"></div>
          <button type="button" role="menuitem" class="menu-item" (click)="openCreate(menu)">
            <app-icon name="plus" [size]="15" />
            New folder…
          </button>
        </div>
      }

      @if (creating()) {
        <div class="menu create" role="dialog" aria-label="New folder">
          <form
            class="create-form"
            (submit)="$event.preventDefault(); create(nameInput)"
            (keydown.escape)="$event.stopPropagation(); closeCreate()"
          >
            <label class="label" for="picker-new-folder">Folder name</label>
            <input
              #nameInput
              id="picker-new-folder"
              class="input"
              maxlength="120"
              autocomplete="off"
            />
            <app-folder-color-picker [(value)]="color" />
            <div class="actions">
              <button type="button" class="btn btn-ghost small" (click)="closeCreate()">
                Cancel
              </button>
              <button type="submit" class="btn btn-primary small">Create and move</button>
            </div>
          </form>
        </div>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }
    .picker {
      position: relative;
      min-width: 0;
    }
    .trigger {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      max-width: min(220px, 100%);
      min-height: 34px;
      padding: 0 8px 0 10px;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--surface-2);
      color: var(--ink-2);
      font-size: 13.5px;
      font-weight: 500;
    }
    .trigger:hover {
      border-color: var(--border-strong);
      color: var(--ink);
    }
    .trigger[aria-expanded='true'] {
      border-color: var(--border-input);
      background: var(--surface);
      color: var(--ink);
    }
    .name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .list {
      top: calc(100% + 4px);
      left: 0;
      width: 240px;
      max-height: 360px;
      overflow-y: auto;
    }
    .grow {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .dot-box {
      display: grid;
      place-items: center;
      width: 15px;
    }
    .create {
      top: calc(100% + 4px);
      left: 0;
      width: 330px;
      padding: 14px;
    }
    .create-form {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    /* Small screens: pin the popover to the viewport so it never overflows (WCAG 1.4.10). */
    @media (max-width: 760px) {
      .create,
      .list {
        position: fixed;
        top: 56px;
        left: 12px;
        right: 12px;
        width: auto;
      }
    }
    .label {
      margin-bottom: -4px;
      color: var(--ink-3);
      font-size: 12.5px;
      font-weight: 600;
    }
    .input {
      min-height: 36px;
      padding: 0 10px;
      border: 1px solid var(--border-input);
      border-radius: 8px;
      background: var(--surface);
      color: var(--ink);
      font-size: 14px;
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 6px;
    }
    .small {
      min-height: 34px;
      padding: 0 12px;
      font-size: 13.5px;
    }
  `,
  host: { '(document:click)': 'onDocumentClick($event)' },
})
export class FolderPicker {
  readonly folderId = input.required<string | null>();
  readonly changed = output<string | null>();

  protected readonly store = inject(NotesStore);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly creating = signal(false);
  protected readonly color = signal<FolderColorChoice>('random');
  private readonly nameInput = viewChild<ElementRef<HTMLInputElement>>('nameInput');

  protected readonly current = computed(() => {
    const id = this.folderId();
    return id ? (this.store.folderById().get(id) ?? null) : null;
  });
  protected readonly currentName = computed(() => this.current()?.name ?? 'No folder');

  protected pick(id: string | null, menu: MenuDirective): void {
    this.changed.emit(id);
    menu.close(true);
  }

  protected openCreate(menu: MenuDirective): void {
    menu.close();
    this.color.set('random');
    this.creating.set(true);
    setTimeout(() => this.nameInput()?.nativeElement.focus());
  }

  protected closeCreate(): void {
    this.creating.set(false);
    this.host.nativeElement.querySelector<HTMLElement>('.trigger')?.focus();
  }

  protected create(input: HTMLInputElement): void {
    const id = this.store.addFolder(input.value, this.color());
    if (!id) {
      input.focus();
      return;
    }
    this.changed.emit(id);
    this.closeCreate();
  }

  protected onDocumentClick(event: MouseEvent): void {
    if (this.creating() && !this.host.nativeElement.contains(event.target as Node))
      this.creating.set(false);
  }
}
