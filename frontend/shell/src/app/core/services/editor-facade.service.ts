import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of, switchMap, throwError, combineLatest } from 'rxjs';
import { catchError, debounceTime, filter, finalize, tap } from 'rxjs/operators';
import { bootstrapLegacyEditor } from '@designos/bootstrap-legacy-editor';
import { EditorApiService } from './editor-api.service';

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
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  rx?: number;
}

export interface EditorSceneItem {
  id: string;
  type: string;
}

/** One layer row from legacy getLayersItems (tree order, with depth and fold). */
export interface LayerItem {
  id: string;
  name: string;
  type: string;
  depth: number;
  isFrame: boolean;
  isGroup: boolean;
  hasChildren: boolean;
  collapsed: boolean;
  locked?: boolean;
}

/** Legacy document format: roundtrip-safe for getDocument/loadDocument. */
export interface EditorDocument {
  version: number;
  projId?: string | null;
  projName?: string;
  nid: number;
  frames: unknown[];
  els: unknown[];
  groups: unknown[];
  components?: unknown[];
  rootOrder?: string[];
  view?: { zoom: number; px: number; py: number };
}

export type EditorToolId = 'select' | 'frame' | 'rect' | 'ellipse' | 'line' | 'text' | 'table' | 'image' | 'eyedropper' | 'pen' | 'hand';

/** Payload for eyedropper badge (from legacy edBadgeUpdate). */
export interface EyedropperBadgeState {
  left: number;
  top: number;
  hex: string | null;
  hint: string;
}

export interface EditorBridgeApi {
  init(canvas: HTMLElement | HTMLCanvasElement | null): void;
  addRectangle(): void;
  deleteSelected(): void;
  selectElement?(id: string, additive?: boolean): void;
  zoomIn(): void;
  zoomOut(): void;
  getSelection(): EditorSelection;
  getElementProperties?(id: string): EditorElementProperties | null;
  updatePosition?(id: string, x: number, y: number): void;
  updateSize?(id: string, width: number, height: number): void;
  alignLeft?(): void;
  alignCenter?(): void;
  alignRight?(): void;
  alignTop?(): void;
  alignMiddle?(): void;
  alignBottom?(): void;
  distributeHorizontal?(): void;
  distributeVertical?(): void;
  getDocument?(): EditorDocument | null;
  loadDocument?(doc: EditorDocument | string): void;
  undo?(): void;
  redo?(): void;
  on?(eventName: string, callback: (payload: unknown) => void): void;
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

  private readonly sceneItemsSubject = new BehaviorSubject<EditorSceneItem[]>([]);
  readonly sceneItems$: Observable<EditorSceneItem[]> = this.sceneItemsSubject.asObservable();

  private readonly bridgeReadySubject = new BehaviorSubject<boolean>(false);
  readonly bridgeReady$: Observable<boolean> = this.bridgeReadySubject.asObservable();

  private readonly activeProjectIdSubject = new BehaviorSubject<string>('default');
  readonly activeProjectId$: Observable<string> = this.activeProjectIdSubject.asObservable();

  /** Current project display name (from legacy/getDocument). Synced on load and rename. */
  private readonly projectNameSubject = new BehaviorSubject<string>('Untitled');
  readonly projectName$: Observable<string> = this.projectNameSubject.asObservable();

  private readonly hasUnsavedChangesSubject = new BehaviorSubject<boolean>(false);
  readonly hasUnsavedChanges$: Observable<boolean> = this.hasUnsavedChangesSubject.asObservable();

  private readonly isSavingSubject = new BehaviorSubject<boolean>(false);
  readonly isSaving$: Observable<boolean> = this.isSavingSubject.asObservable();

  private readonly lastSaveSuccessSubject = new BehaviorSubject<boolean | null>(null);
  readonly lastSaveSuccess$: Observable<boolean | null> = this.lastSaveSuccessSubject.asObservable();

  private readonly lastSaveErrorSubject = new BehaviorSubject<string | null>(null);
  readonly lastSaveError$: Observable<string | null> = this.lastSaveErrorSubject.asObservable();

  private readonly activeToolSubject = new BehaviorSubject<EditorToolId>('select');
  readonly activeTool$: Observable<EditorToolId> = this.activeToolSubject.asObservable();

