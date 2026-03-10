import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { Subject, combineLatest } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { EditorFacadeService, type EditorSceneItem } from '../../core/services/editor-facade.service';

@Component({
  selector: 'app-layers-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="layers-panel">
      <div class="panel-title">Layers</div>

      @if (!bridgeAvailable) {
        <p class="hint bridge-unavailable">Bridge unavailable</p>
      } @else if (items.length === 0) {
        <p class="hint">No objects</p>
      } @else {
        <div class="layers-list" role="list">
          @for (it of items; track it.id) {
            <button
              type="button"
              class="layer-item"
              role="listitem"
              [class.active]="it.id === activeId"
              (click)="onSelect(it.id)"
              [title]="it.id"
            >
              <span class="layer-id">{{ it.id }}</span>
              <span class="layer-type">{{ it.type }}</span>
            </button>
          }
        </div>
      }
    </div>
  `,
  styles: [
    `
      .layers-panel {
        padding: 0.5rem;
        border-right: 1px solid #ddd;
        min-width: 180px;
        max-width: 280px;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        min-height: 0;
      }
      .panel-title {
        font-weight: 600;
        margin-bottom: 0.5rem;
      }
      .hint {
        margin: 0;
        color: #888;
        font-size: 0.875rem;
      }
      .bridge-unavailable {
        color: #c00;
      }
      .layers-list {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        overflow: auto;
        min-height: 0;
        padding-right: 0.25rem;
      }
      .layer-item {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 0.5rem;
        align-items: center;
        width: 100%;
        text-align: left;
        padding: 0.35rem 0.4rem;
        border: 1px solid #e2e2e2;
        border-radius: 4px;
        background: #fff;
        cursor: pointer;
        font-size: 0.8125rem;
      }
      .layer-item:hover {
        background: #f6f6f8;
      }
      .layer-item.active {
        border-color: #7b61ff;
        background: rgba(123, 97, 255, 0.08);
      }
      .layer-id {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .layer-type {
        color: #666;
        font-size: 0.75rem;
        background: #f0f0f2;
        border-radius: 999px;
        padding: 0.1rem 0.4rem;
      }
    `,
  ],
})
export class LayersPanelComponent implements OnInit, OnDestroy {
  items: EditorSceneItem[] = [];
  activeId: string | null = null;
  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly editorFacade: EditorFacadeService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  get bridgeAvailable(): boolean {
    return this.editorFacade.isBridgeAvailable();
  }

  ngOnInit(): void {
    combineLatest([this.editorFacade.sceneItems$, this.editorFacade.selection$])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([items, selection]) => {
        const active = selection.primary ?? selection.ids[0] ?? null;
        this.items = items ?? [];
        this.activeId = active;
        this.cdr.markForCheck();
      });
  }

  onSelect(id: string): void {
    this.editorFacade.selectElement(id);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}

