import { Component } from '@angular/core';
import { ToolbarComponent } from '../toolbar/toolbar.component';
import { CanvasHostComponent } from '../canvas-host/canvas-host.component';

@Component({
  selector: 'app-editor-shell',
  standalone: true,
  imports: [ToolbarComponent, CanvasHostComponent],
  template: `
    <div class="editor-shell">
      <app-toolbar></app-toolbar>
      <div class="canvas-area">
        <app-canvas-host></app-canvas-host>
      </div>
    </div>
  `,
  styles: [
    `
      .editor-shell {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
      }
      .canvas-area {
        flex: 1;
        min-height: 0;
      }
      app-canvas-host {
        display: block;
        height: 100%;
      }
    `,
  ],
})
export class EditorShellComponent {}
