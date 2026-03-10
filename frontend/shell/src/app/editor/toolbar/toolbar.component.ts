import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { combineLatest, map, of, startWith } from 'rxjs';
import { Router } from '@angular/router';
import { EditorFacadeService } from '../../core/services/editor-facade.service';

@Component({
  selector: 'app-toolbar',
  standalone: true,
  imports: [AsyncPipe],
  template: `
    <div id="topbar">
      <div class="logo" (click)="onLogoClick()" title="Projects">DesignOS</div>
      <span style="color:var(--border);font-size:13px;flex-shrink:0">/</span>
      <input
        id="proj-name-input"
        [value]="projectLabel$ | async"
        title="Project"
        style="background:transparent;border:none;border-bottom:1px solid transparent;color:var(--text2);font-size:12px;font-family:inherit;outline:none;min-width:60px;max-width:160px;cursor:pointer;padding:2px 4px;border-radius:4px"
        disabled
      />

      <input
        #projFile
        id="proj-input"
        type="file"
        accept=".designos,.json,application/json"
        style="display:none"
        (change)="onProjectFileSelected(projFile)"
      />
      <input
        #imgFile
        id="img-input"
        type="file"
        accept="image/*"
        style="display:none"
        (change)="onImageFileSelected(imgFile)"
      />

      <button class="tbtn on" id="t-select" title="Select (V)" type="button">
        <svg width="14" height="14" viewBox="0 0 14 14">
          <path d="M2.5 1.5l9 5.5-4.5 1-1.5 5z" fill="currentColor" />
        </svg>
      </button>

      <button class="tbtn" id="t-frame" title="Frame (F)" type="button" disabled>
        <svg width="14" height="14" viewBox="0 0 14 14">
          <rect x="1" y="1" width="12" height="12" rx="1" stroke="currentColor" stroke-width="1.5" fill="none" />
          <line x1="4" y1="1" x2="4" y2="13" stroke="currentColor" stroke-width="1" />
          <line x1="10" y1="1" x2="10" y2="13" stroke="currentColor" stroke-width="1" />
          <line x1="1" y1="4" x2="13" y2="4" stroke="currentColor" stroke-width="1" />
          <line x1="1" y1="10" x2="13" y2="10" stroke="currentColor" stroke-width="1" />
        </svg>
      </button>

      <button class="tbtn" id="t-rect" title="Rectangle (R)" type="button" (click)="onRect()">
        <svg width="13" height="13" viewBox="0 0 13 13">
          <rect x="1" y="1" width="11" height="11" rx="2" stroke="currentColor" stroke-width="1.5" fill="none" />
        </svg>
      </button>

      <button class="tbtn" id="t-ellipse" title="Ellipse (O)" type="button" disabled>
        <svg width="13" height="13" viewBox="0 0 13 13">
          <ellipse cx="6.5" cy="6.5" rx="5.5" ry="5.5" stroke="currentColor" stroke-width="1.5" fill="none" />
        </svg>
      </button>

      <button class="tbtn" id="t-line" title="Line (L)" type="button" disabled>
        <svg width="13" height="13" viewBox="0 0 13 13">
          <line x1="1.5" y1="11.5" x2="11.5" y2="1.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
        </svg>
      </button>

      <button class="tbtn" id="t-text" title="Text (T)" type="button" disabled>
        <svg width="13" height="13" viewBox="0 0 13 13">
          <path d="M1.5 3h10M6.5 3v7M4.5 10h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
        </svg>
      </button>

      <button class="tbtn" id="t-table" title="Table" type="button" disabled>
        <svg width="13" height="13" viewBox="0 0 13 13">
          <rect x="1" y="1" width="11" height="11" rx="1" stroke="currentColor" stroke-width="1.2" fill="none" />
          <line x1="4" y1="1" x2="4" y2="12" stroke="currentColor" stroke-width="1" />
          <line x1="8" y1="1" x2="8" y2="12" stroke="currentColor" stroke-width="1" />
          <line x1="1" y1="4" x2="12" y2="4" stroke="currentColor" stroke-width="1" />
          <line x1="1" y1="8" x2="12" y2="8" stroke="currentColor" stroke-width="1" />
        </svg>
      </button>

      <button class="tbtn" id="t-image" title="Image" type="button" disabled>
        <svg width="14" height="14" viewBox="0 0 14 14">
          <rect x="1" y="2" width="12" height="10" rx="1.5" stroke="currentColor" stroke-width="1.4" fill="none" />
          <circle cx="4.5" cy="5.5" r="1" fill="currentColor" />
          <path d="M1 10l3-3 2.5 2.5L9 7l4 4" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" fill="none" />
        </svg>
      </button>

      <button class="tbtn" id="t-eyedropper" title="Eyedropper (I)" type="button" disabled>
        <svg width="14" height="14" viewBox="0 0 14 14">
          <path d="M9.5 1.5a2 2 0 012.8 2.8L11 5.7 8.3 3l1.2-1.5z" fill="currentColor" opacity=".8" />
          <path d="M8.3 3L3.5 7.8l-.8 2.8 2.8-.8L10.3 5 8.3 3z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" fill="none" />
          <circle cx="2.8" cy="11.2" r="1.2" fill="currentColor" opacity=".5" />
        </svg>
      </button>

      <div class="tsep"></div>

      <button class="tbtn" id="t-pen" title="Pen (P)" type="button" disabled>
        <svg width="14" height="14" viewBox="0 0 14 14">
          <path d="M2 12L5 9M5 9L10.5 3.5a1.5 1.5 0 00-2-2L3 7M5 9l-1.5 1.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" fill="none" />
          <circle cx="10.5" cy="3.5" r="1" fill="currentColor" opacity=".6" />
        </svg>
      </button>

      <button class="tbtn" id="t-hand" title="Pan (H)" type="button" disabled>
        <svg width="14" height="14" viewBox="0 0 14 14">
          <path d="M5.5 2v5.5M8 3.5V7M10.5 5.5v3A4 4 0 016.5 12.5H6A4.5 4.5 0 011.5 8V7a1 1 0 012 0v1.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" fill="none" />
        </svg>
      </button>

      <div class="topbar-right">
        <div class="zoom-wrap">
          <button class="zbtn" id="z-out" type="button" (click)="onZoomOut()">−</button>
          <span id="zoom-val">{{ zoomText$ | async }}</span>
          <button class="zbtn" id="z-in" type="button" (click)="onZoomIn()">+</button>
        </div>

        <div class="tsep"></div>

        <button
          class="hbtn"
          [class.dim]="!bridgeAvailable"
          id="undo-btn"
          title="Undo (Ctrl+Z)"
          type="button"
          [disabled]="!bridgeAvailable"
          (click)="onUndo()"
        >
          ↩ Undo
        </button>
        <button
          class="hbtn"
          [class.dim]="!bridgeAvailable"
          id="redo-btn"
          title="Redo (Ctrl+Y)"
          type="button"
          [disabled]="!bridgeAvailable"
          (click)="onRedo()"
        >
          ↪ Redo
        </button>

        <div class="tsep"></div>

        <button class="hbtn active dim" id="snap-btn" title="Snap to grid (G)" type="button" disabled>⊞ Snap</button>

        <div class="tsep"></div>

        <button class="hbtn dim" id="cut-btn" title="Cut (Ctrl+X)" type="button" disabled>✂ Cut</button>
        <button class="hbtn dim" id="copy-btn" title="Copy (Ctrl+C)" type="button" disabled>⎘ Copy</button>
        <button class="hbtn dim" id="paste-btn" title="Paste (Ctrl+V)" type="button" disabled>⎗ Paste</button>

        <div class="tsep"></div>

        <button class="hbtn dim" id="group-btn" title="Group (Ctrl+G)" type="button" disabled>⊞ Group</button>
        <button class="hbtn dim" id="ungroup-btn" title="Ungroup (Ctrl+Shift+G)" type="button" disabled>⊟ Ungroup</button>
        <button class="hbtn dim" id="mask-btn" title="Make Mask" type="button" disabled>⬡ Mask</button>

        <div class="tsep"></div>

        <span id="save-status" class="save-status" title="Save status">
          <span
            id="save-status-icon"
            class="save-status-icon"
            [class.saving]="isSaving$ | async"
            title="Saving…"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
            </svg>
          </span>
          <span id="save-status-text" class="save-status-text">{{ saveStatusText$ | async }}</span>
        </span>

        <button
          class="hbtn"
          [class.dim]="!bridgeAvailable"
          id="save-btn"
          type="button"
          [disabled]="!bridgeAvailable"
          (click)="onSaveServer()"
        >
          💾 Save
        </button>

        <button
          class="hbtn"
          [class.dim]="!bridgeAvailable"
          id="load-btn"
          type="button"
          [disabled]="!bridgeAvailable"
          (click)="onLoadServer()"
        >
          📂 Open
        </button>

        <button class="exp-btn" id="exp-btn" type="button" (click)="onExportPlaceholder()">↓ Export</button>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        --bg: #111112;
        --surface: #1c1c1e;
        --surface2: #242428;
        --surface3: #2c2c30;
        --border: #333338;
        --text: #e8e8ea;
        --text2: #888890;
        --text3: #4a4a52;
        --accent: #7b61ff;
        --green: #3ecf8e;
        --topbar: 48px;
      }

      #topbar {
        position: sticky;
        top: 0;
        left: 0;
        right: 0;
        height: var(--topbar);
        background: var(--surface);
        border-bottom: 1px solid var(--border);
        display: flex;
        align-items: center;
        gap: 3px;
        padding: 0 8px;
        z-index: 100;
        overflow-x: auto;
        color: var(--text);
        user-select: none;
      }
      #topbar::-webkit-scrollbar {
        display: none;
      }
      .logo {
        font-size: 13px;
        font-weight: 700;
        color: var(--accent);
        padding-right: 10px;
        border-right: 1px solid var(--border);
        margin-right: 4px;
        white-space: nowrap;
        flex-shrink: 0;
        cursor: pointer;
      }
      .logo:hover {
        color: var(--text);
      }
      .tbtn {
        width: 34px;
        height: 34px;
        border: none;
        border-radius: 7px;
        background: transparent;
        color: var(--text2);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      .tbtn:hover {
        background: var(--surface3);
        color: var(--text);
      }
      .tbtn.on {
        background: var(--accent);
        color: #fff;
      }
      .tbtn:disabled {
        opacity: 0.35;
        cursor: default;
      }
      .tbtn:disabled:hover {
        background: transparent;
        color: var(--text2);
      }
      .tsep {
        width: 1px;
        height: 24px;
        background: var(--border);
        margin: 0 3px;
        flex-shrink: 0;
      }
      .topbar-right {
        margin-left: auto;
        display: flex;
        align-items: center;
        gap: 5px;
        flex-shrink: 0;
      }
      .zoom-wrap {
        display: flex;
        align-items: center;
        gap: 2px;
        background: var(--surface2);
        border: 1px solid var(--border);
        border-radius: 6px;
        padding: 2px 6px;
      }
      .zbtn {
        background: none;
        border: none;
        color: var(--text2);
        cursor: pointer;
        font-size: 18px;
        line-height: 1;
        padding: 0 2px;
      }
      .zbtn:hover {
        color: var(--text);
      }
      #zoom-val {
        min-width: 36px;
        text-align: center;
        font-size: 11px;
        color: var(--text2);
      }
      .save-status {
        font-size: 10px;
        color: var(--text3);
        margin: 0 6px;
        flex-shrink: 0;
        min-width: 44px;
        width: 44px;
        text-align: center;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
      }
      .save-status-icon {
        display: none;
        align-items: center;
        justify-content: center;
      }
      .save-status-icon.saving {
        display: inline-flex;
      }
      .save-status-icon svg {
        width: 14px;
        height: 14px;
        opacity: 0.9;
      }
      .save-status-text {
        display: inline-block;
      }
      .hbtn {
        height: 28px;
        padding: 0 9px;
        border: 1px solid var(--border);
        border-radius: 6px;
        background: var(--surface2);
        color: var(--text2);
        font-size: 11px;
        font-weight: 500;
        cursor: pointer;
        white-space: nowrap;
        flex-shrink: 0;
      }
      .hbtn:hover {
        background: var(--surface3);
        color: var(--text);
      }
      .hbtn.active {
        background: rgba(62, 207, 142, 0.15);
        border-color: var(--green);
        color: var(--green);
      }
      .hbtn.dim {
        opacity: 0.35;
        pointer-events: none;
      }
      .exp-btn {
        height: 28px;
        padding: 0 10px;
        background: var(--accent);
        border: none;
        border-radius: 6px;
        color: #fff;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        white-space: nowrap;
      }
      .exp-btn:hover {
        opacity: 0.85;
      }
    `,
  ],
})
export class ToolbarComponent {
  private readonly editorFacade = inject(EditorFacadeService);
  private readonly router = inject(Router);

