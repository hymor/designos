import { Injectable } from '@angular/core';
import { BehaviorSubject, type Observable } from 'rxjs';

export interface EditorSelection {
  ids: string[];
  primary: string | null;
}

export interface EditorElementProperties {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface EditorBridgeApi {
  init(canvas: HTMLElement | HTMLCanvasElement | null): void;
  addRectangle(): void;
  deleteSelected(): void;
  zoomIn(): void;
  zoomOut(): void;
  getSelection(): EditorSelection;
  getElementProperties?(id: string): EditorElementProperties | null;
  on?(eventName: string, callback: (payload: EditorSelection) => void): void;
}

declare global {
  interface Window {
    editorBridge?: EditorBridgeApi;
  }
}

const emptySelection: EditorSelection = { ids: [], primary: null };
const BRIDGE_UNAVAILABLE_MSG = '[EditorFacade] window.editorBridge is not available.';

@Injectable({
  providedIn: 'root',
})
export class EditorFacadeService {
  private readonly selectionSubject = new BehaviorSubject<EditorSelection>(emptySelection);
  readonly selection$: Observable<EditorSelection> = this.selectionSubject.asObservable();

  private get bridge(): EditorBridgeApi | undefined {
    return typeof window !== 'undefined' ? window.editorBridge : undefined;
  }

  /** Returns true if window.editorBridge is available and callable. */
  isBridgeAvailable(): boolean {
    const b = this.bridge;
    return b != null && typeof b.init === 'function';
  }

  /** Safe init: only runs if bridge is available; otherwise logs and no-op. */
  init(canvas: HTMLCanvasElement | HTMLElement | null): void {
    if (!this.isBridgeAvailable()) {
      console.warn(BRIDGE_UNAVAILABLE_MSG, 'init(canvas) skipped.');
      return;
    }
    try {
      this.bridge!.init(canvas ?? null);
      this.selectionSubject.next(this.getSelection());
      const onSelectionChanged = (payload: EditorSelection) => this.selectionSubject.next(payload);
      this.bridge!.on?.('selectionChanged', onSelectionChanged);
    } catch (e) {
      console.warn('[EditorFacade] init failed:', e);
    }
  }

  /** Safe addRectangle: no-op and warn if bridge unavailable. */
  addRectangle(): void {
    if (!this.isBridgeAvailable()) {
      console.warn(BRIDGE_UNAVAILABLE_MSG, 'addRectangle() skipped.');
      return;
    }
    try {
      this.bridge!.addRectangle();
    } catch (e) {
      console.warn('[EditorFacade] addRectangle failed:', e);
    }
  }

  /** Safe zoomIn: no-op and warn if bridge unavailable. */
  zoomIn(): void {
    if (!this.isBridgeAvailable()) {
      console.warn(BRIDGE_UNAVAILABLE_MSG, 'zoomIn() skipped.');
      return;
    }
    try {
      this.bridge!.zoomIn();
    } catch (e) {
      console.warn('[EditorFacade] zoomIn failed:', e);
    }
  }

  /** Safe getSelection: returns empty selection and warns if bridge unavailable. */
  getSelection(): EditorSelection {
    if (!this.isBridgeAvailable()) {
      return emptySelection;
    }
    try {
      return this.bridge!.getSelection() ?? emptySelection;
    } catch (e) {
      console.warn('[EditorFacade] getSelection failed:', e);
      return emptySelection;
    }
  }

  deleteSelected(): void {
    if (!this.isBridgeAvailable()) {
      console.warn(BRIDGE_UNAVAILABLE_MSG, 'deleteSelected() skipped.');
      return;
    }
    try {
      this.bridge!.deleteSelected();
    } catch (e) {
      console.warn('[EditorFacade] deleteSelected failed:', e);
    }
  }

  zoomOut(): void {
    if (!this.isBridgeAvailable()) {
      console.warn(BRIDGE_UNAVAILABLE_MSG, 'zoomOut() skipped.');
      return;
    }
    try {
      this.bridge!.zoomOut();
    } catch (e) {
      console.warn('[EditorFacade] zoomOut failed:', e);
    }
  }

  getElementProperties(id: string): EditorElementProperties | null {
    if (!this.isBridgeAvailable()) return null;
    try {
      return this.bridge!.getElementProperties?.(id) ?? null;
    } catch (e) {
      console.warn('[EditorFacade] getElementProperties failed:', e);
      return null;
    }
  }
}
