import { AsyncPipe } from '@angular/common';
import { Component, HostListener, computed, effect, inject, signal } from '@angular/core';
import { ContextMenuService } from '../../core/services/context-menu.service';
import { EditorFacadeService } from '../../core/services/editor-facade.service';

@Component({
  selector: 'app-context-menu',
  standalone: true,
  imports: [AsyncPipe],
  template: `
    @if (visible()) {
      <div
        class="obj-context-menu"
        [style.left.px]="x()"
        [style.top.px]="y()"
        role="menu"
      >
        @if (kind() === 'object') {
          <button
            type="button"
            class="obj-ctx-item"
            [disabled]="!canDelete()"
            (click)="onDelete()"
          >
            Delete
          </button>
          <button type="button" class="obj-ctx-item" (click)="onCopy()">Copy</button>
          <button type="button" class="obj-ctx-item" [disabled]="!canPaste()" (click)="onPaste()">
            Paste
          </button>
          <button
            type="button"
            class="obj-ctx-item"
            [disabled]="!canGroup()"
            (click)="onGroup()"
          >
            Group
          </button>
          <button
            type="button"
            class="obj-ctx-item"
            [disabled]="!canUngroup()"
            (click)="onUngroup()"
          >
            Ungroup
          </button>
        } @else {
          <button type="button" class="obj-ctx-item" [disabled]="!canPaste()" (click)="onPaste()">
            Paste
          </button>
          <button
            type="button"
            class="obj-ctx-item"
            [disabled]="!canPaste()"
            (click)="onPasteAtCenter()"
          >
            Paste at center
          </button>
        }
      </div>
    }
  `,
  styles: [
    `
      .obj-context-menu {
        position: fixed;
        z-index: 300;
        min-width: 160px;
        background: var(--surface2);
        border: 1px solid var(--border);
        border-radius: 8px;
        padding: 4px 0;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
      }
      .obj-ctx-item {
        display: flex;
        align-items: center;
        gap: 8px;
        width: 100%;
        padding: 8px 14px;
        border: none;
        background: transparent;
        color: var(--text);
        font-size: 12px;
        cursor: pointer;
        text-align: left;
        font-family: inherit;
      }
      .obj-ctx-item:hover {
        background: var(--surface3);
      }
      .obj-ctx-item:disabled {
        color: var(--text3);
        cursor: not-allowed;
        opacity: 0.7;
      }
      .obj-ctx-item:disabled:hover {
        background: transparent;
      }
    `,
  ],
})
export class ContextMenuComponent {
  private readonly svc = inject(ContextMenuService);
  private readonly editor = inject(EditorFacadeService);

  private readonly visibleSignal = signal(this.svc.current.visible);
  private readonly xSignal = signal(this.svc.current.x);
  private readonly ySignal = signal(this.svc.current.y);
  private readonly kindSignal = signal(this.svc.current.kind);

  readonly visible = computed(() => this.visibleSignal());
  readonly x = computed(() => this.xSignal());
  readonly y = computed(() => this.ySignal());
  readonly kind = computed(() => this.kindSignal());
  readonly canPaste = computed(() => {
    // For now rely on legacy clipboard state via global S.clipboard if present.
    const win = window as any;
    const S = win && win.S;
    return !!(S && Array.isArray(S.clipboard) && S.clipboard.length);
  });
  readonly canDelete = computed(() => {
    const sel = this.editor.getSelection();
    return !!(sel.ids && sel.ids.length);
  });
  readonly canGroup = computed(() => {
    const sel = this.editor.getSelection();
    return !!(sel.ids && sel.ids.length > 1);
  });
  readonly canUngroup = computed(() => {
    const sel = this.editor.getSelection();
    return !!(sel.ids && sel.ids.length);
  });

  constructor() {
    effect(() => {
      const s = this.svc.current;
      this.visibleSignal.set(s.visible);
      this.xSignal.set(s.x);
      this.ySignal.set(s.y);
      this.kindSignal.set(s.kind);
    });
  }

  @HostListener('document:click')
  onGlobalClick(): void {
    this.close();
  }

  @HostListener('document:keydown.escape')
  onEsc(): void {
    this.close();
  }

  close(): void {
    this.svc.close();
  }

  onDelete(): void {
    this.editor.deleteSelected();
    this.close();
  }

  onCopy(): void {
    const win = window as any;
    if (typeof win.copyItems === 'function') {
      win.copyItems();
    }
    this.close();
  }

  onPaste(): void {
    const win = window as any;
    if (typeof win.pasteItems === 'function') {
      win.pasteItems();
    }
    this.close();
  }

  onPasteAtCenter(): void {
    const win = window as any;
    if (typeof win.pasteItemsAtCenter === 'function') {
      win.pasteItemsAtCenter();
    } else if (typeof win.pasteItems === 'function') {
      win.pasteItems();
    }
    this.close();
  }

  onGroup(): void {
    const win = window as any;
    if (typeof win.groupSel === 'function') {
      win.groupSel();
    }
    this.close();
  }

  onUngroup(): void {
    const win = window as any;
    if (typeof win.ungroupSel === 'function') {
      win.ungroupSel();
    }
    this.close();
  }
}

