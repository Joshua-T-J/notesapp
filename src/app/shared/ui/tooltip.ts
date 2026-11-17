import { DOCUMENT, Directive, ElementRef, OnDestroy, inject, input } from '@angular/core';

let nextId = 0;
const HIDE_DELAY_MS = 120;

type Side = 'right' | 'bottom' | 'top';

/**
 * Shared show/hide/position logic. Meets WCAG 1.4.13: appears on hover and keyboard focus, stays
 * while the pointer moves onto it (hoverable), and Esc dismisses it. Text is set with
 * `textContent`, never as HTML.
 */
@Directive()
abstract class TooltipBase implements OnDestroy {
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly document = inject(DOCUMENT);
  private tip: HTMLElement | null = null;
  private hideTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly onKey = (e: KeyboardEvent) => e.key === 'Escape' && this.hideNow();

  /** Text to show now, or '' for none. */
  protected abstract text(): string;
  protected abstract side(): Side;

  protected onFocus(event: FocusEvent): void {
    if ((event.target as HTMLElement).matches?.(':focus-visible')) this.show();
  }

  show(): void {
    clearTimeout(this.hideTimer);
    const text = this.text();
    if (!text || this.tip) return;
    const tip = this.document.createElement('div');
    tip.className = 'tooltip';
    tip.id = `tooltip-${++nextId}`;
    tip.setAttribute('role', 'tooltip');
    tip.textContent = text;
    tip.addEventListener('mouseenter', () => clearTimeout(this.hideTimer));
    tip.addEventListener('mouseleave', () => this.hide());
    this.document.body.appendChild(tip);
    this.document.addEventListener('keydown', this.onKey, true);
    this.tip = tip;
    this.place(tip);
  }

  /** Short delay so the pointer can move onto the tooltip without it vanishing. */
  hide(): void {
    clearTimeout(this.hideTimer);
    this.hideTimer = setTimeout(() => this.hideNow(), HIDE_DELAY_MS);
  }

  hideNow(): void {
    clearTimeout(this.hideTimer);
    this.document.removeEventListener('keydown', this.onKey, true);
    this.tip?.remove();
    this.tip = null;
  }

  ngOnDestroy(): void {
    this.hideNow();
  }

  private place(tip: HTMLElement): void {
    const r = this.host.nativeElement.getBoundingClientRect();
    const t = tip.getBoundingClientRect();
    const gap = 6;
    let left: number;
    let top: number;
    switch (this.side()) {
      case 'right':
        left = r.right + gap;
        top = r.top + (r.height - t.height) / 2;
        break;
      case 'top':
        left = r.left + (r.width - t.width) / 2;
        top = r.top - t.height - gap;
        break;
      default:
        left = r.left + (r.width - t.width) / 2;
        top = r.bottom + gap;
    }
    const root = this.document.documentElement;
    tip.style.left = `${Math.max(8, Math.min(left, root.clientWidth - t.width - 8))}px`;
    tip.style.top = `${Math.max(8, Math.min(top, root.clientHeight - t.height - 8))}px`;
  }
}

const HOST_EVENTS = {
  '(mouseenter)': 'show()',
  '(mouseleave)': 'hide()',
  '(focusin)': 'onFocus($event)',
  '(focusout)': 'hideNow()',
  '(click)': 'hideNow()',
};

/**
 * Text tooltip for icon-only controls. The control must still carry its own `aria-label`;
 * the tooltip is a visual aid.
 */
@Directive({ selector: '[appTooltip]', host: HOST_EVENTS })
export class Tooltip extends TooltipBase {
  readonly appTooltip = input.required<string>();
  readonly tooltipSide = input<Side>('bottom');

  protected text(): string {
    return this.appTooltip();
  }

  protected side(): Side {
    return this.tooltipSide();
  }
}

/**
 * Shows the full text of an element that is cut off with an ellipsis, only while it is cut off.
 * Put it on the clipped element, or on a focusable parent with `clipTarget` set to the selectors
 * of the clipped children (their full texts are joined with " — ").
 */
@Directive({ selector: '[appClipTooltip]', host: HOST_EVENTS })
export class ClipTooltip extends TooltipBase {
  /** Optional CSS selector(s) for the clipped descendants; defaults to the host itself. */
  readonly clipTarget = input<string>('');
  readonly tooltipSide = input<Side>('bottom');
  readonly appClipTooltip = input<'' | undefined>();

  protected text(): string {
    const host = this.host.nativeElement;
    const targets = this.clipTarget()
      ? [...host.querySelectorAll<HTMLElement>(this.clipTarget())]
      : [host];
    const clipped = targets.filter((el) => el.scrollWidth > el.clientWidth + 1);
    return clipped
      .map((el) => (el.textContent ?? '').trim())
      .filter(Boolean)
      .join(' — ');
  }

  protected side(): Side {
    return this.tooltipSide();
  }
}
