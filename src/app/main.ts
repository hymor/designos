// DesignOS – entry point
// Step 1: legacy app runs as-is; extract modules here incrementally.
import '../engine/legacy/legacy.js';
import { editorBridge } from './editor-bridge.js';

// Bridge for Angular: init on editor canvas (if present), always expose on window
const canvasEl = typeof document !== 'undefined' ? document.getElementById('canvas') : null;
if (canvasEl) {
  editorBridge.init(canvasEl);
}
if (typeof window !== 'undefined') {
  (window as unknown as { editorBridge: typeof editorBridge }).editorBridge = editorBridge;
}
