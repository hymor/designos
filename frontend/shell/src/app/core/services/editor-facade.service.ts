import { Injectable } from '@angular/core';
import { BehaviorSubject, type Observable } from 'rxjs';
import { bootstrapLegacyEditor } from '@designos/bootstrap-legacy-editor';

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
  updatePosition?(id: string, x: number, y: number): void;
  updateSize?(id: string, width: number, height: number): void;
  on?(eventName: string, callback: (payload: EditorSelection) => void): void;
}

declare global {
  interface Window {
    /** Optional debug fallback when bridge is not set via init(). */
    editorBridge?: EditorBridgeApi;
    /** Optional debug fallback; primary integration is direct import of bootstrapLegacyEditor. */
    bootstrapLegacyEditor?: (
      canvas: HTMLCanvasElement | HTMLElement | null,
      options?: { exposeOnWindow?: boolean }
    ) => EditorBridgeApi;
  }
}

const emptySelection: EditorSelection = { ids: [], primary: null };
const BRIDGE_UNAVAILABLE_MSG = '[EditorFacade] Editor bridge is not available.';

@Injectable({
  providedIn: 'root',
})
export class EditorFacadeService {
  private readonly selectionSubject = new BehaviorSubject<EditorSelection>(emptySelection);
  readonly selection$: Observable<EditorSelection> = this.selectionSubject.asObservable();

  /** Bridge created by init() via bootstrapLegacyEditor(canvas); primary source. */
  private bridgeInstance: EditorBridgeApi | null = null;

  /** Bridge: instance first, then window.editorBridge as optional debug fallback. */
  private get bridge(): EditorBridgeApi | undefined {
    if (this.bridgeInstance != null) return this.bridgeInstance;
    return typeof window !== 'undefined' ? window.editorBridge : undefined;
  }

  /** Store the bridge (e.g. for tests). init() creates bridge via bootstrapLegacyEditor when needed. */
  setBridge(bridge: EditorBridgeApi | null): void {
    this.bridgeInstance = bridge;
  }

  /** Returns true if a bridge (instance or window fallback) is available and callable. */
  isBridgeAvailable(): boolean {
    const b = this.bridge;
    return b != null && typeof b.init === 'function';
  }

  /**
   * Init editor on canvas. Creates bridge via bootstrapLegacyEditor(canvas) on first call;
   * reuses existing bridge on subsequent calls.
   */
  init(canvas: HTMLCanvasElement | HTMLElement | null): void {
    if (this.bridgeInstance != null) {
      console.log('[EditorFacade] reusing existing bridge');
      this._initBridge(canvas);
      return;
    }
    console.log('[EditorFacade] bootstrapping editor...');
    try {
      const bridge = bootstrapLegacyEditor(canvas ?? null, { exposeOnWindow: false });
      this.bridgeInstance = bridge;
      console.log('[EditorFacade] bridge created:', bridge != null ? 'ok' : 'null');
      this._initBridge(canvas);
    } catch (e) {
      console.warn('[EditorFacade] bootstrap failed:', e);
    }
  }

  private _initBridge(canvas: HTMLCanvasElement | HTMLElement | null): void {
    if (!this.bridge) return;
    try {
      this.bridge.init(canvas ?? null);
      // Sync selection state and subscribe: legacy calls __designosAPI.onSelectionChange → bridge emits 'selectionChanged'
      this.selectionSubject.next(this.getSelection());
      const onSelectionChanged = (payload: EditorSelection) => this.selectionSubject.next(payload);
      this.bridge.on?.('selectionChanged', onSelectionChanged);
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

  /** Safe getSelection: returns empty selection if bridge unavailable. */
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

  /** Update element position; canvas redraws, selection stays. */
  updatePosition(id: string, x: number, y: number): void {
    if (!this.isBridgeAvailable()) {
      console.warn(BRIDGE_UNAVAILABLE_MSG, 'updatePosition() skipped.');
      return;
    }
    try {
      this.bridge!.updatePosition?.(id, x, y);
      this.selectionSubject.next(this.getSelection());
    } catch (e) {
      console.warn('[EditorFacade] updatePosition failed:', e);
    }
  }

  /** Update element size; canvas redraws, selection stays. */
  updateSize(id: string, width: number, height: number): void {
    if (!this.isBridgeAvailable()) {
      console.warn(BRIDGE_UNAVAILABLE_MSG, 'updateSize() skipped.');
      return;
    }
    try {
      this.bridge!.updateSize?.(id, width, height);
      this.selectionSubject.next(this.getSelection());
    } catch (e) {
      console.warn('[EditorFacade] updateSize failed:', e);
    }
  }
}
