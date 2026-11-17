import { Component, computed, input, output } from '@angular/core';
import { parseMarkdown } from '../../utils/markdown';
import { MdInline } from './md-inline';

export interface TaskToggle {
  lineIdx: number;
  checked: boolean;
}

/**
 * Live, interactive Markdown preview. Renders a parsed block model with native
 * template control flow (no innerHTML), so content is escaped by default.
 */
@Component({
  selector: 'app-markdown-preview',
  imports: [MdInline],
  templateUrl: './markdown-preview.html',
  host: { class: 'markdown-body d-block' },
})
export class MarkdownPreview {
  readonly content = input.required<string>();
  readonly taskToggled = output<TaskToggle>();

  protected readonly blocks = computed(() => parseMarkdown(this.content()));

  protected toggle(lineIdx: number, checked: boolean): void {
    this.taskToggled.emit({ lineIdx, checked });
  }
}
