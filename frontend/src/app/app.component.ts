import { Component } from '@angular/core';
import { EditorShellComponent } from '../../app/editor/editor-shell/editor-shell.component';
import { PropertiesPanelComponent } from '../../app/editor/properties-panel/properties-panel.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [EditorShellComponent, PropertiesPanelComponent],
  template: `
    <div class="app-root">
      <app-editor-shell></app-editor-shell>
      <aside class="sidebar">
        <app-properties-panel></app-properties-panel>
      </aside>
    </div>
  `,
  styles: [
    `
      .app-root {
        display: flex;
        height: 100%;
        min-height: 0;
      }
      .app-root app-editor-shell {
        flex: 1;
        min-width: 0;
      }
      .sidebar {
        flex-shrink: 0;
      }
    `,
  ],
})
export class AppComponent {}
