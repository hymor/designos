/**
 * Thin facade over the DesignOS editor engine (legacy).
 * Delegates to window.__designosAPI when set (e.g. by legacy bootstrap); otherwise safe stubs.
 * Contract: __designosAPI may provide init(canvas), addRectangle(), deleteSelected(), zoomIn(), zoomOut(), getSelection().
 */

export class EditorEngine {
  constructor() {
    this.canvas = null;
    // Optional in-memory snapshot for JSON documents (backend integration).
    this._document = null;
  }

  _api() {
    return typeof window !== 'undefined' ? window.__designosAPI : null;
  }

  init({ canvas } = {}) {
    this.canvas = canvas != null ? canvas : null;
    const api = this._api();
    if (api && typeof api.init === 'function') {
      api.init(this.canvas);
    }
  }

  addRectangle() {
    const api = this._api();
    if (!api) return;
    if (typeof api.addRectangle === 'function') {
      api.addRectangle();
      return;
    }
    if (typeof api.mkEl === 'function') {
      const cx = 100, cy = 100, w = 80, h = 60;
      api.mkEl('rect', cx, cy, w, h);
    }
  }

  deleteSelected() {
    const api = this._api();
    if (!api) return;
    if (typeof api.deleteSelected === 'function') {
      api.deleteSelected();
      return;
    }
    if (typeof api.delSel === 'function') api.delSel();
  }

  zoomIn() {
    const api = this._api();
    if (!api) return;
    if (typeof api.zoomIn === 'function') {
      api.zoomIn();
      return;
    }
    if (typeof api.adjZ === 'function') api.adjZ(1.2);
  }

  zoomOut() {
    const api = this._api();
    if (!api) return;
    if (typeof api.zoomOut === 'function') {
      api.zoomOut();
      return;
    }
    if (typeof api.adjZ === 'function') api.adjZ(0.8);
  }

  getSelection() {
    const api = this._api();
    if (api && typeof api.getSelection === 'function') {
      return api.getSelection();
    }
    if (api && api.S) {
      const S = api.S;
      return { ids: (S.selIds && S.selIds.slice()) || [], primary: S.selId || null };
    }
    return { ids: [], primary: null };
  }

  getElementProperties(id) {
    if (!id) return null;
    const api = this._api();
    if (!api || typeof api.findAny !== 'function') return null;
    const item = api.findAny(id);
    if (!item) return null;
    return {
      id: item.id,
      type: item.type || 'item',
      x: item.x ?? 0,
      y: item.y ?? 0,
      width: item.w ?? 0,
      height: item.h ?? 0
    };
  }

  updatePosition(id, x, y) {
    const api = this._api();
    if (!api || typeof api.updateItemPosition !== 'function') return;
    api.updateItemPosition(id, x, y);
  }

  updateSize(id, width, height) {
    const api = this._api();
    if (!api || typeof api.updateItemSize !== 'function') return;
    api.updateItemSize(id, width, height);
  }

  getDocument() {
    const api = this._api();
    if (api && typeof api.getDocument === 'function') {
      return api.getDocument();
    }

    // Fallback: build a minimal snapshot from legacy state (no deep typing).
    if (api && api.S) {
      const S = api.S;
      const docId = S.projId || 'doc-1';
      const pageId = S.activeTabId || docId + '-page-1';
      const name = S.projName || 'Untitled';

      const objects = [];
      if (Array.isArray(S.frames)) {
        for (let i = 0; i < S.frames.length; i++) {
          const f = S.frames[i];
          if (!f || !f.id) continue;
          objects.push({
            id: f.id,
            type: 'frame',
            x: f.x || 0,
            y: f.y || 0,
            width: f.w || 0,
            height: f.h || 0,
            rotation: f.rotation || 0,
            parentId: f.frameId || null
          });
        }
      }
      if (Array.isArray(S.els)) {
        for (let i = 0; i < S.els.length; i++) {
          const e = S.els[i];
          if (!e || !e.id) continue;
          objects.push({
            id: e.id,
            type: e.type || 'item',
            x: e.x || 0,
            y: e.y || 0,
            width: e.w || 0,
            height: e.h || 0,
            rotation: e.rotation || 0,
            parentId: e.frameId || null
          });
        }
      }

      const page = {
        id: pageId,
        name,
        width: (api.canvas && api.canvas.width) || 0,
        height: (api.canvas && api.canvas.height) || 0,
        objects
      };

      return {
        id: docId,
        name,
        pages: [page],
        activePageId: pageId
      };
    }

    // If legacy API has no state, return last loaded document or an empty stub.
    if (this._document) {
      return this._document;
    }

    return {
      id: 'doc-1',
      name: 'Untitled',
      pages: [],
      activePageId: null
    };
  }

  loadDocument(documentJson) {
    // Store JSON snapshot for backend / future use.
    this._document = documentJson || null;

    const api = this._api();
    if (api && typeof api.loadDocument === 'function') {
      api.loadDocument(documentJson);
    }
    // If legacy engine doesn't support loading yet, we intentionally
    // do not mutate its internal state here to avoid breaking behavior.
  }
}
