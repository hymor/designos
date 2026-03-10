import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  EditorFacadeService,
  type EditorElementProperties,
} from '../../core/services/editor-facade.service';

@Component({
  selector: 'app-properties-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  template: `
    <div class="properties-panel">
      @if (!bridgeAvailable) {
        <p class="no-selection bridge-unavailable">Bridge unavailable</p>
      } @else if (props; as p) {
        @if (selectionCount > 1) {
          <div class="ps">
            <div class="ps-t">{{ selectionCount }} items selected</div>
            <div class="ps-sub">Shift+click to add/remove</div>
          </div>
          <div class="ps ps-disabled">
            <div class="ps-t">Align</div>
            <div class="align-grid">
              <button class="al-btn" type="button" disabled>◧</button>
              <button class="al-btn" type="button" disabled>⬌</button>
              <button class="al-btn" type="button" disabled>◨</button>
              <button class="al-btn" type="button" disabled>⊶</button>
              <button class="al-btn" type="button" disabled>⬍</button>
              <button class="al-btn" type="button" disabled>⊷</button>
            </div>
            <div class="align-grid2">
              <button class="al-btn" type="button" disabled>Dist H</button>
              <button class="al-btn" type="button" disabled>Dist V</button>
            </div>
          </div>
          <div class="ps ps-disabled">
            <div class="ps-t">Order</div>
            <div class="zorder-row">
              <button class="zo-btn" type="button" disabled>⬆ Front</button>
              <button class="zo-btn" type="button" disabled>↑ Fwd</button>
              <button class="zo-btn" type="button" disabled>↓ Bwd</button>
              <button class="zo-btn" type="button" disabled>⬇ Back</button>
            </div>
          </div>
        }

        <div class="ps">
          <div class="ps-t">Meta</div>
          <div class="pr">
            <span class="pl">id</span>
            <input class="pi pi-readonly" [value]="p.id" readonly />
          </div>
          <div class="pr">
            <span class="pl">type</span>
            <input class="pi pi-readonly" [value]="p.type" readonly />
          </div>
        </div>

        <div class="ps">
          <div class="ps-t">Position &amp; Size</div>
          <div class="g2">
            <div>
              <div class="g2-lbl">X</div>
              <input
                type="number"
                class="pi"
                [ngModel]="editX"
                (ngModelChange)="editX = $event"
                (blur)="onPositionBlur(p.id)"
              />
            </div>
            <div>
              <div class="g2-lbl">Y</div>
              <input
                type="number"
                class="pi"
                [ngModel]="editY"
                (ngModelChange)="editY = $event"
                (blur)="onPositionBlur(p.id)"
              />
            </div>
            <div>
              <div class="g2-lbl">W</div>
              <input
                type="number"
                class="pi"
                [ngModel]="editW"
                (ngModelChange)="editW = $event"
                (blur)="onSizeBlur(p.id)"
              />
            </div>
            <div>
              <div class="g2-lbl">H</div>
              <input
                type="number"
                class="pi"
                [ngModel]="editH"
                (ngModelChange)="editH = $event"
                (blur)="onSizeBlur(p.id)"
              />
            </div>
          </div>
        </div>

        <div class="ps ps-disabled">
          <div class="ps-t">Align</div>
          <div class="align-grid">
            <button class="al-btn" type="button" disabled>◧</button>
            <button class="al-btn" type="button" disabled>⬌</button>
            <button class="al-btn" type="button" disabled>◨</button>
            <button class="al-btn" type="button" disabled>⊶</button>
            <button class="al-btn" type="button" disabled>⬍</button>
            <button class="al-btn" type="button" disabled>⊷</button>
          </div>
          <div class="align-grid2">
            <button class="al-btn" type="button" disabled>Dist H</button>
            <button class="al-btn" type="button" disabled>Dist V</button>
          </div>
        </div>

        <div class="ps ps-disabled">
          <div class="ps-t">Order</div>
          <div class="zorder-row">
            <button class="zo-btn" type="button" disabled>⬆ Front</button>
            <button class="zo-btn" type="button" disabled>↑ Fwd</button>
            <button class="zo-btn" type="button" disabled>↓ Bwd</button>
            <button class="zo-btn" type="button" disabled>⬇ Back</button>
          </div>
        </div>

        <div class="ps">
          <div class="ps-t">Opacity</div>
          <div class="pr">
            <span class="pl">%</span>
            <input
              type="number"
              class="pi"
              min="0"
              max="100"
              [ngModel]="editOpacityPct"
              (ngModelChange)="editOpacityPct = $event"
              (blur)="onOpacityBlur(p.id)"
            />
          </div>
        </div>

        @if (showRadius) {
          <div class="ps">
            <div class="ps-t">Radius</div>
            <div class="pr">
              <span class="pl">⌐ rx</span>
              <input
                type="number"
                class="pi"
                min="0"
                [ngModel]="editRadius"
                (ngModelChange)="editRadius = $event"
                (blur)="onRadiusBlur(p.id)"
              />
            </div>
          </div>
        }

        <div class="ps">
          <div class="ps-t">Fill</div>
          <div class="pr">
            <span class="pl">Color</span>
            <input
              type="color"
              class="pi-color"
              [value]="editFillHex"
              (input)="onFillColorInput(p.id, $event)"
            />
            <input
              class="pi"
              [ngModel]="editFillHex"
              (ngModelChange)="editFillHex = $event"
              (blur)="onFillHexBlur(p.id)"
            />
          </div>
        </div>

        <div class="ps">
          <div class="ps-t">Stroke</div>
          <div class="pr">
            <span class="pl">Color</span>
            <input
              type="color"
              class="pi-color"
              [value]="editStrokeHex"
              (input)="onStrokeColorInput(p.id, $event)"
            />
            <input
              class="pi"
              [ngModel]="editStrokeHex"
              (ngModelChange)="editStrokeHex = $event"
              (blur)="onStrokeHexBlur(p.id)"
            />
          </div>
          <div class="pr">
            <span class="pl">W</span>
            <input
              type="number"
              class="pi"
              min="0"
              [ngModel]="editStrokeWidth"
              (ngModelChange)="editStrokeWidth = $event"
              (blur)="onStrokeWidthBlur(p.id)"
            />
          </div>
        </div>
      } @else {
        <p class="no-selection">No selection</p>
      }
    </div>
  `,
  styles: [
    `
      .properties-panel {
        --surface: #1c1c1e;
        --surface2: #242428;
        --surface3: #2c2c30;
        --border: #333338;
        --text: #e8e8ea;
        --text2: #888890;
        --text3: #4a4a52;
        --accent: #7b61ff;

        padding: 8px 0;
        border-left: 1px solid var(--border);
        min-width: 220px;
        max-width: 260px;
        background: var(--surface);
        color: var(--text);
        display: flex;
        flex-direction: column;
        min-height: 0;
        box-sizing: border-box;
      }
      .no-selection {
        margin: 0;
        color: var(--text3);
        font-size: 0.875rem;
        padding: 24px 14px;
        text-align: center;
        line-height: 1.8;
      }
      .bridge-unavailable {
        color: #c44;
      }
      .ps {
        padding: 12px 14px;
        border-bottom: 1px solid var(--border);
      }
      .ps-t {
        font-size: 10px;
        font-weight: 700;
        color: var(--text3);
        letter-spacing: 1px;
        text-transform: uppercase;
        margin-bottom: 10px;
      }
      .ps-sub {
        font-size: 11px;
        color: var(--text3);
        margin-bottom: 8px;
      }
      .ps-disabled {
        opacity: 0.6;
      }
      .pr {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 7px;
      }
      .pr:last-child {
        margin-bottom: 0;
      }
      .pl {
        font-size: 11px;
        color: var(--text3);
        min-width: 32px;
      }
      .pi {
        flex: 1;
        background: var(--surface2);
        border: 1px solid var(--border);
        border-radius: 5px;
        color: var(--text);
        font-size: 11px;
        padding: 4px 7px;
        outline: none;
        font-family: monospace;
        min-width: 0;
        box-sizing: border-box;
      }
      .pi:focus {
        border-color: var(--accent);
      }
      .pi-readonly {
        opacity: 0.7;
      }
      .g2 {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 6px;
      }
      .g2-lbl {
        font-size: 10px;
        color: var(--text3);
        margin-bottom: 3px;
      }
      .align-grid {
        display: grid;
        grid-template-columns: repeat(6, 1fr);
        gap: 4px;
        margin-bottom: 8px;
      }
      .align-grid2 {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 4px;
      }
      .al-btn {
        padding: 6px 2px;
        background: var(--surface2);
        border: 1px solid var(--border);
        border-radius: 5px;
        color: var(--text2);
        cursor: default;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 10px;
      }
      .zorder-row {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr 1fr;
        gap: 4px;
      }
      .zo-btn {
        padding: 5px 2px;
        background: var(--surface2);
        border: 1px solid var(--border);
        border-radius: 5px;
        color: var(--text2);
        font-size: 10px;
        cursor: default;
        text-align: center;
      }
      .pi-color {
        width: 28px;
        height: 24px;
        padding: 0;
        border: 1px solid var(--border);
        border-radius: 5px;
        cursor: pointer;
        flex-shrink: 0;
      }
    `,
  ],
})
export class PropertiesPanelComponent implements OnInit, OnDestroy {
  props: EditorElementProperties | null = null;
  selectionCount = 0;
  editX = 0;
  editY = 0;
  editW = 0;
  editH = 0;
  editOpacityPct = 100;
  editRadius = 0;
  editFillHex = '#7b61ff';
  editStrokeHex = '#ffffff';
  editStrokeWidth = 0;
  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly editorFacade: EditorFacadeService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  get bridgeAvailable(): boolean {
    return this.editorFacade.isBridgeAvailable();
  }

  get showRadius(): boolean {
    const t = this.props?.type;
    return t === 'rect' || t === 'frame';
  }

  ngOnInit(): void {
    this.editorFacade.selection$
      .pipe(takeUntil(this.destroy$))
      .subscribe((selection) => {
        const id = selection.primary ?? selection.ids[0] ?? null;
        this.props = id ? this.editorFacade.getElementProperties(id) : null;
        this.selectionCount = selection.ids?.length ?? 0;
        if (this.props) {
          this.editX = this.props.x;
          this.editY = this.props.y;
          this.editW = this.props.width;
          this.editH = this.props.height;
          this.editOpacityPct =
            this.props.opacity != null
              ? Math.round(this.props.opacity * 100)
              : 100;
          this.editRadius =
            this.props.rx != null ? this.props.rx : 0;
          this.editFillHex =
            this.props.fill && this.props.fill !== 'none'
              ? this.props.fill
              : '#7b61ff';
          this.editStrokeHex =
            this.props.stroke && this.props.stroke !== 'none'
              ? this.props.stroke
              : '#ffffff';
          this.editStrokeWidth =
            this.props.strokeWidth != null ? this.props.strokeWidth : 0;
        }
        this.cdr.markForCheck();
      });
  }

  onPositionBlur(id: string): void {
    const x = Number(this.editX);
    const y = Number(this.editY);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    this.editorFacade.updatePosition(id, x, y);
  }

  onSizeBlur(id: string): void {
    const w = Number(this.editW);
    const h = Number(this.editH);
    if (!Number.isFinite(w) || !Number.isFinite(h) || w < 0 || h < 0) return;
    this.editorFacade.updateSize(id, w, h);
  }

  onOpacityBlur(id: string): void {
    const pct = Number(this.editOpacityPct);
    if (!Number.isFinite(pct)) return;
    const v = Math.max(0, Math.min(100, pct)) / 100;
    this.editorFacade.updateOpacity(id, v);
  }

  onRadiusBlur(id: string): void {
    const r = Number(this.editRadius);
    if (!Number.isFinite(r) || r < 0) return;
    this.editorFacade.updateRadius(id, r);
  }

  onFillColorInput(id: string, ev: Event): void {
    const v = (ev.target as HTMLInputElement).value;
    this.editFillHex = v;
    this.editorFacade.updateFill(id, v);
    this.cdr.markForCheck();
  }

  onFillHexBlur(id: string): void {
    const v = (this.editFillHex || '').trim() || 'none';
    this.editorFacade.updateFill(id, v);
  }

  onStrokeColorInput(id: string, ev: Event): void {
    const v = (ev.target as HTMLInputElement).value;
    this.editStrokeHex = v;
    this.editorFacade.updateStroke(id, v);
    this.cdr.markForCheck();
  }

  onStrokeHexBlur(id: string): void {
    const v = (this.editStrokeHex || '').trim() || 'none';
    this.editorFacade.updateStroke(id, v);
  }

  onStrokeWidthBlur(id: string): void {
    const w = Number(this.editStrokeWidth);
    if (!Number.isFinite(w) || w < 0) return;
    this.editorFacade.updateStrokeWidth(id, w);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
