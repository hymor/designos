// DesignOS – snap grid overlay (canvas 2d)

import { S, dom } from './state.js';

export function createSnapGrid(deps) {
  const { toast } = deps;
  const { canvas, snapCvs } = dom;

  function drawSnapGrid() {
    const r = canvas.getBoundingClientRect();
    snapCvs.width = r.width;
    snapCvs.height = r.height;
    snapCvs.style.width = r.width + 'px';
    snapCvs.style.height = r.height + 'px';
    const ctx = snapCvs.getContext('2d');
    ctx.clearRect(0, 0, r.width, r.height);
    if (!S.snap) return;
    const gs = S.snapSz * S.zoom;
    const ox = ((S.px % gs) + gs) % gs;
    const oy = ((S.py % gs) + gs) % gs;
    ctx.strokeStyle = 'rgba(255,255,255,0.055)';
    ctx.lineWidth = 1;
    for (let x = ox - gs; x < r.width + gs; x += gs) {
      ctx.beginPath();
      ctx.moveTo(Math.round(x) + 0.5, 0);
      ctx.lineTo(Math.round(x) + 0.5, r.height);
      ctx.stroke();
    }
    for (let y = oy - gs; y < r.height + gs; y += gs) {
      ctx.beginPath();
      ctx.moveTo(0, Math.round(y) + 0.5);
      ctx.lineTo(r.width, Math.round(y) + 0.5);
      ctx.stroke();
    }
  }

  function toggleSnap() {
    S.snap = !S.snap;
    const b = document.getElementById('snap-btn');
    if (b) b.classList.toggle('active', S.snap);
    drawSnapGrid();
    toast(S.snap ? 'Snap ON (' + S.snapSz + 'px grid)' : 'Snap OFF');
  }

  const snapBtn = document.getElementById('snap-btn');
  if (snapBtn) snapBtn.addEventListener('click', toggleSnap);

  return { drawSnapGrid };
}
