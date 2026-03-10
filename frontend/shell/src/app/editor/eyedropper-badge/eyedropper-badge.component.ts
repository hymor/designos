import { AsyncPipe, UpperCasePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { EditorFacadeService } from '../../core/services/editor-facade.service';

@Component({
  selector: 'app-eyedropper-badge',
  standalone: true,
  imports: [AsyncPipe, UpperCasePipe],
  template: `
    @if (badge$ | async; as state) {
      <div
        class="ed-badge"
        [style.left.px]="state.left"
        [style.top.px]="state.top"
      >
        <div
          class="ed-swatch"
          [style.background]="state.hex ?? 'transparent'"
        ></div>
        <div>
          <div class="ed-hex">{{ state.hex ? (state.hex | uppercase) : '–' }}</div>
          <div class="ed-hint">{{ state.hint }}</div>
        </div>
      </div>
    }
  `,
  styles: [
    `
      .ed-badge {
        position: fixed;
        pointer-events: none;
        z-index: 9999;
        background: #1c1c1e;
        border: 1px solid #444;
        border-radius: 8px;
        padding: 6px 9px;
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 8px;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
      }
      .ed-swatch {
        width: 22px;
        height: 22px;
        border-radius: 4px;
        border: 1px solid rgba(255, 255, 255, 0.15);
        flex-shrink: 0;
      }
      .ed-hex {
        font-size: 11px;
        font-weight: 600;
        font-family: monospace;
        letter-spacing: 0.5px;
        color: #e8e8ea;
      }
      .ed-hint {
        font-size: 10px;
        color: #666;
      }
    `,
  ],
})
export class EyedropperBadgeComponent {
  private readonly editorFacade = inject(EditorFacadeService);
  readonly badge$ = this.editorFacade.eyedropperBadge$;
}
