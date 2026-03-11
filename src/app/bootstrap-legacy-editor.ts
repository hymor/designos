/**
 * Bootstrap module for the legacy editor runtime.
 * Initializes the editor on the given canvas/container or host context and returns the bridge instance.
 * Primary integration: use the returned bridge (e.g. Angular calls bootstrapLegacyEditor(container)).
 * Optional: expose on window for debug (exposeOnWindow: true).
 */

import { setHostContext } from '../engine/core/state.js';
import '../engine/legacy/legacy.js';
import { editorBridge } from './editor-bridge.js';

export interface EditorHostContext {
  canvas: HTMLElement | null;
  defsEl: SVGDefsElement | null;
  framesG: SVGGElement | null;
  elsLoose: SVGGElement | null;
  selOv: SVGGElement | null;
  sgG: SVGGElement | null;
  ghost: SVGRectElement | null;
  ghostEllipse: SVGEllipseElement | null;
  ghostLine: SVGLineElement | null;
  fghost: SVGRectElement | null;
  ted?: HTMLTextAreaElement | null;
  layersDiv?: HTMLElement | null;
  propsDiv?: HTMLElement | null;
  bandRect?: HTMLElement | null;
  snapCvs?: HTMLCanvasElement | null;
  toastEl?: HTMLElement | null;
}

export interface BootstrapLegacyEditorOptions {
  /** If true, set window.editorBridge for debug. Default: true to keep current index.html behavior. */
  exposeOnWindow?: boolean;
}

function buildHostFromContainer(container: HTMLElement): EditorHostContext {
  const svg =
    container.querySelector('svg') ||
    (() => {
      const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      s.setAttribute('id', 'svg');
      s.style.position = 'absolute';
      s.style.top = '0';
      s.style.left = '0';
      s.style.width = '100%';
      s.style.height = '100%';
      s.style.overflow = 'visible';
      container.appendChild(s);
      return s;
    })();

  const defsEl = (svg.querySelector('#defs') || (() => {
    const d = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    d.setAttribute('id', 'defs');
    svg.appendChild(d);
    return d;
  })()) as SVGDefsElement;

  const framesG = (svg.querySelector('#frames-g') || (() => {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('id', 'frames-g');
    svg.appendChild(g);
    return g;
  })()) as SVGGElement;

  const elsLoose = (svg.querySelector('#els-loose') || (() => {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('id', 'els-loose');
    svg.appendChild(g);
    return g;
  })()) as SVGGElement;

  const selOv = (svg.querySelector('#sel-ov') || (() => {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('id', 'sel-ov');
    svg.appendChild(g);
    return g;
  })()) as SVGGElement;

  const sgG = (svg.querySelector('#smart-guides-g') || (() => {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('id', 'smart-guides-g');
    svg.appendChild(g);
    return g;
  })()) as SVGGElement;

  const ghost = (svg.querySelector('#ghost') || (() => {
    const r = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    r.setAttribute('id', 'ghost');
    r.setAttribute('fill', 'rgba(123,97,255,0.1)');
    r.setAttribute('stroke', '#7b61ff');
    r.setAttribute('stroke-width', '1.5');
    r.setAttribute('stroke-dasharray', '5,3');
    r.setAttribute('style', 'display:none');
    r.setAttribute('pointer-events', 'none');
    svg.appendChild(r);
    return r;
  })()) as SVGRectElement;

  const ghostEllipse = (svg.querySelector('#ghost-ellipse') || (() => {
    const e = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
    e.setAttribute('id', 'ghost-ellipse');
    e.setAttribute('fill', 'rgba(123,97,255,0.1)');
    e.setAttribute('stroke', '#7b61ff');
    e.setAttribute('stroke-width', '1.5');
    e.setAttribute('stroke-dasharray', '5,3');
    e.setAttribute('style', 'display:none');
    svg.appendChild(e);
    return e;
  })()) as SVGEllipseElement;

  const ghostLine = (svg.querySelector('#ghost-line') || (() => {
    const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    l.setAttribute('id', 'ghost-line');
    l.setAttribute('stroke', '#7b61ff');
    l.setAttribute('stroke-width', '2');
    l.setAttribute('style', 'display:none');
    svg.appendChild(l);
    return l;
  })()) as SVGLineElement;

  const fghost = (svg.querySelector('#fghost') || (() => {
    const r = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    r.setAttribute('id', 'fghost');
    r.setAttribute('fill', 'rgba(62,207,142,0.08)');
    r.setAttribute('stroke', '#3ecf8e');
    r.setAttribute('stroke-width', '1.5');
    r.setAttribute('stroke-dasharray', '5,3');
    r.setAttribute('style', 'display:none');
    svg.appendChild(r);
    return r;
  })()) as SVGRectElement;

  const bandRect = container.querySelector('#band-rect') as HTMLElement | null || (() => {
    const d = document.createElement('div');
    d.setAttribute('id', 'band-rect');
    d.style.display = 'none';
    d.style.position = 'absolute';
    d.style.pointerEvents = 'none';
    d.style.left = '0';
    d.style.top = '0';
    d.style.width = '0';
    d.style.height = '0';
    d.style.border = '1.5px solid #7b61ff';
    d.style.background = 'rgba(123,97,255,0.07)';
    d.style.zIndex = '10';
    container.appendChild(d);
    return d;
  })();

  const snapCvs = (container.querySelector('#snap-grid') as HTMLCanvasElement | null) || (() => {
    const c = document.createElement('canvas');
    c.setAttribute('id', 'snap-grid');
    c.style.position = 'absolute';
    c.style.top = '0';
    c.style.left = '0';
    c.style.pointerEvents = 'none';
    container.appendChild(c);
    return c;
  })();

  const ted = (container.querySelector('#ted') as HTMLTextAreaElement | null) || (() => {
    const ta = document.createElement('textarea');
    ta.setAttribute('id', 'ted');
    ta.setAttribute('aria-label', 'Text edit');
    ta.style.display = 'none';
    ta.style.position = 'fixed';
    ta.style.margin = '0';
    ta.style.padding = '0';
    ta.style.border = 'none';
    ta.style.outline = 'none';
    ta.style.resize = 'none';
    ta.style.boxSizing = 'border-box';
    ta.style.overflow = 'hidden';
    container.appendChild(ta);
    return ta;
  })();

  return {
    canvas: container,
    defsEl,
    framesG,
    elsLoose,
    selOv,
    sgG,
    ghost,
    ghostEllipse,
    ghostLine,
    fghost,
    ted,
    layersDiv: null,
    propsDiv: null,
    bandRect,
    snapCvs,
    toastEl: null
  };
}

