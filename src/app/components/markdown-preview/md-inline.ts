import { Component, input } from '@angular/core';
import { InlineSegment } from '../../utils/markdown';

/** Renders parsed inline segments (text / code / bold / italic) inside its host element. */
@Component({
  selector: '[appMdInline]',
  template: `
    @for (segment of segments(); track $index) {
      @switch (segment.kind) {
        @case ('code') {
          <code>{{ segment.text }}</code>
        }
        @case ('bold') {
          <strong>{{ segment.text }}</strong>
        }
        @case ('em') {
          <em>{{ segment.text }}</em>
        }
        @default {
          <ng-container>{{ segment.text }}</ng-container>
        }
      }
    }
  `,
})
export class MdInline {
  readonly segments = input.required<InlineSegment[]>({ alias: 'appMdInline' });
}
