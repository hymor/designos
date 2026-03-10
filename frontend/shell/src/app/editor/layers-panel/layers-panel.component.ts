import { ChangeDetectionStrategy, ChangeDetectorRef, Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { Subject, combineLatest } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { EditorFacadeService, type LayerItem } from '../../core/services/editor-facade.service';

@Component({
  selector: 'app-layers-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="layers-panel">
      @if (!bridgeAvailable) {
        <p class="hint bridge-unavailable">Bridge unavailable</p>
      } @else if (items.length === 0) {
        <p class="hint">No objects</p>
      } @else {
        <div class="layers-list" role="list">
          @for (it of items; track it.id) {
            <div
              class="layer-row"
              role="listitem"
              [class.active]="isActive(it.id)"
              [class.multi]="isMulti(it.id)"
              [style.padding-left.px]="14 + it.depth * 14"
              (click)="onRowClick(it.id, $event)"
            >
              @if (it.isFrame || it.isGroup) {
                <button
                  type="button"
                  class="layer-fold"
                  [title]="it.collapsed ? 'Expand' : 'Collapse'"
                  (click)="onFold(it.id, $event)"
                >
                  {{ it.collapsed ? '▶' : '▼' }}
                </button>
              } @else {
                <span class="layer-fold-placeholder"></span>
              }
              @if (editingId === it.id) {
                <input
                  class="layer-name-input"
                  [value]="editName"
                  (blur)="commitRename()"
                  (keydown.enter)="commitRename()"
                  (keydown.escape)="cancelRename()"
                  (click)="$event.stopPropagation()"
                />
              } @else {
                <span
                  class="layer-name"
                  (dblclick)="startRename(it.id, it.name, $event)"
                >{{ it.name }}</span>
              }
              <button
                type="button"
                class="layer-btn layer-lock"
                [title]="it.locked ? 'Unlock' : 'Lock'"
                [class.on]="it.locked"
                (click)="onLock(it.id, $event)"
              >
                {{ it.locked ? '🔒' : '🔓' }}
              </button>
              <span class="layer-visibility" title="Visibility (not implemented)">👁</span>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [
    `
      .layers-panel {
        padding: 0.5rem 0;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        min-height: 0;
      }
      .hint {
        margin: 0;
        color: var(--text3, #4a4a52);
        font-size: 0.875rem;
      }
      .bridge-unavailable {
        color: #c00;
      }
      .layers-list {
        display: flex;
        flex-direction: column;
        gap: 2px;
        overflow: auto;
        min-height: 0;
        padding: 0 8px 0.25rem 0;
      }
      .layer-row {
        display: flex;
        align-items: center;
        gap: 4px;
        min-height: 28px;
        padding: 2px 6px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.8125rem;
        color: var(--text2, #888890);
        background: transparent;
      }
      .layer-row:hover {
        background: var(--surface3, #2c2c30);
        color: var(--text, #e8e8ea);
      }
      .layer-row.active {
        background: rgba(123, 97, 255, 0.13);
        border: 1px solid var(--accent, #7b61ff);
        color: var(--text, #e8e8ea);
      }
      .layer-row.multi:not(.active) {
        background: rgba(123, 97, 255, 0.08);
        border: 1px solid var(--border, #333338);
      }
      .layer-fold,
      .layer-fold-placeholder {
        width: 16px;
        flex-shrink: 0;
        font-size: 10px;
        line-height: 1;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }
      .layer-fold {
        border: none;
        background: transparent;
        color: inherit;
        cursor: pointer;
        padding: 0;
      }
      .layer-fold:hover {
        opacity: 0.8;
      }
      .layer-fold-placeholder {
        visibility: hidden;
      }
      .layer-name {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .layer-name-input {
        flex: 1;
        min-width: 0;
        font-size: inherit;
        font-family: inherit;
        color: var(--text);
        background: var(--surface2);
        border: 1px solid var(--accent);
        border-radius: 4px;
        padding: 2px 6px;
        outline: none;
      }
      .layer-btn {
        border: none;
        background: transparent;
        color: var(--text3);
        cursor: pointer;
        padding: 0 2px;
        font-size: 12px;
        line-height: 1;
      }
      .layer-btn:hover {
        color: var(--text);
      }
      .layer-lock.on {
        color: var(--accent);
      }
      .layer-visibility {
        font-size: 12px;
        opacity: 0.6;
      }
    `,
  ],
})
export class LayersPanelComponent implements OnInit, OnDestroy {
  items: LayerItem[] = [];
  activeId: string | null = null;
  selectedIds: string[] = [];
  editingId: string | null = null;
  editName = '';
  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly editorFacade: EditorFacadeService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  get bridgeAvailable(): boolean {
    return this.editorFacade.isBridgeAvailable();
  }

  isActive(id: string): boolean {
    return this.activeId === id;
  }

  isMulti(id: string): boolean {
    return this.activeId !== id && this.selectedIds.indexOf(id) >= 0;
  }

  ngOnInit(): void {
    combineLatest([this.editorFacade.layersList$, this.editorFacade.selection$])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([list, selection]) => {
        this.items = list ?? [];
        this.activeId = selection.primary ?? selection.ids?.[0] ?? null;
        this.selectedIds = selection.ids ?? [];
        this.cdr.markForCheck();
      });
  }

  onRowClick(id: string, ev: MouseEvent): void {
    if (this.editingId === id) return;
    const additive = ev.shiftKey || ev.ctrlKey || ev.metaKey;
    this.editorFacade.selectElement(id, additive);
    const win = (window as any);
    if (typeof win.setTool === 'function') win.setTool('select');
  }

  onFold(id: string, ev: MouseEvent): void {
    ev.stopPropagation();
    this.editorFacade.toggleLayerCollapsed(id);
  }

  startRename(id: string, name: string, ev: MouseEvent): void {
    ev.stopPropagation();
    this.editingId = id;
    this.editName = name;
    this.cdr.markForCheck();
  }

  commitRename(): void {
    if (this.editingId != null) {
      this.editorFacade.renameLayer(this.editingId, this.editName.trim());
      this.editingId = null;
      this.editName = '';
      this.cdr.markForCheck();
    }
  }

  cancelRename(): void {
    this.editingId = null;
    this.editName = '';
    this.cdr.markForCheck();
  }

  onLock(id: string, ev: MouseEvent): void {
    ev.stopPropagation();
    const it = this.items.find((i) => i.id === id);
    if (it) this.editorFacade.setLayerLocked(id, !it.locked);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.editingId != null) {
      this.cancelRename();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
