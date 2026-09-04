/**
 * Minimap.
 *
 * The one component every node editor ends up with, for the same reason: past
 * a dozen nodes, "where am I and what else is out there" stops being
 * answerable from the canvas alone. Shows the whole board at a glance, marks
 * the part of it you are looking at, and jumps there when clicked.
 */

import { S, sel, ui, mark } from '../core/state.js';
import { safeColor } from '../util/html.js';
import { el } from '../util/dom.js';
import { NODE_W, nodeSize } from './nodes.js';
import { centerOn, viewportRect, onCameraChange } from './camera.js';

const PAD = 60;          // world units of breathing room around the content
const MIN_SPAN = 600;    // never zoom the map in so far that one node fills it

let canvas, box;
let dragging = false;
let frame = 0;

export function initMinimap(){
  box = el('minimap');
  canvas = el('minimapCanvas');

  const jump = ev => {
    const r = canvas.getBoundingClientRect();
    const t = transform();
    if (!t) return;
    centerOn(t.x0 + (ev.clientX - r.left) / t.scale, t.y0 + (ev.clientY - r.top) / t.scale);
  };

  canvas.addEventListener('pointerdown', ev => {
    dragging = true;
    canvas.setPointerCapture(ev.pointerId);
    jump(ev);
    ev.preventDefault();
    ev.stopPropagation();
  });
  canvas.addEventListener('pointermove', ev => { if (dragging) jump(ev); });
  canvas.addEventListener('pointerup', () => { dragging = false; });
  canvas.addEventListener('pointercancel', () => { dragging = false; });
  // The board is behind it; without this a drag on the map also pans.
  canvas.addEventListener('wheel', ev => ev.stopPropagation());

  el('bMap').addEventListener('click', toggle);
  onCameraChange(scheduleDraw);
  applyVisibility();
}

export function toggle(){
  ui().hideMap = !ui().hideMap;
  mark();
  applyVisibility();
}

function applyVisibility(){
  const hidden = !!ui().hideMap;
  box.hidden = hidden;
  el('bMap').classList.toggle('on', !hidden);
  if (!hidden) drawMinimap();
}

export function scheduleDraw(){
  if (frame || !box || box.hidden) return;
  frame = requestAnimationFrame(() => { frame = 0; drawMinimap(); });
}

/** World → minimap pixels, fitted to everything on the board. */
function transform(){
  if (!S.scenes.length) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  S.scenes.forEach(s => {
    const h = nodeSize(s.id).h;
    x0 = Math.min(x0, s.x); y0 = Math.min(y0, s.y);
    x1 = Math.max(x1, s.x + NODE_W); y1 = Math.max(y1, s.y + h);
  });

  // Include the viewport, so the marker never sits off the edge of the map.
  const v = viewportRect();
  x0 = Math.min(x0, v.x); y0 = Math.min(y0, v.y);
  x1 = Math.max(x1, v.x + v.w); y1 = Math.max(y1, v.y + v.h);

  x0 -= PAD; y0 -= PAD; x1 += PAD; y1 += PAD;
  const spanX = Math.max(MIN_SPAN, x1 - x0);
  const spanY = Math.max(MIN_SPAN * 0.66, y1 - y0);
  const scale = Math.min(canvas.clientWidth / spanX, canvas.clientHeight / spanY);
  return { x0, y0, scale };
}

function drawMinimap(){
  if (!canvas || !box || box.hidden) return;

  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;

  const g = canvas.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);

  const t = transform();
  if (!t) return;
  const px = x => (x - t.x0) * t.scale;
  const py = y => (y - t.y0) * t.scale;

  /* passages first, so nodes sit on top */
  g.strokeStyle = '#54685C88';
  g.lineWidth = 1;
  g.beginPath();
  S.connections.forEach(c => {
    const a = S.scenes.find(s => s.id === c.from);
    const b = S.scenes.find(s => s.id === c.to);
    if (!a || !b) return;
    const ah = nodeSize(a.id).h, bh = nodeSize(b.id).h;
    g.moveTo(px(a.x + NODE_W / 2), py(a.y + ah / 2));
    g.lineTo(px(b.x + NODE_W / 2), py(b.y + bh / 2));
  });
  g.stroke();

  /* one block per scene, in the scene's own colour */
  S.scenes.forEach(s => {
    const size = nodeSize(s.id);
    const x = px(s.x), y = py(s.y);
    const bw = Math.max(3, NODE_W * t.scale), bh = Math.max(2, size.h * t.scale);
    const chosen = sel && sel.kind === 'scene' && sel.id === s.id;
    g.fillStyle = safeColor(s.color, '#54685C') + (chosen ? 'FF' : 'AA');
    g.fillRect(x, y, bw, bh);
    if (chosen){
      g.strokeStyle = '#EAE3D2';
      g.lineWidth = 1.5;
      g.strokeRect(x - .75, y - .75, bw + 1.5, bh + 1.5);
    }
  });

  /* where we are looking */
  const v = viewportRect();
  g.strokeStyle = '#EAE3D2CC';
  g.lineWidth = 1.5;
  g.strokeRect(px(v.x), py(v.y), v.w * t.scale, v.h * t.scale);
  g.fillStyle = '#EAE3D214';
  g.fillRect(px(v.x), py(v.y), v.w * t.scale, v.h * t.scale);
}
