// DesignOS – shared helpers (depend only on state/dom)

import { S, dom } from './state.js';

export function ns(t) {
  return document.createElementNS('http://www.w3.org/2000/svg', t);
}

export function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

export function uid() {
  return 'e' + (S.nid++);
}

export function deep(o) {
  return JSON.parse(JSON.stringify(o));
}

export function svgPt(e) {
  var r = dom.canvas.getBoundingClientRect();
  return {
    x: (e.clientX - r.left - S.px) / S.zoom,
    y: (e.clientY - r.top - S.py) / S.zoom
  };
}

export function snapV(v) {
  return S.snap ? Math.round(v / S.snapSz) * S.snapSz : v;
}

export function snapPt(p) {
  return { x: snapV(p.x), y: snapV(p.y) };
}

export function movePt(p, dx, dy) {
  var n = { x: p.x + dx, y: p.y + dy };
  if (p.type) n.type = p.type;
  if (p.cx1 != null) {
    n.cx1 = p.cx1 + dx;
    n.cy1 = p.cy1 + dy;
  }
  if (p.cx2 != null) {
    n.cx2 = p.cx2 + dx;
    n.cy2 = p.cy2 + dy;
  }
  return n;
}

export function toast(msg) {
  var t = dom.toastEl;
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._x);
  t._x = setTimeout(function () {
    t.classList.remove('show');
  }, 2200);
}