  /** Eyedropper badge: payload when visible, null when hidden. Set by legacy via bridge events. */
  private readonly eyedropperBadgeSubject = new BehaviorSubject<EyedropperBadgeState | null>(null);
  readonly eyedropperBadge$: Observable<EyedropperBadgeState | null> =
    this.eyedropperBadgeSubject.asObservable();

  private readonly layersListSubject = new BehaviorSubject<LayerItem[]>([]);
  readonly layersList$: Observable<LayerItem[]> = this.layersListSubject.asObservable();

  /** Bridge created by init() via bootstrapLegacyEditor(canvas); primary source. */
  private bridgeInstance: EditorBridgeApi | null = null;

  constructor(private readonly editorApi: EditorApiService) {
    this.startAutosave();
  }

  /** Autosave: when dirty and bridge ready, debounce 5s then save to server. */
  private startAutosave(): void {
    combineLatest([this.hasUnsavedChanges$, this.bridgeReady$]).pipe(
      filter(([dirty, ready]) => !!ready && !!dirty),
      debounceTime(5000),
      switchMap(() =>
        this.saveToServer(this.getActiveProjectId()).pipe(
          catchError((err) => {
            if (typeof console !== 'undefined' && console.warn) {
              console.warn('[EditorFacade] Autosave failed:', err);
            }
            return of(null);
          }),
        ),
      ),
    ).subscribe();
  }

  setActiveProjectId(projectId: string): void {
    const id = (projectId || '').trim() || 'default';
    this.activeProjectIdSubject.next(id);
  }

  getActiveProjectId(): string {
    return this.activeProjectIdSubject.value || 'default';
  }

  /** Rename current project in engine (legacy) and sync projectName$. */
  renameProject(name: string): void {
    const trimmed = (name || '').trim() || 'Untitled';
    const api = this.designosAPI;
    if (api && typeof api.renameProject === 'function') {
      try {
        api.renameProject(trimmed);
      } catch (e) {
        console.warn('[EditorFacade] renameProject failed:', e);
      }
    }
    this.projectNameSubject.next(trimmed);
  }

  /** Current project name from engine (e.g. after load). */
  getProjectName(): string {
    const api = this.designosAPI;
    if (api && typeof api.getProjName === 'function') {
      try {
        return api.getProjName() || 'Untitled';
      } catch (e) {
        console.warn('[EditorFacade] getProjName failed:', e);
      }
    }
    const doc = this.getDocument();
    return (doc && (doc as any).projName) || 'Untitled';
  }

  /** Sync projectName$ from engine (e.g. after legacy import from file). */
  syncProjectNameFromEngine(): void {
    this.projectNameSubject.next(this.getProjectName());
  }

  /** Bridge: instance first, then window.editorBridge as optional debug fallback. */
  private get bridge(): EditorBridgeApi | undefined {
    if (this.bridgeInstance != null) return this.bridgeInstance;
    return typeof window !== 'undefined' ? window.editorBridge : undefined;
  }

  /** Store the bridge (e.g. for tests). init() creates bridge via bootstrapLegacyEditor when needed. */
  setBridge(bridge: EditorBridgeApi | null): void {
    this.bridgeInstance = bridge;
  }

  getActiveTool(): EditorToolId {
    return this.activeToolSubject.value;
  }

  setActiveTool(tool: EditorToolId): void {
    this.activeToolSubject.next(tool);
    const api = this.designosAPI;
    const setToolFn =
      api && typeof api.setTool === 'function'
        ? api.setTool.bind(api)
        : typeof window !== 'undefined' && typeof (window as any).setTool === 'function'
          ? (window as any).setTool
          : null;
    if (!setToolFn) {
      console.warn('[EditorFacade] Tool change not wired to engine yet:', tool);
      return;
    }
    try {
      setToolFn(tool);
    } catch (e) {
      console.warn('[EditorFacade] setTool failed for', tool, e);
    }
  }

  /** Returns true if a bridge (instance or window fallback) is available and callable. */
  isBridgeAvailable(): boolean {
    const b = this.bridge;
    return b != null && typeof b.init === 'function';
  }

  private get designosAPI(): any {
    return typeof window !== 'undefined' ? (window as any).__designosAPI : null;
  }

  /** Refresh layers list from engine (getLayersItems). Call after rename/lock/collapse. */
  refreshLayersList(): void {
    this._refreshLayersList();
  }

