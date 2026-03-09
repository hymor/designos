// DesignOS – align and distribute selected items

import { S } from '../core/state.js';

export function createAlignment(deps) {
  const { getBBox, absPos, renderFrame, renderEl, drawSel, refreshProps, snapshot, toast } = deps;

  function alignItems(mode) {
    const ids = S.selIds.length > 1 ? S.selIds : (S.selId ? [S.selId] : []);
    if (!ids.length) return;
    const items = ids
      .map(function (id) {
        return S.els.find(function (e) { return e.id === id; }) || S.frames.find(function (f) { return f.id === id; });
      })
      .filter(Boolean);
    if (!items.length) return;
    const pfIds = items.map(function (it) { return it.frameId || null; });
    const allSame = pfIds.every(function (fid) { return fid && fid === pfIds[0]; });
    const cf = allSame && pfIds[0] ? S.frames.find(function (f) { return f.id === pfIds[0]; }) : null;
    let ref;
    if (cf) {
      ref = { x: 0, y: 0, w: cf.w, h: cf.h };
    } else {
      let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
      items.forEach(function (it) {
        const bb = getBBox(it);
        x1 = Math.min(x1, bb.x);
        y1 = Math.min(y1, bb.y);
        x2 = Math.max(x2, bb.x + bb.w);
        y2 = Math.max(y2, bb.y + bb.h);
      });
      ref = { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
    }
    if (mode === 'dist-h' || mode === 'dist-v') {
      const sorted = items.slice().sort(function (a, b) {
        const ba = getBBox(a), bb2 = getBBox(b);
        return mode === 'dist-h' ? ba.x - bb2.x : ba.y - bb2.y;
      });
      if (sorted.length < 3) {
        toast('Need 3+ items');
        return;
      }
      const first = getBBox(sorted[0]), last = getBBox(sorted[sorted.length - 1]);
      let tot = 0;
      sorted.forEach(function (it) {
        const bb2 = getBBox(it);
        tot += mode === 'dist-h' ? bb2.w : bb2.h;
      });
      const span = mode === 'dist-h' ? (last.x + last.w - first.x) : (last.y + last.h - first.y);
      const gap = (span - tot) / (sorted.length - 1);
      let cur = mode === 'dist-h' ? first.x : first.y;
      sorted.forEach(function (it) {
        const bb2 = getBBox(it);
        const isFr2 = !!S.frames.find(function (f) { return f.id === it.id; });
        const ab = absPos(it);
        const setP = function (ax, ay) {
          if (isFr2) {
            it.x = ax;
            it.y = ay;
            renderFrame(it);
          } else if (it.frameId) {
            const pf = S.frames.find(function (f) { return f.id === it.frameId; });
            if (pf) {
              it.x = ax - pf.x;
              it.y = ay - pf.y;
            }
            renderEl(it);
          } else {
            it.x = ax;
            it.y = ay;
            renderEl(it);
          }
        };
        if (mode === 'dist-h') {
          setP(cur, ab.y);
          cur += bb2.w + gap;
        } else {
          setP(ab.x, cur);
          cur += bb2.h + gap;
        }
      });
      drawSel();
      refreshProps();
      snapshot();
      toast('Distributed');
      return;
    }
    items.forEach(function (it) {
      const bb = getBBox(it);
      const isFr2 = !!S.frames.find(function (f) { return f.id === it.id; });
      const rX = cf ? cf.x + ref.x : ref.x, rY = cf ? cf.y + ref.y : ref.y;
      let ax = bb.x, ay = bb.y;
      if (mode === 'left') ax = rX;
      if (mode === 'right') ax = rX + ref.w - it.w;
      if (mode === 'cx') ax = rX + ref.w / 2 - it.w / 2;
      if (mode === 'top') ay = rY;
      if (mode === 'bottom') ay = rY + ref.h - it.h;
      if (mode === 'cy') ay = rY + ref.h / 2 - it.h / 2;
      if (isFr2) {
        it.x = ax;
        it.y = ay;
        renderFrame(it);
      } else if (it.frameId) {
        const pf = S.frames.find(function (f) { return f.id === it.frameId; });
        if (pf) {
          it.x = ax - pf.x;
          it.y = ay - pf.y;
        }
        renderEl(it);
      } else {
        it.x = ax;
        it.y = ay;
        renderEl(it);
      }
    });
    drawSel();
    refreshProps();
    snapshot();
    toast('Aligned');
  }

  function alignHTML() {
    function ic(p) {
      return '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor">' + p + '</svg>';
    }
    const I = {
      left: ic('<rect x="3" y="3" width="7" height="2.5" rx=".8" fill="currentColor" stroke="none" opacity=".7"/><rect x="3" y="8.5" width="4.5" height="2.5" rx=".8" fill="currentColor" stroke="none" opacity=".7"/><line x1="1.5" y1="1.5" x2="1.5" y2="12.5" stroke-width="1.5" stroke-linecap="round"/>'),
      cx: ic('<rect x="3" y="3" width="8" height="2.5" rx=".8" fill="currentColor" stroke="none" opacity=".7"/><rect x="4.5" y="8.5" width="5" height="2.5" rx=".8" fill="currentColor" stroke="none" opacity=".7"/><line x1="7" y1="1.5" x2="7" y2="12.5" stroke-width="1.5" stroke-linecap="round"/>'),
      right: ic('<rect x="4" y="3" width="7" height="2.5" rx=".8" fill="currentColor" stroke="none" opacity=".7"/><rect x="5.5" y="8.5" width="5" height="2.5" rx=".8" fill="currentColor" stroke="none" opacity=".7"/><line x1="12.5" y1="1.5" x2="12.5" y2="12.5" stroke-width="1.5" stroke-linecap="round"/>'),
      top: ic('<rect x="3" y="3" width="2.5" height="7" rx=".8" fill="currentColor" stroke="none" opacity=".7"/><rect x="8.5" y="3" width="2.5" height="4.5" rx=".8" fill="currentColor" stroke="none" opacity=".7"/><line x1="1.5" y1="1.5" x2="12.5" y2="1.5" stroke-width="1.5" stroke-linecap="round"/>'),
      cy: ic('<rect x="3" y="3" width="2.5" height="8" rx=".8" fill="currentColor" stroke="none" opacity=".7"/><rect x="8.5" y="4.5" width="2.5" height="5" rx=".8" fill="currentColor" stroke="none" opacity=".7"/><line x1="1.5" y1="7" x2="12.5" y2="7" stroke-width="1.5" stroke-linecap="round"/>'),
      bottom: ic('<rect x="3" y="4" width="2.5" height="7" rx=".8" fill="currentColor" stroke="none" opacity=".7"/><rect x="8.5" y="6.5" width="2.5" height="4.5" rx=".8" fill="currentColor" stroke="none" opacity=".7"/><line x1="1.5" y1="12.5" x2="12.5" y2="12.5" stroke-width="1.5" stroke-linecap="round"/>'),
      dh: ic('<rect x="1" y="4" width="2.5" height="6" rx=".8" fill="currentColor" stroke="none" opacity=".6"/><rect x="5.5" y="2" width="3" height="10" rx=".8" fill="currentColor" stroke="none" opacity=".6"/><rect x="10.5" y="5" width="2.5" height="4" rx=".8" fill="currentColor" stroke="none" opacity=".6"/><line x1="3.5" y1="7" x2="5.5" y2="7" stroke-width="1" stroke-dasharray="2,1.5"/><line x1="8.5" y1="7" x2="10.5" y2="7" stroke-width="1" stroke-dasharray="2,1.5"/>'),
      dv: ic('<rect x="4" y="1" width="6" height="2.5" rx=".8" fill="currentColor" stroke="none" opacity=".6"/><rect x="2" y="5.5" width="10" height="3" rx=".8" fill="currentColor" stroke="none" opacity=".6"/><rect x="5" y="10.5" width="4" height="2.5" rx=".8" fill="currentColor" stroke="none" opacity=".6"/><line x1="7" y1="3.5" x2="7" y2="5.5" stroke-width="1" stroke-dasharray="2,1.5"/><line x1="7" y1="8.5" x2="7" y2="10.5" stroke-width="1" stroke-dasharray="2,1.5"/>')
    };
    let h = '<div class="ps"><div class="ps-t">Align</div><div class="align-grid">';
    [['left', 'Align left'], ['cx', 'Center H'], ['right', 'Align right'], ['top', 'Align top'], ['cy', 'Center V'], ['bottom', 'Align bottom']].forEach(function (a) {
      h += '<button class="al-btn" data-align="' + a[0] + '" title="' + a[1] + '">' + I[a[0]] + '</button>';
    });
    h += '</div><div class="align-grid2" style="margin-top:4px">';
    h += '<button class="al-btn" data-align="dist-h" style="font-size:10px;gap:4px;padding:5px 2px">' + I.dh + ' H</button>';
    h += '<button class="al-btn" data-align="dist-v" style="font-size:10px;gap:4px;padding:5px 2px">' + I.dv + ' V</button>';
    h += '</div></div>';
    return h;
  }

  function bindAlignBtns() {
    document.querySelectorAll('.al-btn').forEach(function (b) {
      b.addEventListener('click', function () { alignItems(b.dataset.align); });
    });
  }

  return { alignItems, alignHTML, bindAlignBtns };
}
