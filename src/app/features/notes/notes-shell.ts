import {
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
  ElementRef,
  Injector,
  afterNextRender,
} from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AssetStore } from '../../core/assets/asset-store';
import { imageIds } from '../../core/content/blocks';
import { NotesStore } from '../../core/notes/notes.store';
import { SeoService } from '../../core/seo/seo.service';
import { SettingsStore } from '../../core/settings/settings.store';
import { NoteList } from './list/note-list';
import { NoteNavigator } from './note-navigator';
import { LibrarySidebar } from './sidebar/library-sidebar';

const WIDE_QUERY = '(min-width: 1101px)';

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

/** Three panes: library · note list · editor (the routed child). On phones they stack. */
@Component({
  selector: 'app-notes-shell',
  imports: [RouterOutlet, LibrarySidebar, NoteList],
  templateUrl: './notes-shell.html',
  styleUrl: './notes-shell.scss',
  host: {
    '(document:keydown)': 'onKeydown($event)',
  },
})
export class NotesShell {
  protected readonly store = inject(NotesStore);
  private readonly navigator = inject(NoteNavigator);
  private readonly settings = inject(SettingsStore);
  private readonly injector = inject(Injector);

  protected readonly drawerOpen = signal(false);
  protected readonly hasNote = computed(() => this.store.openNoteId() !== null);
  private readonly wide = signal(matchMedia(WIDE_QUERY).matches);
  /** The icon rail only exists on wide screens; narrower screens use the drawer. */
  protected readonly rail = computed(
    () => this.wide() && this.settings.settings().sidebarCollapsed,
  );

  private readonly list = viewChild.required(NoteList);
  private readonly drawer = viewChild<ElementRef<HTMLElement>>('drawerPanel');

  constructor() {
    inject(SeoService).apply({
      title: 'Notes — Nota',
      description: 'Your notes, saved in this browser.',
      path: '/app',
      index: false,
    });

    const media = matchMedia(WIDE_QUERY);
    const onMedia = () => this.wide.set(media.matches);
    media.addEventListener('change', onMedia);
    inject(DestroyRef).onDestroy(() => media.removeEventListener('change', onMedia));

    // Once per visit, delete images that no note (including notes in Trash) uses any more.
    const assets = inject(AssetStore);
    let collected = false;
    effect(() => {
      if (!this.store.loaded() || collected) return;
      collected = true;
      const used = new Set(untracked(this.store.notes).flatMap((n) => imageIds(n.body)));
      void assets.collectGarbage(used).catch(() => undefined);
    });

    // Switching view or tag closes the open note when it isn't part of the new list,
    // so the editor never shows a note from the previous selection.
    let first = true;
    effect(() => {
      this.store.view();
      this.store.tag();
      if (first) {
        first = false;
        return;
      }
      untracked(() => {
        const open = this.store.openNoteId();
        if (open && !this.store.listNotes().some((n) => n.id === open)) this.navigator.close();
      });
    });
  }

  protected newNote(): void {
    this.drawerOpen.set(false);
    this.drawerOpener = null;
    this.navigator.createAndOpen();
  }

  private drawerOpener: HTMLElement | null = null;

  protected openDrawer(): void {
    this.drawerOpener =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.drawerOpen.set(true);
    // Move focus into the drawer once it is rendered and visible.
    afterNextRender(
      () => {
        const panel = this.drawer()?.nativeElement;
        (
          panel?.querySelector<HTMLElement>('.close-btn') ??
          panel?.querySelector<HTMLElement>('button, a')
        )?.focus();
      },
      { injector: this.injector },
    );
  }

  protected closeDrawer(): void {
    if (!this.drawerOpen()) return;
    this.drawerOpen.set(false);
    // Return focus to the button that opened the drawer (once the page is no longer inert).
    const opener = this.drawerOpener;
    this.drawerOpener = null;
    setTimeout(() => opener?.isConnected && opener.focus());
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.drawerOpen()) {
      this.closeDrawer();
      return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey || isTyping(event.target)) return;
    if (event.key === 'n') {
      event.preventDefault();
      this.newNote();
    } else if (event.key === '/') {
      event.preventDefault();
      this.list().focusSearch();
    }
  }
}
