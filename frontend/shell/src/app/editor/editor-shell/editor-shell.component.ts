import { Component, HostListener } from '@angular/core';
import { ToolbarComponent } from '../toolbar/toolbar.component';
import { ProjectTabsComponent } from '../project-tabs/project-tabs.component';
import { CanvasHostComponent } from '../canvas-host/canvas-host.component';
import { PropertiesPanelComponent } from '../properties-panel/properties-panel.component';
import { LeftPanelComponent } from '../left-panel/left-panel.component';
import { EyedropperBadgeComponent } from '../eyedropper-badge/eyedropper-badge.component';
import { EditorFacadeService } from '../../core/services/editor-facade.service';

@Component({
  selector: 'app-editor-shell',
  standalone: true,
  imports: [
    ToolbarComponent,
    ProjectTabsComponent,
    CanvasHostComponent,
    PropertiesPanelComponent,
    LeftPanelComponent,
    EyedropperBadgeComponent,
  ],
  template: `
    <div class="editor-shell">
      <app-toolbar></app-toolbar>
      <app-project-tabs></app-project-tabs>
      <div class="main-area">
        <app-left-panel></app-left-panel>
        <div class="canvas-area">
          <app-canvas-host></app-canvas-host>
        </div>
        <app-properties-panel></app-properties-panel>
      </div>
      <app-eyedropper-badge></app-eyedropper-badge>
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
export class EditorShellComponent {
  constructor(private readonly editorFacade: EditorFacadeService) {}

  @HostListener('window:keydown', ['$event'])
  onKeyDown(e: KeyboardEvent): void {
    // Avoid interfering with typing and native undo/redo inside inputs/textareas/contenteditable.
    const target = e.target as (EventTarget & { tagName?: string; isContentEditable?: boolean }) | null;
    const tag = (target && typeof target.tagName === 'string' ? target.tagName : '').toLowerCase();
    const isTextInput =
      tag === 'input' || tag === 'textarea' || (target && (target as any).isContentEditable === true);

    const key = (e.key ?? '').toLowerCase();
    const isMod = e.ctrlKey || e.metaKey;

    // Delete/Backspace: handled by legacy document keydown (single path to avoid double delSel)
    // Context menu Delete still uses editorFacade.deleteSelected() -> engine.delSel()

    // Ctrl/Cmd+Z -> undo (but not in text inputs)
    if (!isTextInput && isMod && !e.shiftKey && key === 'z') {
      e.preventDefault();
      this.editorFacade.undo();
      return;
    }

    // Ctrl/Cmd+Shift+Z -> redo (but not in text inputs)
    if (!isTextInput && isMod && e.shiftKey && key === 'z') {
      e.preventDefault();
      this.editorFacade.redo();
      return;
    }

    // Ctrl/Cmd+S -> save to server (allow even inside inputs; prevent browser save dialog)
    if (isMod && key === 's') {
      e.preventDefault();
      const projectId = this.editorFacade.getActiveProjectId();
      this.editorFacade.saveToServer().subscribe({
        next: () => console.log('[Shortcuts] Saved to server:', projectId),
        error: (err) => console.warn('[Shortcuts] Save to server failed:', err),
      });
    }
  }
}