  private _refreshLayersList(): void {
    const api = this.designosAPI;
    if (!api || typeof api.getLayersItems !== 'function') {
      this.layersListSubject.next([]);
      return;
    }
    try {
      const raw = api.getLayersItems() as any[];
      const list: LayerItem[] = (raw || []).map((item: any) => {
        const obj = item.obj || {};
        const isF = item.type === 'frame';
        const isG = item.type === 'group';
        const hasKids =
          (isF && obj.children && obj.children.length > 0) ||
          (isG && obj.children && obj.children.length > 0);
        const collapsed = isF && hasKids && !!api.S?.collapsedFrames?.[obj.id]
          || isG && hasKids && !!api.S?.collapsedGroups?.[obj.id];
        return {
          id: obj.id || '',
          name: obj.name != null ? String(obj.name) : obj.type || 'Layer',
          type: obj.type || item.type || 'item',
          depth: item.depth ?? 0,
          isFrame: isF,
          isGroup: isG,
          hasChildren: !!hasKids,
          collapsed: !!collapsed,
          locked: obj.locked === true,
        };
      });
      this.layersListSubject.next(list);
    } catch (e) {
      console.warn('[EditorFacade] getLayersItems failed:', e);
      this.layersListSubject.next([]);
    }
  }

  renameLayer(id: string, name: string): void {
    const api = this.designosAPI;
    if (api && typeof api.renameLayer === 'function') {
      api.renameLayer(id, name);
      this._refreshLayersList();
    }
  }

  setLayerLocked(id: string, locked: boolean): void {
    const api = this.designosAPI;
    if (api && typeof api.setLayerLocked === 'function') {
      api.setLayerLocked(id, locked);
      this._refreshLayersList();
    }
  }

