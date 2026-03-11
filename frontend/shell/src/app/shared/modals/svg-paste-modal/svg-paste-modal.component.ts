import { AsyncPipe } from '@angular/common';
import { Component, HostListener, OnDestroy, inject } from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { SvgPasteModalService } from '../../../core/services/svg-paste-modal.service';

declare global {
  interface Window {
    confirmSVGPaste?: (mode: 'paths' | 'image') => void;
    cancelSVGPaste?: () => void;
  }
}

@Component({
  selector: 'app-svg-paste-modal',
  standalone: true,
  imports: [AsyncPipe],
  template: `
    @if (visible$ | async) {
      <div class="svg-paste-modal" role="dialog" aria-label="Paste vector from Illustrator">
        <div class="svg-paste-ov" (click)="onCancel()"></div>
        <div class="svg-paste-dialog" (click)="$event.stopPropagation()">
          <div class="svg-paste-title">Paste vector from Illustrator</div>
          <div class="svg-paste-opts">
            <button type="button" class="svg-paste-opt" (click)="onConfirm('paths')">
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M4 18L8 10l4 6 3-4 3 4" stroke="#7b61ff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><rect x="2" y="2" width="8" height="8" rx="1.5" stroke="currentColor" stroke-width="1.2" fill="none"/></svg>
              <strong>Editable paths</strong>
              <small>Each shape becomes an object. Supports rect, ellipse, path, polygon.</small>
            </button>
            <button type="button" class="svg-paste-opt" (click)="onConfirm('image')">
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><rect x="2" y="4" width="18" height="14" rx="2" stroke="currentColor" stroke-width="1.2" fill="none"/><path d="M2 14l4-4 4 4 4-6 6 6" stroke="#7b61ff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
              <strong>As SVG image</strong>
              <small>Exact appearance, vector quality. Non-editable block.</small>
            </button>
          </div>
          <button type="button" class="svg-paste-cancel" (click)="onCancel()">Cancel (Esc)</button>
        </div>
      </div>
    }
  `,
  styles: [
    `
      .svg-paste-modal {
        position: fixed;
        inset: 0;
        z-index: 1100;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .svg-paste-ov {
        position: absolute;
        inset: 0;
        background: rgba(0, 0, 0, 0.7);
        backdrop-filter: blur(6px);
      }
      .svg-paste-dialog {
        position: relative;
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 14px;
        padding: 24px;
        width: 420px;
        max-width: 95vw;
        box-shadow: 0 24px 64px rgba(0, 0, 0, 0.7);
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .svg-paste-title {
        font-size: 13px;
        font-weight: 700;
        color: var(--text2);
        text-transform: uppercase;
        letter-spacing: 0.06em;
      }
      .svg-paste-opts {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
      }
      .svg-paste-opt {
        background: var(--surface2);
        border: 1.5px solid var(--border);
        border-radius: 10px;
        padding: 16px 14px;
        cursor: pointer;
        text-align: left;
        transition: border-color 0.15s, background 0.15s;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .svg-paste-opt:hover {
        border-color: var(--accent);
        background: var(--surface3);
      }
      .svg-paste-opt strong {
        font-size: 13px;
        color: var(--text);
        font-weight: 600;
      }
      .svg-paste-opt small {
        font-size: 11px;
        color: var(--text3);
        line-height: 1.4;
      }
      .svg-paste-opt svg {
        margin-bottom: 4px;
        opacity: 0.6;
      }
      .svg-paste-cancel {
        background: none;
        border: none;
        color: var(--text3);
        font-size: 11px;
        cursor: pointer;
        align-self: center;
        padding: 4px 8px;
        border-radius: 4px;
      }
      .svg-paste-cancel:hover {
        color: var(--text);
      }
    `,
  ],
})
export class SvgPasteModalComponent implements OnDestroy {
  private readonly svgPasteModal = inject(SvgPasteModalService);
  private readonly destroy$ = new Subject<void>();

  readonly visible$ = this.svgPasteModal.visible$;
  isVisible = false;

  constructor() {
    this.svgPasteModal.visible$.pipe(takeUntil(this.destroy$)).subscribe((v) => (this.isVisible = v));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onConfirm(mode: 'paths' | 'image'): void {
    if (typeof window !== 'undefined' && typeof window.confirmSVGPaste === 'function') {
      window.confirmSVGPaste(mode);
    }
    this.svgPasteModal.close();
  }

  onCancel(): void {
    if (typeof window !== 'undefined' && typeof window.cancelSVGPaste === 'function') {
      window.cancelSVGPaste();
    }
    this.svgPasteModal.close();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.isVisible) this.onCancel();
  }
}
