import { Component } from '@angular/core';
import { EditorFacadeService } from '../../core/services/editor-facade.service';

@Component({
  selector: 'app-toolbar',
  standalone: true,
  template: `
    <div class="toolbar">
      <button type="button" (click)="onRect()">Rect</button>
      <button type="button" (click)="onZoomIn()">Zoom +</button>
    </div>
  `,
  styles: [
    `
      .toolbar {
        display: flex;
        gap: 0.5rem;
        padding: 0.25rem;
      }
      .toolbar button {
        padding: 0.25rem 0.5rem;
      }
    `,
  ],
})
export class ToolbarComponent {
  constructor(private readonly editorFacade: EditorFacadeService) {}

  onRect(): void {
    this.editorFacade.addRectangle();
  }

  onZoomIn(): void {
    this.editorFacade.zoomIn();
  }
}
