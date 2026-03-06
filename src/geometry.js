// DesignOS – pure path/curve geometry (no S, no dom)

/**
 * Compute tight bounding box of a path from its points and curve handles.
 * @param {Array<{x,y,cx1?,cy1?,cx2?,cy2?}>} pts - path points
 * @param {boolean} closed - whether path is closed (Z)
 * @returns {{minX,minY,maxX,maxY}}
 */
export function pathTightBBox(pts, closed) {
  var xs = [], ys = [];
  function add(x, y) { xs.push(x); ys.push(y); }
  function cubicTValues(x0, x1, x2, x3) {
    var out = [];
    var a = x1 - x0, b = x2 - x1, c = x3 - x2;
    var A = a - 2 * b + c, B = 2 * (b - a), C = a;
    if (Math.abs(A) > 1e-10) {
      var d = B * B - 4 * A * C;
      if (d >= 0) { var sq = Math.sqrt(d); out.push((-B + sq) / (2 * A)); out.push((-B - sq) / (2 * A)); }
    }
    return out.filter(function (tv) { return tv > 1e-6 && tv < 1 - 1e-6; });
  }
  function evalCubic(t, x0, x1, x2, x3) { var u = 1 - t; return u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3; }
  function quadTValue(x0, x1, x2) {
    var den = x0 - 2 * x1 + x2;
    if (Math.abs(den) < 1e-10) return null;
    var t = (x0 - x1) / den;
    return t > 1e-6 && t < 1 - 1e-6 ? t : null;
  }
  function evalQuad(t, x0, x1, x2) { var u = 1 - t; return u * u * x0 + 2 * u * t * x1 + t * t * x2; }
  for (var i = 0; i < pts.length; i++) {
    var prev = pts[i > 0 ? i - 1 : (closed ? pts.length - 1 : null)], cur = pts[i];
    if (!prev) { add(cur.x, cur.y); continue; }
    var hasPrevH = prev.cx2 != null, hasCurH = cur.cx1 != null;
    if (hasPrevH && hasCurH) {
      add(prev.x, prev.y); add(cur.x, cur.y);
      var tVals = [0, 1];
      cubicTValues(prev.x, prev.cx2, cur.cx1, cur.x).forEach(function (t) { tVals.push(t); });
      cubicTValues(prev.y, prev.cy2, cur.cy1, cur.y).forEach(function (t) { if (tVals.indexOf(t) < 0) tVals.push(t); });
      tVals.forEach(function (t) {
        add(evalCubic(t, prev.x, prev.cx2, cur.cx1, cur.x), evalCubic(t, prev.y, prev.cy2, cur.cy1, cur.y));
      });
    } else if (hasPrevH) {
      add(prev.x, prev.y); add(cur.x, cur.y);
      var t = quadTValue(prev.x, prev.cx2, cur.x);
      if (t != null) add(evalQuad(t, prev.x, prev.cx2, cur.x), evalQuad(t, prev.y, prev.cy2, cur.y));
      t = quadTValue(prev.y, prev.cy2, cur.y);
      if (t != null) add(evalQuad(t, prev.x, prev.cx2, cur.x), evalQuad(t, prev.y, prev.cy2, cur.y));
    } else if (hasCurH) {
      add(prev.x, prev.y); add(cur.x, cur.y);
      var t = quadTValue(prev.x, cur.cx1, cur.x);
      if (t != null) add(evalQuad(t, prev.x, cur.cx1, cur.x), evalQuad(t, prev.y, cur.cy1, cur.y));
      t = quadTValue(prev.y, cur.cy1, cur.y);
      if (t != null) add(evalQuad(t, prev.x, cur.cx1, cur.x), evalQuad(t, prev.y, cur.cy1, cur.y));
    } else {
      add(prev.x, prev.y); add(cur.x, cur.y);
    }
  }
  if (closed && pts.length > 1) {
    var last = pts[pts.length - 1], first = pts[0];
    var hasLastH = last.cx2 != null, hasFirstH = first.cx1 != null;
    if (hasLastH && hasFirstH) {
      var tVals = [0, 1];
      cubicTValues(last.x, last.cx2, first.cx1, first.x).forEach(function (t) { tVals.push(t); });
      cubicTValues(last.y, last.cy2, first.cy1, first.y).forEach(function (t) { if (tVals.indexOf(t) < 0) tVals.push(t); });
      tVals.forEach(function (t) {
        add(evalCubic(t, last.x, last.cx2, first.cx1, first.x), evalCubic(t, last.y, last.cy2, first.cy1, first.y));
      });
    }
  }
  if (!xs.length) return { minX: 0, minY: 0, maxX: 1, maxY: 1 };
  var minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs), minY = Math.min.apply(null, ys), maxY = Math.max.apply(null, ys);
  return { minX: minX, minY: minY, maxX: maxX, maxY: maxY };
}
