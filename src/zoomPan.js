// DesignOS – zoom (wheel + buttons) and pan state (applyTr stays in legacy)

import { S, dom } from './state.js';

export function createZoomPan(deps) {
  const { applyTr, drawSel, renderFrame, clamp } = deps;
  const { canvas } = dom;

  function adjZ(f) {
    const r = canvas.getBoundingClientRect();
    const cx = r.width / 2;
    const cy = r.height / 2;
    const nz = clamp(S.zoom * f, 0.05, 20);
    S.px = cx - (cx - S.px) * (nz / S.zoom);
    S.py = cy - (cy - S.py) * (nz / S.zoom);
    S.zoom = nz;
    applyTr();
    drawSel();
    S.frames.filter(function (f) {
      return !f.frameId;
    }).forEach(function (f) {
      renderFrame(f);
    });
  }

  canvas.addEventListener('wheel', function (e) {
    e.preventDefault();
    const r = canvas.getBoundingClientRect();
    const cx = e.clientX - r.left;
    const cy = e.clientY - r.top;
    const f = e.deltaY < 0 ? 1.1 : 0.9;
    const nz = clamp(S.zoom * f, 0.05, 20);
    S.px = cx - (cx - S.px) * (nz / S.zoom);
    S.py = cy - (cy - S.py) * (nz / S.zoom);
    S.zoom = nz;
    applyTr();
    drawSel();
    S.frames.filter(function (f) {
      return !f.frameId;
    }).forEach(function (f) {
      renderFrame(f);
    });
  }, { passive: false });

  const zIn = document.getElementById('z-in');
  const zOut = document.getElementById('z-out');
  if (zIn) zIn.addEventListener('click', function () { adjZ(1.2); });
  if (zOut) zOut.addEventListener('click', function () { adjZ(0.8); });

  return { adjZ };
}
