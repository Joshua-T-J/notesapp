import { Component, input, model } from '@angular/core';
import {
  FOLDER_COLORS,
  FOLDER_COLOR_NAMES,
  FolderColorChoice,
} from '../../../core/notes/note.model';
import { Icon } from '../../../shared/ui/icon';
import { Tooltip } from '../../../shared/ui/tooltip';

let nextId = 0;

/** "Random" or one of the palette colours. Native radios, so arrow keys work as expected. */
@Component({
  selector: 'app-folder-color-picker',
  imports: [Tooltip, Icon],
  template: `
    <fieldset class="picker">
      <legend [class.visually-hidden]="!showLegend()">{{ legend() }}</legend>
      <div class="swatches" [style.grid-template-columns]="'repeat(' + columns() + ', 28px)'">
        <label class="swatch random" appTooltip="Random" tooltipSide="top">
          <input
            type="radio"
            class="visually-hidden"
            [name]="name"
            value="random"
            [checked]="value() === 'random'"
            (change)="value.set('random')"
          />
          <span class="chip" aria-hidden="true"
            ><app-icon name="shuffle" [size]="12" [stroke]="2.4"
          /></span>
          <span class="visually-hidden">Random colour</span>
        </label>
        @for (c of colors; track c.value) {
          <label class="swatch" [appTooltip]="c.name" tooltipSide="top">
            <input
              type="radio"
              class="visually-hidden"
              [name]="name"
              [value]="c.value"
              [checked]="value() === c.value"
              (change)="value.set(c.value)"
            />
            <span
              class="chip"
              aria-hidden="true"
              [style.background]="'var(--folder-' + c.value + ')'"
            ></span>
            <span class="visually-hidden">{{ c.name }}</span>
          </label>
        }
      </div>
    </fieldset>
  `,
  styles: `
    .picker {
      margin: 0;
      padding: 0;
      border: 0;
      min-width: 0;
    }
    legend {
      padding: 0 0 6px;
      color: var(--ink-3);
      font-size: 12.5px;
      font-weight: 600;
    }
    .swatches {
      display: grid;
      gap: 4px 6px;
    }
    .swatch {
      display: grid;
      place-items: center;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      cursor: pointer;
    }
    .chip {
      width: 18px;
      height: 18px;
      border-radius: 50%;
      box-shadow: inset 0 0 0 1px rgb(0 0 0 / 0.08);
    }
    .random .chip {
      display: grid;
      place-items: center;
      background: var(--surface-2);
      color: var(--ink-2);
      box-shadow: inset 0 0 0 1px var(--border-strong);
    }
    .swatch:has(input:checked) {
      box-shadow: 0 0 0 2px var(--ink);
    }
    .swatch:has(input:focus-visible) {
      outline: 2px solid var(--focus);
      outline-offset: 2px;
    }
  `,
})
export class FolderColorPicker {
  readonly value = model<FolderColorChoice>('random');
  readonly legend = input('Colour');
  readonly showLegend = input(true);
  /** Swatches per row: 9 fits Random plus all colours on one line. */
  readonly columns = input(9);
  protected readonly name = `folder-color-${++nextId}`;
  protected readonly colors = FOLDER_COLORS.map((value) => ({
    value,
    name: FOLDER_COLOR_NAMES[value],
  }));
}
