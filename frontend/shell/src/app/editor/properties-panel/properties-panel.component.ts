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
      <div class="panel-title">Properties</div>
      @if (!bridgeAvailable) {
        <p class="no-selection bridge-unavailable">Bridge unavailable</p>
      } @else if (props; as p) {
        @if (selectionCount > 1) {
          <p class="multi-hint">{{ selectionCount }} items selected</p>
        }
        <dl class="props-list">
          <dt>id</dt><dd>{{ p.id }}</dd>
          <dt>type</dt><dd>{{ p.type }}</dd>
          <dt>x</dt>
          <dd>
            <input type="number" class="prop-input" [ngModel]="editX" (ngModelChange)="editX = $event" (blur)="onPositionBlur(p.id)" />
          </dd>
          <dt>y</dt>
          <dd>
            <input type="number" class="prop-input" [ngModel]="editY" (ngModelChange)="editY = $event" (blur)="onPositionBlur(p.id)" />
          </dd>
          <dt>width</dt>
          <dd>
            <input type="number" class="prop-input" [ngModel]="editW" (ngModelChange)="editW = $event" (blur)="onSizeBlur(p.id)" />
          </dd>
          <dt>height</dt>
          <dd>
            <input type="number" class="prop-input" [ngModel]="editH" (ngModelChange)="editH = $event" (blur)="onSizeBlur(p.id)" />
          </dd>
        </dl>
      } @else {
        <p class="no-selection">No selection</p>
      }
    </div>
  `,
  styles: [
    `
      .properties-panel {
        padding: 0.5rem;
        border-left: 1px solid #ddd;
        min-width: 160px;
      }
      .panel-title {
        font-weight: 600;
        margin-bottom: 0.5rem;
      }
      .props-list {
        margin: 0;
        display: grid;
        grid-template-columns: auto 1fr;
        gap: 0.25rem 1rem;
        font-size: 0.875rem;
      }
      .props-list dt {
        color: #666;
      }
      .no-selection {
        margin: 0;
        color: #888;
        font-size: 0.875rem;
      }
      .bridge-unavailable {
        color: #c00;
      }
      .multi-hint {
        margin: 0 0 0.5rem 0;
        font-size: 0.75rem;
        color: #666;
      }
      .prop-input {
        width: 100%;
        box-sizing: border-box;
        font-size: 0.875rem;
        padding: 0.2rem 0.35rem;
        border: 1px solid #ccc;
        border-radius: 3px;
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
  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly editorFacade: EditorFacadeService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  get bridgeAvailable(): boolean {
    return this.editorFacade.isBridgeAvailable();
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

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