  toggleLayerCollapsed(id: string): void {
    const api = this.designosAPI;
    if (api && typeof api.toggleLayerCollapsed === 'function') {
      api.toggleLayerCollapsed(id);
      this._refreshLayersList();
    }
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
      this.bridgeReadySubject.next(true);
      // Sync selection state and subscribe: legacy calls __designosAPI.onSelectionChange → bridge emits 'selectionChanged'
      this.selectionSubject.next(this.getSelection());
      this.refreshSceneItems();
      const onSelectionChanged = (payload: EditorSelection) => this.selectionSubject.next(payload);
      const onSelectionChangedWithScene = (payload: unknown) => {
        onSelectionChanged(payload as EditorSelection);
        this.refreshSceneItems();
      };
      this.bridge.on?.('selectionChanged', onSelectionChangedWithScene);
      this.bridge.on?.('eyedropperBadge', (payload: unknown) =>
        this.eyedropperBadgeSubject.next(payload as EyedropperBadgeState),
      );
      this.bridge.on?.('eyedropperBadgeHide', () => this.eyedropperBadgeSubject.next(null));
      this.bridge.on?.('documentChanged', () => this.markDirty());
    } catch (e) {
      console.warn('[EditorFacade] init failed:', e);
    }
  }

  /** Public: return current scene items (safe). */
  getSceneItems(): EditorSceneItem[] {
    const docAny = this.getDocument() as unknown as any;
    if (!docAny) return [];

    const coerce = (raw: any, fallbackType: string): EditorSceneItem | null => {
      if (!raw || typeof raw !== 'object') return null;
      const id = typeof raw.id === 'string' ? raw.id : null;
      if (!id) return null;
      const t = typeof raw.type === 'string' && raw.type ? raw.type : fallbackType;
      return { id, type: t };
    };

    const addMany = (arr: any, fallbackType: string, out: EditorSceneItem[]) => {
      if (!Array.isArray(arr)) return;
      for (let i = 0; i < arr.length; i++) {
        const item = coerce(arr[i], fallbackType);
        if (item) out.push(item);
      }
    };

    // Preferred legacy shape (used by save/load + toolbar demo).
    const legacyItems: EditorSceneItem[] = [];
    addMany(docAny.frames, 'frame', legacyItems);
    addMany(docAny.groups, 'group', legacyItems);

    // If rootOrder exists, follow it for els/groups where possible.
    if (Array.isArray(docAny.els)) {
      const byId = new Map<string, EditorSceneItem>();
      for (let i = 0; i < docAny.els.length; i++) {
        const item = coerce(docAny.els[i], 'item');
        if (item) byId.set(item.id, item);
      }
      if (Array.isArray(docAny.rootOrder) && docAny.rootOrder.length > 0) {
        for (let i = 0; i < docAny.rootOrder.length; i++) {
          const id = docAny.rootOrder[i];
          if (typeof id !== 'string') continue;
          const it = byId.get(id);
          if (it) legacyItems.push(it);
        }
        // Append any not in rootOrder.
        for (const it of byId.values()) {
          if (!legacyItems.some((x) => x.id === it.id)) legacyItems.push(it);
        }
      } else {
        legacyItems.push(...byId.values());
      }
    }

    if (legacyItems.length > 0) return legacyItems;

    // Fallback engine snapshot shape: { pages: [{ objects: [...] }], activePageId }
    const pages = Array.isArray(docAny.pages) ? docAny.pages : [];
    const activeId = typeof docAny.activePageId === 'string' ? docAny.activePageId : null;
    const activePage = (activeId && pages.find((p: any) => p && p.id === activeId)) || pages[0] || null;
    const objects = activePage && Array.isArray(activePage.objects) ? activePage.objects : [];
    const out: EditorSceneItem[] = [];
    addMany(objects, 'item', out);
    return out;
  }

  private refreshSceneItems(): void {
    this.sceneItemsSubject.next(this.getSceneItems());
    this._refreshLayersList();
  }

  private markDirty(): void {
    this.hasUnsavedChangesSubject.next(true);
    // any new change invalidates "saved" state
    if (this.lastSaveSuccessSubject.value !== null) this.lastSaveSuccessSubject.next(null);
    if (this.lastSaveErrorSubject.value !== null) this.lastSaveErrorSubject.next(null);
  }

  private markClean(): void {
    this.hasUnsavedChangesSubject.next(false);
  }

  /** Safe addRectangle: no-op and warn if bridge unavailable. */
  addRectangle(): void {
    if (!this.isBridgeAvailable()) {
      console.warn(BRIDGE_UNAVAILABLE_MSG, 'addRectangle() skipped.');
      return;
    }
    try {
      this.bridge!.addRectangle();
      this.refreshSceneItems();
      this.markDirty();
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

  /** Export selected objects as PNG (legacy exportSelectedAsPng). */
  exportSelected(): void {
    const api = this.designosAPI;
    if (!api || typeof api.exportSelectedAsPng !== 'function') {
      console.warn('[EditorFacade] exportSelectedAsPng not available.');
      return;
    }
    try {
      api.exportSelectedAsPng();
    } catch (e) {
      console.warn('[EditorFacade] exportSelected failed:', e);
    }
  }

  /** Export whole document as one PNG (legacy exportDocumentAsPng). */
  exportDocumentAsPng(): void {
    const api = this.designosAPI;
    if (!api || typeof api.exportDocumentAsPng !== 'function') {
      console.warn('[EditorFacade] exportDocumentAsPng not available.');
      return;
    }
    try {
      api.exportDocumentAsPng();
    } catch (e) {
      console.warn('[EditorFacade] exportDocumentAsPng failed:', e);
    }
  }

  /** Export document as JSON file (download). */
  exportDocumentAsJson(): void {
    const doc = this.getDocument();
    if (doc == null) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('[EditorFacade] No document to export as JSON.');
      }
      return;
    }
    try {
      const json = JSON.stringify(doc, null, 2);
      const name = (this.getProjectName() || 'document').replace(/[^\w\-.]/g, '_') + '.json';
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.download = name;
      a.href = url;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('[EditorFacade] exportDocumentAsJson failed:', e);
      }
    }
  }

  /** Export whole document as JPG (legacy exportDocumentAsJpg). */
  exportDocumentAsJpg(): void {
    const api = this.designosAPI;
    if (!api || typeof api.exportDocumentAsJpg !== 'function') {
      console.warn('[EditorFacade] exportDocumentAsJpg not available.');
      return;
    }
    try {
      api.exportDocumentAsJpg();
    } catch (e) {
      console.warn('[EditorFacade] exportDocumentAsJpg failed:', e);
    }
  }

  /** Export project as .designos file (for backup / re-import). */
  exportProject(): void {
    const doc = this.getDocument();
    if (doc == null) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('[EditorFacade] No document to export.');
      }
      return;
    }
    try {
      const json = JSON.stringify(doc);
      const name = (this.getProjectName() || 'project').replace(/[^\w\-.]/g, '_') + '.designos';
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.download = name;
      a.href = url;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('[EditorFacade] exportProject failed:', e);
      }
    }
  }

  /** Add image to canvas from data URL (center of viewport). Legacy addImageFromDataUrl. */
  addImageFromDataUrl(dataUrl: string): void {
    const api = this.designosAPI;
    if (!api || typeof api.addImageFromDataUrl !== 'function') {
      console.warn('[EditorFacade] addImageFromDataUrl not available.');
      return;
    }
    try {
      api.addImageFromDataUrl(dataUrl);
      this.selectionSubject.next(this.getSelection());
      this.refreshSceneItems();
      this.markDirty();
    } catch (e) {
      console.warn('[EditorFacade] addImageFromDataUrl failed:', e);
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
      this.refreshSceneItems();
      this.markDirty();
    } catch (e) {
      console.warn('[EditorFacade] deleteSelected failed:', e);
    }
  }

  /** Cut selection to clipboard (same as Ctrl+X). */
  cut(): void {
    const api = this.designosAPI;
    if (!api || typeof api.cutItems !== 'function') {
      console.warn('[EditorFacade] cutItems not available.');
      return;
    }
    try {
      api.cutItems();
      this.selectionSubject.next(this.getSelection());
      this.refreshSceneItems();
      this.markDirty();
    } catch (e) {
      console.warn('[EditorFacade] cut failed:', e);
    }
  }

  /** Copy selection to clipboard (same as Ctrl+C). */
  copy(): void {
    const api = this.designosAPI;
    if (!api || typeof api.copyItems !== 'function') {
      console.warn('[EditorFacade] copyItems not available.');
      return;
    }
    try {
      api.copyItems();
    } catch (e) {
      console.warn('[EditorFacade] copy failed:', e);
    }
  }

  /** Paste from clipboard (same as Ctrl+V). */
  paste(): void {
    const api = this.designosAPI;
    if (!api || typeof api.pasteItems !== 'function') {
      console.warn('[EditorFacade] pasteItems not available.');
      return;
    }
    try {
      api.pasteItems();
      this.selectionSubject.next(this.getSelection());
      this.refreshSceneItems();
      this.markDirty();
    } catch (e) {
      console.warn('[EditorFacade] paste failed:', e);
    }
  }

  /** Group selection (same as Ctrl+G). */
  groupSelection(): void {
    const api = this.designosAPI;
    if (!api || typeof api.groupSel !== 'function') {
      console.warn('[EditorFacade] groupSel not available.');
      return;
    }
    try {
      api.groupSel();
      this.selectionSubject.next(this.getSelection());
      this.refreshSceneItems();
      this.markDirty();
    } catch (e) {
      console.warn('[EditorFacade] groupSelection failed:', e);
    }
  }

  /** Ungroup selection (same as Ctrl+Shift+G). */
  ungroupSelection(): void {
    const api = this.designosAPI;
    if (!api || typeof api.ungroupSel !== 'function') {
      console.warn('[EditorFacade] ungroupSel not available.');
      return;
    }
    try {
      api.ungroupSel();
      this.selectionSubject.next(this.getSelection());
      this.refreshSceneItems();
      this.markDirty();
    } catch (e) {
      console.warn('[EditorFacade] ungroupSelection failed:', e);
    }
  }

  /** Make mask from selection (same as Ctrl+M). */
  makeMask(): void {
    const api = this.designosAPI;
    if (!api || typeof api.makeMask !== 'function') {
      console.warn('[EditorFacade] makeMask not available.');
      return;
    }
    try {
      api.makeMask();
      this.selectionSubject.next(this.getSelection());
      this.refreshSceneItems();
      this.markDirty();
    } catch (e) {
      console.warn('[EditorFacade] makeMask failed:', e);
    }
  }

  /** Select a single element by id (syncs canvas -> properties -> layers). Additive = shift/ctrl add to selection. */
  selectElement(id: string, additive?: boolean): void {
    if (!this.isBridgeAvailable()) {
      console.warn(BRIDGE_UNAVAILABLE_MSG, 'selectElement() skipped.');
      return;
    }
    if (!id) return;
    try {
      this.bridge!.selectElement?.(id, !!additive);
      this.selectionSubject.next(this.getSelection());
      this.refreshSceneItems();
    } catch (e) {
      console.warn('[EditorFacade] selectElement failed:', e);
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
      this.refreshSceneItems();
      this.markDirty();
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
      this.refreshSceneItems();
      this.markDirty();
    } catch (e) {
      console.warn('[EditorFacade] updateSize failed:', e);
    }
  }

  alignLeft(): void {
    if (this.isBridgeAvailable()) {
      try {
        this.bridge!.alignLeft?.();
        this.selectionSubject.next(this.getSelection());
        this.refreshSceneItems();
        this.markDirty();
      } catch (e) {
        console.warn('[EditorFacade] alignLeft failed:', e);
      }
    }
  }
  alignCenter(): void {
    if (this.isBridgeAvailable()) {
      try {
        this.bridge!.alignCenter?.();
        this.selectionSubject.next(this.getSelection());
        this.refreshSceneItems();
        this.markDirty();
      } catch (e) {
        console.warn('[EditorFacade] alignCenter failed:', e);
      }
    }
  }
  alignRight(): void {
    if (this.isBridgeAvailable()) {
      try {
        this.bridge!.alignRight?.();
        this.selectionSubject.next(this.getSelection());
        this.refreshSceneItems();
        this.markDirty();
      } catch (e) {
        console.warn('[EditorFacade] alignRight failed:', e);
      }
    }
  }
  alignTop(): void {
    if (this.isBridgeAvailable()) {
      try {
        this.bridge!.alignTop?.();
        this.selectionSubject.next(this.getSelection());
        this.refreshSceneItems();
        this.markDirty();
      } catch (e) {
        console.warn('[EditorFacade] alignTop failed:', e);
      }
    }
  }
  alignMiddle(): void {
    if (this.isBridgeAvailable()) {
      try {
        this.bridge!.alignMiddle?.();
        this.selectionSubject.next(this.getSelection());
        this.refreshSceneItems();
        this.markDirty();
      } catch (e) {
        console.warn('[EditorFacade] alignMiddle failed:', e);
      }
    }
  }
  alignBottom(): void {
    if (this.isBridgeAvailable()) {
      try {
        this.bridge!.alignBottom?.();
        this.selectionSubject.next(this.getSelection());
        this.refreshSceneItems();
        this.markDirty();
      } catch (e) {
        console.warn('[EditorFacade] alignBottom failed:', e);
      }
    }
  }
  distributeHorizontal(): void {
    if (this.isBridgeAvailable()) {
      try {
        this.bridge!.distributeHorizontal?.();
        this.selectionSubject.next(this.getSelection());
        this.refreshSceneItems();
        this.markDirty();
      } catch (e) {
        console.warn('[EditorFacade] distributeHorizontal failed:', e);
      }
    }
  }
  distributeVertical(): void {
    if (this.isBridgeAvailable()) {
      try {
        this.bridge!.distributeVertical?.();
        this.selectionSubject.next(this.getSelection());
        this.refreshSceneItems();
        this.markDirty();
      } catch (e) {
        console.warn('[EditorFacade] distributeVertical failed:', e);
      }
    }
  }

  updateFill(id: string, value: string): void {
    const api = this.designosAPI;
    if (api && typeof api.updateItemFill === 'function') {
      api.updateItemFill(id, value);
      this.selectionSubject.next(this.getSelection());
      this.refreshSceneItems();
      this.markDirty();
    }
  }

  updateStroke(id: string, value: string): void {
    const api = this.designosAPI;
    if (api && typeof api.updateItemStroke === 'function') {
      api.updateItemStroke(id, value);
      this.selectionSubject.next(this.getSelection());
      this.refreshSceneItems();
      this.markDirty();
    }
  }

  updateStrokeWidth(id: string, value: number): void {
    const api = this.designosAPI;
    if (api && typeof api.updateItemStrokeWidth === 'function') {
      api.updateItemStrokeWidth(id, value);
      this.selectionSubject.next(this.getSelection());
      this.refreshSceneItems();
      this.markDirty();
    }
  }

  updateOpacity(id: string, value: number): void {
    const api = this.designosAPI;
    if (api && typeof api.updateItemOpacity === 'function') {
      api.updateItemOpacity(id, value);
      this.selectionSubject.next(this.getSelection());
      this.refreshSceneItems();
      this.markDirty();
    }
  }

  updateRadius(id: string, value: number): void {
    const api = this.designosAPI;
    if (api && typeof api.updateItemRadius === 'function') {
      api.updateItemRadius(id, value);
      this.selectionSubject.next(this.getSelection());
      this.refreshSceneItems();
      this.markDirty();
    }
  }

  /** Get current document as JSON-serializable object (legacy format). */
  getDocument(): EditorDocument | null {
    if (!this.isBridgeAvailable()) return null;
    try {
      return this.bridge!.getDocument?.() ?? null;
    } catch (e) {
      console.warn('[EditorFacade] getDocument failed:', e);
      return null;
    }
  }

  /** Load document; canvas redraws, selection state is cleared then updated. */
  loadDocument(doc: EditorDocument | string): void {
    if (!this.isBridgeAvailable()) {
      console.warn(BRIDGE_UNAVAILABLE_MSG, 'loadDocument() skipped.');
      return;
    }
    try {
      this.bridge!.loadDocument?.(doc);
      this.selectionSubject.next(this.getSelection());
      this.refreshSceneItems();
      const name =
        typeof doc === 'object' && doc && (doc as any).projName != null
          ? String((doc as any).projName)
          : this.getProjectName();
      this.projectNameSubject.next(name || 'Untitled');
      // New document becomes the baseline (clean) until user changes something.
      this.markClean();
      this.lastSaveSuccessSubject.next(null);
      this.lastSaveErrorSubject.next(null);
    } catch (e) {
      console.warn('[EditorFacade] loadDocument failed:', e);
    }
  }

  /** Undo last action; canvas and selection update. */
  undo(): void {
    if (!this.isBridgeAvailable()) {
      console.warn(BRIDGE_UNAVAILABLE_MSG, 'undo() skipped.');
      return;
    }
    try {
      this.bridge!.undo?.();
      this.selectionSubject.next(this.getSelection());
      this.refreshSceneItems();
      this.markDirty();
    } catch (e) {
      console.warn('[EditorFacade] undo failed:', e);
    }
  }

  /** Redo last undone action; canvas and selection update. */
  redo(): void {
    if (!this.isBridgeAvailable()) {
      console.warn(BRIDGE_UNAVAILABLE_MSG, 'redo() skipped.');
      return;
    }
    try {
      this.bridge!.redo?.();
      this.selectionSubject.next(this.getSelection());
      this.refreshSceneItems();
      this.markDirty();
    } catch (e) {
      console.warn('[EditorFacade] redo failed:', e);
    }
  }

  /** Save current document to server. Uses getDocument() and EditorApiService. */
  saveToServer(projectId?: string): Observable<{ id: string; saved: boolean }> {
    const effectiveProjectId = (projectId ?? this.getActiveProjectId()) || 'default';
    const doc = this.getDocument();
    if (doc == null) {
      return throwError(() => new Error('No document to save'));
    }
    this.isSavingSubject.next(true);
    this.lastSaveSuccessSubject.next(null);
    this.lastSaveErrorSubject.next(null);
    return this.editorApi.saveDocument(effectiveProjectId, doc).pipe(
      tap(() => {
        this.markClean();
        this.lastSaveSuccessSubject.next(true);
        this.lastSaveErrorSubject.next(null);
      }),
      catchError((err) => {
        const msg =
          (err && typeof err === 'object' && 'message' in err && typeof (err as any).message === 'string'
            ? (err as any).message
            : String(err)) || 'Save failed';
        this.lastSaveSuccessSubject.next(false);
        this.lastSaveErrorSubject.next(msg);
        return throwError(() => err);
      }),
      finalize(() => this.isSavingSubject.next(false)),
    );
  }

  /** Load document from server and apply to editor. */
  loadFromServer(projectId?: string): Observable<void> {
    const effectiveProjectId = (projectId ?? this.getActiveProjectId()) || 'default';
    return this.editorApi.loadDocument(effectiveProjectId).pipe(
      switchMap((doc) => {
        this.loadDocument(doc);
        return of(undefined);
      }),
    );
  }
}
