import { Component } from '@angular/core';
import { ToolbarComponent } from '../toolbar/toolbar.component';
import { CanvasHostComponent } from '../canvas-host/canvas-host.component';
import { PropertiesPanelComponent } from '../properties-panel/properties-panel.component';

@Component({
  selector: 'app-editor-shell',
  standalone: true,
  imports: [ToolbarComponent, CanvasHostComponent, PropertiesPanelComponent],
  template: `
    <div class="editor-shell">
      <app-toolbar></app-toolbar>
      <div class="main-area">
        <div class="canvas-area">
          <app-canvas-host></app-canvas-host>
        </div>
        <app-properties-panel></app-properties-panel>
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
      .main-area {
        display: flex;
        flex: 1;
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
