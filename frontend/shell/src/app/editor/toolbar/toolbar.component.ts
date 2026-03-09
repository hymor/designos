import { Component } from '@angular/core';
import { EditorFacadeService } from '../../core/services/editor-facade.service';

@Component({
  selector: 'app-toolbar',
  standalone: true,
  template: `
    <div class="toolbar">
      <span class="bridge-status" [class.unavailable]="!bridgeAvailable">Bridge: {{ bridgeAvailable ? 'available' : 'unavailable' }}</span>
      <button type="button" (click)="onRect()">Rect</button>
      <button type="button" (click)="onZoomIn()">Zoom +</button>
    </div>
  `,
  styles: [
    `
      .toolbar {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.25rem;
      }
      .toolbar button {
        padding: 0.25rem 0.5rem;
      }
      .bridge-status {
        font-size: 0.75rem;
        color: #666;
        margin-right: 0.5rem;
      }
      .bridge-status.unavailable {
        color: #c00;
      }
    `,
  ],
})
export class ToolbarComponent {
  constructor(private readonly editorFacade: EditorFacadeService) {}

  get bridgeAvailable(): boolean {
    return this.editorFacade.isBridgeAvailable();
  }

  onRect(): void {
    this.editorFacade.addRectangle();
  }

  onZoomIn(): void {
    this.editorFacade.zoomIn();
  }
}
