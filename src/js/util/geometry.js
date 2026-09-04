/**
 * Pure geometry for the board: which side of a node an edge leaves from and
 * where it meets the node's bounding box. No DOM, no state.
 */

/** Compass sides a connection can be pinned to, plus the vertical pair. */
export const SIDES = [
  ['', 'авто'], ['N', 'північ'], ['NE', 'пн-схід'], ['E', 'схід'], ['SE', 'пд-схід'],
  ['S', 'південь'], ['SW', 'пд-захід'], ['W', 'захід'], ['NW', 'пн-захід'],
  ['up', 'вгору'], ['down', 'вниз'],
];

/** Unit vectors for the eight compass sides. `up`/`down` have no direction. */
export const SIDE_VEC = {
  N: [0, -1], NE: [.75, -.75], E: [1, 0], SE: [.75, .75],
  S: [0, 1], SW: [-.75, .75], W: [-1, 0], NW: [-.75, -.75],
};

export const SIDE_SYM = {
  N: '↑', NE: '↗', E: '→', SE: '↘', S: '↓', SW: '↙', W: '←', NW: '↖', up: '⇑', down: '⇓',
};

export function sideLabel(v){
  const s = SIDES.find(x => x[0] === v);
  return s ? s[1] : '';
}

/** Point where a ray in direction `u` leaves the box `a` ({x,y,w,h} centred). */
export function edgeAt(a, u){
  const hw = a.w / 2 + 4, hh = a.h / 2 + 4;
  const sx = u[0] ? hw / Math.abs(u[0]) : Infinity;
  const sy = u[1] ? hh / Math.abs(u[1]) : Infinity;
  const t = Math.min(sx, sy);
  return { x: a.x + u[0] * t, y: a.y + u[1] * t };
}

/** Point on the border of box `a` facing point `b`. */
export function edgePoint(a, b){
  const dx = b.x - a.x, dy = b.y - a.y;
  if (!dx && !dy) return { x: a.x, y: a.y };
  const hw = a.w / 2 + 4, hh = a.h / 2 + 4;
  const sx = dx ? hw / Math.abs(dx) : Infinity;
  const sy = dy ? hh / Math.abs(dy) : Infinity;
  const t = Math.min(sx, sy);
  return { x: a.x + dx * t, y: a.y + dy * t };
}

/**
 * Direction a wire should leave a box in.
 *
 * A pinned side wins. Otherwise the wire leaves along whichever axis the
 * other node mostly lies on — the same rule React Flow and Blender use, and
 * the reason their curves read as "out of the side and round" rather than as
 * a diagonal smear.
 */
export function leaveDirection(side, from, to){
  if (SIDE_VEC[side]) return SIDE_VEC[side];
  const dx = to.x - from.x, dy = to.y - from.y;
  if (Math.abs(dx) >= Math.abs(dy)) return [Math.sign(dx) || 1, 0];
  return [0, Math.sign(dy) || 1];
}

/**
 * Cubic control points for a wire from `p` to `q`.
 *
 * The handles reach out along each end's own direction, by a length that
 * grows with the gap but is clamped: short hops stay nearly straight, long
 * ones bow without looping back on themselves.
 */
export function curveHandles(p, q, dirP, dirQ){
  const span = Math.hypot(q.x - p.x, q.y - p.y);
  const reach = Math.min(160, Math.max(28, span * 0.38));
  return [
    { x: p.x + dirP[0] * reach, y: p.y + dirP[1] * reach },
    { x: q.x + dirQ[0] * reach, y: q.y + dirQ[1] * reach },
  ];
}

/** The SVG path for that curve. */
export function curvePath(p, c1, c2, q){
  return `M${r(p.x)},${r(p.y)} C${r(c1.x)},${r(c1.y)} ${r(c2.x)},${r(c2.y)} ${r(q.x)},${r(q.y)}`;
}

/** Midpoint of the cubic, where its label belongs. */
export function curveMid(p, c1, c2, q){
  return {
    x: (p.x + 3 * c1.x + 3 * c2.x + q.x) / 8,
    y: (p.y + 3 * c1.y + 3 * c2.y + q.y) / 8,
  };
}

const r = n => Math.round(n * 10) / 10;

/** Offset a segment sideways, so parallel connections do not overlap. */
export function offsetSegment(p, q, distance){
  const dx = q.x - p.x, dy = q.y - p.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: -dy / len * distance, y: dx / len * distance };
}
