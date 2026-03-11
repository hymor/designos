// DesignOS – entry point (legacy runtime)
// Delegates to bootstrap module so the same logic can be used by Angular or other hosts.
import { bootstrapLegacyEditor } from './bootstrap-legacy-editor.js';

const canvasEl =
  typeof document !== 'undefined'
    ? (document.getElementById('canvas') as HTMLCanvasElement | HTMLElement | null)
    : null;
bootstrapLegacyEditor(canvasEl, { exposeOnWindow: true });
