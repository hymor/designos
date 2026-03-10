import { AsyncPipe } from '@angular/common';
import { Component, HostListener, OnDestroy, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { ToastService } from '../../../core/services/toast.service';
import { TableCreateModalService } from '../../../core/services/table-create-modal.service';
import { EditorFacadeService } from '../../../core/services/editor-facade.service';

@Component({
  selector: 'app-table-create-modal',
  standalone: true,
  imports: [AsyncPipe, FormsModule],
  template: `
    @if (visible$ | async) {
      <div class="table-create-modal" role="dialog" aria-label="Создать таблицу">
        <div class="table-create-ov" (click)="close()"></div>
        <div class="table-create-dialog" (click)="$event.stopPropagation()">
          <h2 class="table-create-title">Создать таблицу</h2>
          <div class="table-create-row">
            <label for="table-rows-input">Строк</label>
            <input
              type="number"
              id="table-rows-input"
              [(ngModel)]="rows"
              min="1"
              max="50"
              (keydown)="onRowsKeydown($event)"
            />
          </div>
          <div class="table-create-row">
            <label for="table-cols-input">Столбцов</label>
            <input
              type="number"
              id="table-cols-input"
              [(ngModel)]="cols"
              min="1"
              max="20"
              (keydown)="onColsKeydown($event)"
            />
          </div>
          <div class="table-create-actions">
            <button type="button" class="table-create-btn cancel" (click)="close()">Отмена</button>
            <button type="button" class="table-create-btn ok" (click)="onConfirm()">Создать</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [
    `
      :host {
        --tc-surface: var(--surface, #1c1c1e);
        --tc-surface2: var(--surface2, #242428);
        --tc-border: var(--border, #333338);
        --tc-text: var(--text, #e8e8ea);
        --tc-text2: var(--text2, #888890);
        --tc-text3: var(--text3, #4a4a52);
        --tc-accent: var(--accent, #7b61ff);
      }
      .table-create-modal {
        position: fixed;
        inset: 0;
        z-index: 1100;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .table-create-ov {
        position: absolute;
        inset: 0;
        background: rgba(0, 0, 0, 0.7);
        backdrop-filter: blur(6px);
      }
      .table-create-dialog {
        position: relative;
        background: var(--tc-surface);
        border: 1px solid var(--tc-border);
        border-radius: 14px;
        padding: 24px;
        width: 320px;
        max-width: 95vw;
        box-shadow: 0 24px 64px rgba(0, 0, 0, 0.7);
        display: flex;
        flex-direction: column;
        gap: 20px;
      }
      .table-create-title {
        font-size: 18px;
        font-weight: 700;
        color: var(--tc-text);
        margin: 0 0 4px 0;
        letter-spacing: 0.02em;
      }
      .table-create-row {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .table-create-row label {
        font-size: 13px;
        color: var(--tc-text2);
        font-weight: 500;
      }
      .table-create-row input {
        background: var(--tc-surface2);
        border: 1.5px solid var(--tc-border);
        border-radius: 8px;
        padding: 10px 12px;
        font-size: 15px;
        color: var(--tc-text);
        outline: none;
        transition: border-color 0.15s;
      }
      .table-create-row input:focus {
        border-color: var(--tc-accent);
      }
      .table-create-row input::-webkit-inner-spin-button,
      .table-create-row input::-webkit-outer-spin-button {
        opacity: 1;
      }
      .table-create-actions {
        display: flex;
        gap: 10px;
        justify-content: flex-end;
        margin-top: 4px;
      }
      .table-create-btn {
        height: 36px;
        padding: 0 18px;
        border-radius: 8px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: opacity 0.15s, background 0.15s;
      }
      .table-create-btn.cancel {
        background: var(--tc-surface2);
        border: 1.5px solid var(--tc-border);
        color: var(--tc-text2);
      }
      .table-create-btn.cancel:hover {
        background: var(--tc-surface2);
        filter: brightness(1.1);
        color: var(--tc-text);
      }
      .table-create-btn.ok {
        background: var(--tc-accent);
        border: none;
        color: #fff;
      }
      .table-create-btn.ok:hover {
        opacity: 0.9;
      }
    `,
  ],
})
export class TableCreateModalComponent implements OnDestroy {
  private readonly tableModal = inject(TableCreateModalService);
  private readonly toast = inject(ToastService);
  private readonly editorFacade = inject(EditorFacadeService);
  private readonly destroy$ = new Subject<void>();

  readonly visible$ = this.tableModal.visible$;
  isVisible = false;
  rows = 3;
  cols = 3;

  constructor() {
    this.tableModal.visible$.pipe(takeUntil(this.destroy$)).subscribe((v) => {
      this.isVisible = v;
      if (v) {
        this.rows = 3;
        this.cols = 3;
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  close(): void {
    this.tableModal.hide();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.isVisible) this.close();
  }

  onRowsKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter') document.getElementById('table-cols-input')?.focus();
  }

  onColsKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter') this.onConfirm();
    if (e.key === 'Escape') this.close();
  }

  onConfirm(): void {
    const r = Math.max(1, Math.min(50, Math.floor(Number(this.rows)) || 3));
    const c = Math.max(1, Math.min(20, Math.floor(Number(this.cols)) || 3));
    this.rows = r;
    this.cols = c;
    const api = typeof window !== 'undefined' ? (window as unknown as { __designosAPI?: { createTableAtCenter?: (rows: number, cols: number) => void } }).__designosAPI : null;
    if (api && typeof api.createTableAtCenter === 'function') {
      try {
        api.createTableAtCenter(r, c);
        this.editorFacade.refreshLayersList();
      } catch (e) {
        console.warn('[TableCreateModal] createTableAtCenter failed:', e);
        this.toast.show('Table creation failed', 'error');
      }
    } else {
      this.toast.show('Table creation is not connected to editor yet', 'info');
    }
    this.close();
  }
}