  readonly isSaving$ = this.editorFacade.isSaving$;

  readonly projectLabel$ = this.editorFacade.activeProjectId$.pipe(
    map((id) => id || 'default'),
    startWith('default'),
  );

  readonly zoomText$ = of('100%');

  readonly saveStatus$ = combineLatest([
    this.editorFacade.isSaving$,
    this.editorFacade.hasUnsavedChanges$,
    this.editorFacade.lastSaveSuccess$,
  ]).pipe(
    map(([isSaving, dirty, lastOk]) => {
      if (isSaving) return 'Saving...';
      if (lastOk === false) return 'Save failed';
      if (dirty) return 'Unsaved changes';
      if (lastOk === true) return 'Saved';
      return 'Saved';
    }),
    startWith('Saved'),
  );

  readonly saveStatusText$ = combineLatest([
    this.editorFacade.isSaving$,
    this.editorFacade.hasUnsavedChanges$,
    this.editorFacade.lastSaveSuccess$,
  ]).pipe(
    map(([isSaving, dirty, lastOk]) => {
      if (isSaving) return '';
      if (lastOk === true && !dirty) return 'Saved';
      return '';
    }),
    startWith(''),
  );

  get bridgeAvailable(): boolean {
    return this.editorFacade.isBridgeAvailable();
  }

  onLogoClick(): void {
    this.router.navigate(['/projects']);
  }

  onRect(): void {
    this.editorFacade.addRectangle();
  }

  onZoomIn(): void {
    this.editorFacade.zoomIn();
  }

  onZoomOut(): void {
    this.editorFacade.zoomOut();
  }

  onUndo(): void {
    this.editorFacade.undo();
  }

  onRedo(): void {
    this.editorFacade.redo();
  }

  /** Default project id for Save/Load Server (dev). */
  private get serverProjectId(): string {
    return this.editorFacade.getActiveProjectId();
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

  onProjectFileSelected(input: HTMLInputElement): void {
    const file = input.files?.[0];
    if (!file) return;
    console.log('[Toolbar] Project file selected (placeholder):', file.name);
    input.value = '';
  }

  onImageFileSelected(input: HTMLInputElement): void {
    const file = input.files?.[0];
    if (!file) return;
    console.log('[Toolbar] Image file selected (placeholder):', file.name);
    input.value = '';
  }

  onExportPlaceholder(): void {
    console.log('[Toolbar] Export is not implemented in Angular UI yet.');
  }
}