/**
 * Initializes the legacy editor and returns the bridge.
 * Pass either a container element (div with or without inner SVG) or a full EditorHostContext.
 * If only a container is passed, host is built from it (SVG/defs/groups created if missing).
 *
 * @param canvasOrHost - Container element or EditorHostContext. If HTMLElement, used as container and host is built from it.
 * @param options - Optional. exposeOnWindow: set window.editorBridge for debug (default true)
 * @returns The editor bridge instance
 */
export function bootstrapLegacyEditor(
  canvasOrHost: HTMLCanvasElement | HTMLElement | EditorHostContext | null,
  options: BootstrapLegacyEditorOptions = {}
): ReturnType<typeof getEditorBridge> {
  const { exposeOnWindow = true } = options;
  if (canvasOrHost == null) {
    if (typeof console !== 'undefined') console.warn('[bootstrapLegacyEditor] canvasOrHost is null; skipping setHostContext.');
    editorBridge.init(null);
    if (exposeOnWindow && typeof window !== 'undefined') {
      (window as unknown as { editorBridge: typeof editorBridge }).editorBridge = editorBridge;
    }
    return editorBridge;
  }
  let host: EditorHostContext;
  let container: HTMLElement | null;
  if (
    typeof (canvasOrHost as EditorHostContext).defsEl !== 'undefined' &&
    (canvasOrHost as EditorHostContext).framesG != null
  ) {
    host = canvasOrHost as EditorHostContext;
    container = host.canvas;
    if (!container && typeof console !== 'undefined') {
      console.warn('[bootstrapLegacyEditor] host context has no canvas (container); zoom/getBoundingClientRect may fail.');
    }
  } else {
    container = canvasOrHost as HTMLElement;
    host = buildHostFromContainer(container);
    if (!host.defsEl || !host.framesG || !host.elsLoose || !host.selOv) {
      if (typeof console !== 'undefined') {
        console.warn('[bootstrapLegacyEditor] required host elements missing after build (defsEl, framesG, elsLoose, selOv).');
      }
    }
  }
  setHostContext(host);
  editorBridge.init(container ?? null);
  const api = typeof window !== 'undefined' ? (window as unknown as { __designosAPI?: { runEditorInit?: () => void; eyedropperBadgeUpdate?: (p: unknown) => void; eyedropperBadgeHide?: () => void } }).__designosAPI : null;
  if (api?.runEditorInit) api.runEditorInit();
  if (api && editorBridge) {
    api.eyedropperBadgeUpdate = (payload: unknown) => editorBridge.emit('eyedropperBadge', payload);
    api.eyedropperBadgeHide = () => editorBridge.emit('eyedropperBadgeHide', null);
  }
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
