/**
 * Viewport: pan, zoom, the grid backdrop and the two "take me there" moves
 * (fit everything / focus one scene).
 *
 * World coordinates are what scenes store; screen coordinates are what the
 * pointer speaks. `cam` maps between them.
 */

import { S } from '../core/state.js';
import { el } from '../util/dom.js';
import { NODE_W, nodeSize, nodeEl } from './nodes.js';
import { select } from './render.js';

export const cam = { x: 0, y: 0, z: 1 };

export const ZOOM_MIN = 0.2;
export const ZOOM_MAX = 2.2;

let wrap, world, gridCanvas, zoomLabel;
let gridRaf = 0;

export function initCamera(){
  wrap = el('boardWrap');
  world = el('world');
  gridCanvas = el('grid');
  zoomLabel = el('zLbl');
  window.addEventListener('resize', drawGrid);
}

/** Push the camera into the DOM and schedule a grid repaint. */
export function applyCam(){
  world.style.transform = `translate(${cam.x}px,${cam.y}px) scale(${cam.z})`;
  zoomLabel.textContent = Math.round(cam.z * 100) + '%';
  if (!gridRaf) gridRaf = requestAnimationFrame(() => { gridRaf = 0; drawGrid(); });
}

export function drawGrid(){
  if (!gridCanvas) return;
  const r = wrap.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  gridCanvas.width = r.width * dpr;
  gridCanvas.height = r.height * dpr;
  gridCanvas.style.width = r.width + 'px';
  gridCanvas.style.height = r.height + 'px';

  const g = gridCanvas.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, r.width, r.height);

  const step = 48 * cam.z;
  if (step < 9) return;                 // too dense to be anything but noise
  g.strokeStyle = '#FFFFFF08';
  g.lineWidth = 1;
  const ox = cam.x % step, oy = cam.y % step;
  g.beginPath();
  for (let x = ox; x < r.width; x += step){ g.moveTo(x + .5, 0); g.lineTo(x + .5, r.height); }
  for (let y = oy; y < r.height; y += step){ g.moveTo(0, y + .5); g.lineTo(r.width, y + .5); }
  g.stroke();
}

export function screenToWorld(clientX, clientY){
  const r = wrap.getBoundingClientRect();
  return { x: (clientX - r.left - cam.x) / cam.z, y: (clientY - r.top - cam.y) / cam.z };
}

/** Centre of the board in world coordinates. */
export function viewCenter(){
  const r = wrap.getBoundingClientRect();
  return screenToWorld(r.left + r.width / 2, r.top + r.height / 2);
}

function centerOn(x, y, z){
  const r = wrap.getBoundingClientRect();
  if (z) cam.z = z;
  cam.x = r.width / 2 - x * cam.z;
  cam.y = r.height / 2 - y * cam.z;
  applyCam();
}

export function setZoom(z, anchorX, anchorY){
  const next = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
  if (anchorX != null){
    cam.x = anchorX - (anchorX - cam.x) * (next / cam.z);
    cam.y = anchorY - (anchorY - cam.y) * (next / cam.z);
  }
  cam.z = next;
  applyCam();
}

export function setCamera(c){
  cam.x = Number(c.x) || 0;
  cam.y = Number(c.y) || 0;
  cam.z = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Number(c.z) || 1));
  applyCam();
}

/** Centre on a scene, select it and flash its border. */
export function focusScene(id){
  const s = S.scenes.find(x => x.id === id);
  if (!s) return;
  const size = nodeSize(id);
  centerOn(s.x + size.w / 2, s.y + size.h / 2, Math.max(cam.z, .85));
  select('scene', id);
  const node = nodeEl(id);
  if (node){
    node.classList.add('hl');
    setTimeout(() => node.classList.remove('hl'), 1400);
  }
}

/** Zoom out until the whole board fits, with a margin. */
export function fitAll(){
  if (!S.scenes.length){
    cam.x = 40; cam.y = 40; cam.z = 1;
    applyCam();
    return;
  }
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  S.scenes.forEach(s => {
    const h = nodeSize(s.id).h;
    x0 = Math.min(x0, s.x);
    y0 = Math.min(y0, s.y);
    x1 = Math.max(x1, s.x + NODE_W);
    y1 = Math.max(y1, s.y + h);
  });
  const r = wrap.getBoundingClientRect(), pad = 70;
  cam.z = Math.min(1.2, Math.max(.25, Math.min(
    (r.width - pad * 2) / (x1 - x0 || 1),
    (r.height - pad * 2) / (y1 - y0 || 1))));
  centerOn((x0 + x1) / 2, (y0 + y1) / 2);
}
