import { Component } from '@angular/core';
import { EditorFacadeService, type EditorDocument } from '../../core/services/editor-facade.service';

/** Demo document for Load Doc (dev); legacy format (id, type, x, y, w, h + fill for render). */
const DEMO_DOC: EditorDocument = {
  version: 8,
  projId: 'demo-1',
  projName: 'Demo',
  nid: 3,
  frames: [],
  els: [
    { id: 'e1', type: 'rect', x: 80, y: 60, w: 120, h: 80, frameId: null, groupId: null, fill: '#7b61ff', stroke: 'none', strokeWidth: 0, opacity: 1 },
    { id: 'e2', type: 'rect', x: 220, y: 80, w: 100, h: 60, frameId: null, groupId: null, fill: '#3ecf8e', stroke: 'none', strokeWidth: 0, opacity: 1 },
  ],
  groups: [],
  components: [],
  rootOrder: ['e1', 'e2'],
  view: { zoom: 1, px: 0, py: 0 },
};

@Component({
  selector: 'app-toolbar',
  standalone: true,
  template: `
    <div class="toolbar">
      <span class="bridge-status" [class.unavailable]="!bridgeAvailable">Bridge: {{ bridgeAvailable ? 'available' : 'unavailable' }}</span>
      <button type="button" (click)="onRect()">Rect</button>
      <button type="button" (click)="onZoomIn()">Zoom +</button>
      <button type="button" (click)="onUndo()" title="Undo">Undo</button>
      <button type="button" (click)="onRedo()" title="Redo">Redo</button>
      <button type="button" class="dev-btn" (click)="onSaveDoc()" title="Save document to memory and log to console">Save Doc</button>
      <button type="button" class="dev-btn" (click)="onLoadDoc()" title="Load last saved or demo document">Load Doc</button>
      <button type="button" class="dev-btn" (click)="onSaveServer()" title="Save document to backend">Save Server</button>
      <button type="button" class="dev-btn" (click)="onLoadServer()" title="Load document from backend">Load Server</button>
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
      .toolbar button.dev-btn {
        font-size: 0.75rem;
        opacity: 0.85;
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
  /** Last document saved via Save Doc; Load Doc uses this when set. */
  private lastSavedDoc: EditorDocument | null = null;

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

  onUndo(): void {
    this.editorFacade.undo();
  }

  onRedo(): void {
    this.editorFacade.redo();
  }

  /** Dev: save current document to memory and log to console. */
  onSaveDoc(): void {
    const doc = this.editorFacade.getDocument();
    if (doc != null) {
      this.lastSavedDoc = doc;
      console.log(JSON.stringify(doc, null, 2));
    } else {
      console.warn('[Toolbar] getDocument returned null');
    }
  }

  /** Dev: load last saved document (after Save Doc) or demo document. */
  onLoadDoc(): void {
    const toLoad = this.lastSavedDoc ?? DEMO_DOC;
    this.editorFacade.loadDocument(toLoad);
  }

  /** Default project id for Save/Load Server (dev). */
  private get serverProjectId(): string {
    const doc = this.editorFacade.getDocument();
    return (doc?.projId as string) ?? 'default';
  }

  /** Save current document to backend. */
  onSaveServer(): void {
    const projectId = this.serverProjectId;
    this.editorFacade.saveToServer(projectId).subscribe({
      next: () => {
        console.log('[Toolbar] Saved to server:', projectId);
        console.log('[Toolbar] Проверка: GET http://localhost:3000/api/documents/' + projectId);
      },
      error: (err) => console.warn('[Toolbar] Save to server failed:', err),
    });
  }

  /** Load document from backend. */
  onLoadServer(): void {
    const projectId = this.serverProjectId;
    this.editorFacade.loadFromServer(projectId).subscribe({
      next: () => console.log('[Toolbar] Loaded from server:', projectId),
      error: (err) => console.warn('[Toolbar] Load from server failed:', err),
    });
  }
}
