import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AssetStore } from '../../core/assets/asset-store';
import { ExportService } from '../../core/export/export.service';
import { ConfirmService } from '../../core/feedback/confirm.service';
import { ToastService } from '../../core/feedback/toast.service';
import { NotesRepository } from '../../core/notes/notes.repository';
import { NotesStore } from '../../core/notes/notes.store';
import { SeoService } from '../../core/seo/seo.service';
import { SettingsStore } from '../../core/settings/settings.store';
import { ThemePreference, ThemeService } from '../../core/theme/theme.service';
import { formatBytes, plural } from '../../shared/format';
import { Icon } from '../../shared/ui/icon';

/** Browsers typically allow about 5 MB of localStorage per site. */
const LOCAL_LIMIT_BYTES = 5 * 1024 * 1024;

@Component({
  selector: 'app-settings-page',
  imports: [RouterLink, Icon],
  templateUrl: './settings-page.html',
  styleUrl: './settings-page.scss',
})
export class SettingsPage {
  protected readonly theme = inject(ThemeService);
  protected readonly settings = inject(SettingsStore);
  protected readonly store = inject(NotesStore);
  private readonly repo = inject(NotesRepository);
  private readonly assets = inject(AssetStore);
  private readonly exporter = inject(ExportService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly themes: { value: ThemePreference; label: string }[] = [
    { value: 'system', label: 'System' },
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
  ];
  protected readonly bytes = signal<number | null>(null);
  protected readonly imageBytes = signal(0);
  protected readonly percent = signal(0);
  protected readonly limit = formatBytes(LOCAL_LIMIT_BYTES);
  protected readonly format = formatBytes;
  protected readonly plural = plural;

  constructor() {
    inject(SeoService).apply({
      title: 'Settings — Nota',
      description: 'Nota settings.',
      path: '/app/settings',
      index: false,
    });
    void this.refreshUsage();
  }

  private async refreshUsage(): Promise<void> {
    const used = await this.repo.usage();
    this.bytes.set(used);
    this.imageBytes.set(await this.assets.usage().catch(() => 0));
    this.percent.set(
      used === null ? 0 : Math.min(100, Math.max(1, Math.round((used / LOCAL_LIMIT_BYTES) * 100))),
    );
  }

  protected async exportZip(): Promise<void> {
    const count = await this.exporter.downloadAllAsZip();
    this.toast.show(`Exported ${plural(count, 'note')}`);
  }

  protected async backup(): Promise<void> {
    await this.exporter.downloadBackup();
  }

  protected async import(input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const backup = await this.exporter.readBackup(file);
    if (!backup) {
      this.toast.show('That file isn’t a Nota backup.', 'error');
      return;
    }
    const ok = await this.confirm.ask({
      title: 'Import this backup?',
      message: `It has ${plural(backup.workspace.notes.length, 'note')}. Notes you already have are kept; where both copies exist, the most recently edited one wins.`,
      confirmLabel: 'Import',
    });
    if (!ok) return;
    await this.exporter.importAssets(backup.assets);
    const result = this.store.importWorkspace(backup.workspace);
    this.toast.show(`Imported ${plural(result.notes, 'note')}`);
    setTimeout(() => void this.refreshUsage(), 600);
  }

  protected async deleteAll(): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Delete all data?',
      message:
        'Every note, folder and tag in this browser will be removed. This can’t be undone. Download a backup first if you might need them.',
      confirmLabel: 'Delete everything',
      danger: true,
    });
    if (!ok) return;
    await this.store.deleteEverything();
    await this.assets.clear().catch(() => undefined);
    await this.refreshUsage();
    this.toast.show('All notes deleted');
    void this.router.navigate(['/app']);
  }
}
