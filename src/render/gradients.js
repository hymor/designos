// DesignOS – gradient SVG defs and CSS/object helpers

import { dom } from '../core/state.js';

export function createGradients(deps) {
  const { ns } = deps;
  const { defsEl } = dom;

  function buildGradDef(el) {
    const old = document.getElementById('grad' + el.id);
    if (old) old.remove();
    if (!el.gradient || el.fillMode === 'solid') return null;
    let g;
    if (el.gradient.type === 'linear') {
      g = ns('linearGradient');
      const a = ((el.gradient.angle || 0) * Math.PI) / 180;
      g.setAttribute('x1', 0.5 - 0.5 * Math.cos(a));
      g.setAttribute('y1', 0.5 - 0.5 * Math.sin(a));
      g.setAttribute('x2', 0.5 + 0.5 * Math.cos(a));
      g.setAttribute('y2', 0.5 + 0.5 * Math.sin(a));
    } else {
      g = ns('radialGradient');
      g.setAttribute('cx', '50%');
      g.setAttribute('cy', '50%');
      g.setAttribute('r', '50%');
    }
    g.id = 'grad' + el.id;
    g.setAttribute('gradientUnits', 'objectBoundingBox');
    (el.gradient.stops || []).forEach(function (st) {
      const s = ns('stop');
      s.setAttribute('offset', st.pos * 100 + '%');
      s.setAttribute('stop-color', st.color);
      s.setAttribute('stop-opacity', st.opacity != null ? st.opacity : 1);
      g.appendChild(s);
    });
    defsEl.appendChild(g);
    return 'url(#grad' + el.id + ')';
  }

  function defGrad(type, c1, c2) {
    return {
      type: type,
      angle: 90,
      stops: [
        { pos: 0, color: c1 || '#7b61ff' },
        { pos: 1, color: c2 || '#3ecf8e' }
      ]
    };
  }

  function hexToRgba(hex, op) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + (op != null ? op : 1) + ')';
  }

  function gradCSS(g) {
    if (!g || !g.stops || !g.stops.length) return '#7b61ff';
    const s = g.stops
      .map(function (st) {
        const c =
          st.opacity != null && st.opacity < 1
            ? hexToRgba(st.color, st.opacity)
            : st.color;
        return c + ' ' + st.pos * 100 + '%';
      })
      .join(',');
    return g.type === 'radial'
      ? 'radial-gradient(circle,' + s + ')'
      : 'linear-gradient(' + (g.angle || 0) + 'deg,' + s + ')';
  }

  return { buildGradDef, defGrad, hexToRgba, gradCSS };
}
