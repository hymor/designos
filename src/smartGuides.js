// DesignOS – smart guides (snap to other elements’ edges/centers)

import { S, dom } from './state.js';

const GUIDE_THRESH = 6; // snap distance in canvas px (before zoom)

export function createSmartGuides(deps) {
  const { getBBox, ns } = deps;
  const sgG = dom.sgG;

  function clearGuides() {
    sgG.innerHTML = '';
  }

  function drawGuide(x1, y1, x2, y2) {
    const l = ns('line');
    l.setAttribute('x1', x1);
    l.setAttribute('y1', y1);
    l.setAttribute('x2', x2);
    l.setAttribute('y2', y2);
    l.setAttribute('stroke', '#ff4ecb');
    l.setAttribute('stroke-width', 1 / S.zoom);
    l.setAttribute('stroke-dasharray', '4/' + S.zoom + ',3/' + S.zoom);
    l.setAttribute('pointer-events', 'none');
    sgG.appendChild(l);
  }

  /** Returns snap delta and draws guide lines. el = item being dragged, ax,ay = proposed absolute position. */
  function applySmartGuides(el, ax, ay) {
    clearGuides();
    if (!S.smartGuides) return { dx: 0, dy: 0 };
    const ew = el.w,
      eh = el.h;
    const eL = ax,
      eR = ax + ew,
      eCx = ax + ew / 2,
      eT = ay,
      eB = ay + eh,
      eCy = ay + eh / 2;
    const others = [];
    S.frames.forEach(function (f) {
      if (f.id !== el.id && f.id !== (el.frameId || '__')) others.push(getBBox(f));
    });
    S.els.filter(function (e) {
      return e.id !== el.id && !e.frameId;
    }).forEach(function (e) {
      others.push(getBBox(e));
    });
    const thresh = GUIDE_THRESH / S.zoom;
    let dxBest = null,
      dyBest = null;
    const guides = [];
    others.forEach(function (ob) {
      const oL = ob.x,
        oR = ob.x + ob.w,
        oCx = ob.x + ob.w / 2,
        oT = ob.y,
        oB = ob.y + ob.h,
        oCy = ob.y + ob.h / 2;
      const xPairs = [
        { src: eL, tgt: oL, delta: oL - eL },
        { src: eR, tgt: oR, delta: oR - eR },
        { src: eCx, tgt: oCx, delta: oCx - eCx },
        { src: eL, tgt: oR, delta: oR - eL },
        { src: eR, tgt: oL, delta: oL - eR }
      ];
      xPairs.forEach(function (xp) {
        if (Math.abs(xp.delta) < thresh) {
          if (dxBest === null || Math.abs(xp.delta) < Math.abs(dxBest)) dxBest = xp.delta;
          guides.push({ type: 'v', x: xp.tgt, y1: Math.min(eT, oT), y2: Math.max(eB, oB) });
        }
      });
      const yPairs = [
        { src: eT, tgt: oT, delta: oT - eT },
        { src: eB, tgt: oB, delta: oB - eB },
        { src: eCy, tgt: oCy, delta: oCy - eCy },
        { src: eT, tgt: oB, delta: oB - eT },
        { src: eB, tgt: oT, delta: oT - eB }
      ];
      yPairs.forEach(function (yp) {
        if (Math.abs(yp.delta) < thresh) {
          if (dyBest === null || Math.abs(yp.delta) < Math.abs(dyBest)) dyBest = yp.delta;
          guides.push({ type: 'h', y: yp.tgt, x1: Math.min(eL, oL), x2: Math.max(eR, oR) });
        }
      });
    });
    const result = { dx: dxBest || 0, dy: dyBest || 0 };
    guides.forEach(function (g) {
      if (g.type === 'v' && dxBest !== null) drawGuide(g.x, g.y1 - 20, g.x, g.y2 + 20);
      if (g.type === 'h' && dyBest !== null) drawGuide(g.x1 - 20, g.y, g.x2 + 20, g.y);
    });
    return result;
  }

  return { applySmartGuides, clearGuides };
}
