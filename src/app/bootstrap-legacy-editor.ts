/**
 * Bootstrap module for the legacy editor runtime.
 * Initializes the editor on the given canvas/container and returns the bridge instance.
 * Primary integration: use the returned bridge (e.g. Angular calls bootstrapLegacyEditor(canvas)).
 * Optional: expose on window for debug (exposeOnWindow: true).
 */

import '../engine/legacy/legacy.js';
import { editorBridge } from './editor-bridge.js';

export interface BootstrapLegacyEditorOptions {
  /** If true, set window.editorBridge for debug. Default: true to keep current index.html behavior. */
  exposeOnWindow?: boolean;
}

/**
 * Initializes the legacy editor on the given canvas (or container element) and returns the bridge.
 * Call this from the host app (e.g. main.ts or Angular) with the canvas/container DOM element.
 *
 * @param canvas - The canvas or container element (e.g. document.getElementById('canvas'))
 * @param options - Optional. exposeOnWindow: set window.editorBridge for debug (default true)
 * @returns The editor bridge instance (init, addRectangle, zoomIn, getSelection, etc.)
 */
export function bootstrapLegacyEditor(
  canvas: HTMLCanvasElement | HTMLElement | null,
  options: BootstrapLegacyEditorOptions = {}
): ReturnType<typeof getEditorBridge> {
  const { exposeOnWindow = true } = options;
  editorBridge.init(canvas ?? null);
  if (exposeOnWindow && typeof window !== 'undefined') {
    (window as unknown as { editorBridge: typeof editorBridge }).editorBridge = editorBridge;
  }
  return editorBridge;
}

/** Return type for the bridge instance (same shape as editorBridge). */
function getEditorBridge(): typeof editorBridge {
  return editorBridge;
}

/** Expose on window so Angular (or other hosts) can call it without importing this module. */
if (typeof window !== 'undefined') {
  (window as unknown as { bootstrapLegacyEditor: typeof bootstrapLegacyEditor }).bootstrapLegacyEditor =
    bootstrapLegacyEditor;
}
