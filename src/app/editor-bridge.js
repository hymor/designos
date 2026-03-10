/**
 * Adapter between UI (e.g. Angular) and the editor engine.
 * Delegates all operations to EditorEngine; simple event bus for engine -> UI.
 */

import { EditorEngine } from '../engine/editor-engine.js';

class EditorBridge {
  constructor(engine = null) {
    this.engine = engine || new EditorEngine();
    this._listeners = Object.create(null); // eventName -> [callback, ...]
  }

  on(eventName, callback) {
    if (!eventName || typeof callback !== 'function') return;
    const list = this._listeners[eventName] || (this._listeners[eventName] = []);
    if (list.indexOf(callback) < 0) list.push(callback);
  }

  off(eventName, callback) {
    if (!eventName) return;
    const list = this._listeners[eventName];
    if (!list) return;
    const i = list.indexOf(callback);
    if (i >= 0) list.splice(i, 1);
  }

  emit(eventName, payload) {
    if (!eventName) return;
    const list = this._listeners[eventName];
    if (!list || list.length === 0) return;
    const snapshot = list.slice();
    for (let i = 0; i < snapshot.length; i++) {
      try {
        snapshot[i](payload);
      } catch (e) {
        if (typeof console !== 'undefined' && console.error) {
          console.error('[EditorBridge] event handler error:', e);
        }
      }
    }
  }

  init(canvas) {
    if (!this.engine) return;
    this.engine.init({ canvas: canvas ?? null });
    const api = typeof window !== 'undefined' ? window.__designosAPI : null;
    if (api) {
      api.onSelectionChange = () => this._emitSelectionChange();
    }
  }

  _emitSelectionChange() {
    this.emit('selectionChanged', this.getSelection());
  }

  addRectangle() {
    if (this.engine) this.engine.addRectangle();
  }

  deleteSelected() {
    if (this.engine) this.engine.deleteSelected();
  }

  selectElement(id, additive = false) {
    if (this.engine) this.engine.selectElement(id, !!additive);
    this._emitSelectionChange();
  }

  zoomIn() {
    if (this.engine) this.engine.zoomIn();
  }

  zoomOut() {
    if (this.engine) this.engine.zoomOut();
  }

  getSelection() {
    return this.engine ? this.engine.getSelection() : { ids: [], primary: null };
  }

  getElementProperties(id) {
    return this.engine ? this.engine.getElementProperties(id) : null;
  }

  updatePosition(id, x, y) {
    if (this.engine) this.engine.updatePosition(id, x, y);
  }

  updateSize(id, width, height) {
    if (this.engine) this.engine.updateSize(id, width, height);
  }

  alignLeft() {
    if (this.engine) this.engine.alignItems('left');
  }
  alignCenter() {
    if (this.engine) this.engine.alignItems('cx');
  }
  alignRight() {
    if (this.engine) this.engine.alignItems('right');
  }
  alignTop() {
    if (this.engine) this.engine.alignItems('top');
  }
  alignMiddle() {
    if (this.engine) this.engine.alignItems('cy');
  }
  alignBottom() {
    if (this.engine) this.engine.alignItems('bottom');
  }
  distributeHorizontal() {
    if (this.engine) this.engine.alignItems('dist-h');
  }
  distributeVertical() {
    if (this.engine) this.engine.alignItems('dist-v');
  }

  undo() {
    if (this.engine) this.engine.undo();
  }

  redo() {
    if (this.engine) this.engine.redo();
  }

  getDocument() {
    return this.engine ? this.engine.getDocument() : null;
  }

  loadDocument(documentJson) {
    if (!this.engine) return;
    this.engine.loadDocument(documentJson);
  }
}

export const editorBridge = new EditorBridge();
export { EditorBridge };
