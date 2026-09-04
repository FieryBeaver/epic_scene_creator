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

/** Offset a segment sideways, so parallel connections do not overlap. */
export function offsetSegment(p, q, distance){
  const dx = q.x - p.x, dy = q.y - p.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: -dy / len * distance, y: dx / len * distance };
}
