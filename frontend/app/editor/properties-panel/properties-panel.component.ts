import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  EditorFacadeService,
  type EditorElementProperties,
} from '../../core/services/editor-facade.service';

@Component({
  selector: 'app-properties-panel',
  standalone: true,
  template: `
    <div class="properties-panel">
      <div class="panel-title">Properties</div>
      @if (props; as p) {
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
    `,
  ],
})
export class PropertiesPanelComponent implements OnInit, OnDestroy {
  props: EditorElementProperties | null = null;
  private readonly destroy$ = new Subject<void>();

  constructor(private readonly editorFacade: EditorFacadeService) {}

  ngOnInit(): void {
    this.editorFacade.selection$
      .pipe(takeUntil(this.destroy$))
      .subscribe((selection) => {
        const id = selection.primary ?? selection.ids[0] ?? null;
        this.props = id ? this.editorFacade.getElementProperties(id) : null;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
