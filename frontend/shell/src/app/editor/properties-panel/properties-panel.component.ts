import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
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
          <dt>x</dt><dd>{{ p.x }}</dd>
          <dt>y</dt><dd>{{ p.y }}</dd>
          <dt>width</dt><dd>{{ p.width }}</dd>
          <dt>height</dt><dd>{{ p.height }}</dd>
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
    `,
  ],
})
export class PropertiesPanelComponent implements OnInit, OnDestroy {
  props: EditorElementProperties | null = null;
  selectionCount = 0;
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
        this.cdr.markForCheck();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
