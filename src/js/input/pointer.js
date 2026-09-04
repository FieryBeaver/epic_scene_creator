/**
 * Pointer work on the board: panning, zooming, dragging scene cards,
 * dragging tokens between scenes and connections, and completing a link.
 *
 * Node drags bypass the renderer: the card is moved with a transform and only
 * its own edges are updated, so a drag costs one transform per frame instead
 * of a full rebuild.
 */

import { S, mode, mark, scene, token, marked, setMarked, toggleMarked } from '../core/state.js';
import { newConn } from '../core/model.js';
import { toast, el } from '../util/dom.js';
import { NODE_W, nodeEl, nodeSize } from '../ui/nodes.js';
import { cam, applyCam, screenToWorld, setZoom, ZOOM_MIN, ZOOM_MAX } from '../ui/camera.js';
import { moveEdgesOf } from '../ui/edges.js';
import { renderAll, select } from '../ui/render.js';
import { isLinking, linkFrom, startLink, stopLink } from './linkmode.js';
import { createSceneAt } from './scenes.js';

/** Scene cards snap to this grid while dragging. */
const SNAP = 8;

let drag = null;

export function initPointer(){
  const wrap = el('boardWrap');

  wrap.addEventListener('pointerdown', ev => onDown(wrap, ev));
  wrap.addEventListener('pointermove', onMove);
  wrap.addEventListener('pointerup', ev => onUp(wrap, ev));
  wrap.addEventListener('pointercancel', () => onCancel(wrap));
  wrap.addEventListener('wheel', ev => onWheel(wrap, ev), { passive: false });
  wrap.addEventListener('dblclick', onDblClick);
}

function onDown(wrap, ev){
  if (ev.button === 2) return;                       // leave the context menu alone

  const tokEl = ev.target.closest('.tok');
  const head = ev.target.closest('.node .head');
  const nodeE = ev.target.closest('.node');

  if (isLinking()){
    handleLinkClick(nodeE, ev);
    return;
  }

  if (tokEl && startTokenDrag(wrap, tokEl, ev)) return;
  if (head && nodeE && !ev.target.closest('[data-fold]')
      && startNodeDrag(wrap, nodeE, ev)) return;

  // Interactive furniture inside cards and labels handles its own clicks.
  if (ev.target.closest('[data-ctr], .mini, .ctr, .elabel, #hud, #minimap, [data-conn]')) return;

  if (nodeE){
    pickScene(nodeE.dataset.scene, ev);
    return;
  }

  // Shift on empty board draws a selection box; a plain drag still pans.
  // That split is React Flow's default and the one people arrive expecting.
  if (ev.shiftKey && mode !== 'view'){
    startMarquee(wrap, ev);
    return;
  }

  if (!ev.shiftKey && marked.size){
    setMarked([]);
    renderAll();
  }

  drag = { kind: 'pan', sx: ev.clientX, sy: ev.clientY, cx: cam.x, cy: cam.y, moved: false };
  wrap.classList.add('panning');
  wrap.setPointerCapture(ev.pointerId);
}

/** Click on a card: shift/ctrl adds to the group, a plain click replaces it. */
function pickScene(id, ev){
  if ((ev.shiftKey || ev.ctrlKey || ev.metaKey) && mode !== 'view'){
    toggleMarked(id);
    select('scene', id);
    renderAll();
    return;
  }
  setMarked([id]);
  select('scene', id);
}

function handleLinkClick(nodeE, ev){
  if (nodeE){
    const id = nodeE.dataset.scene;
    if (!linkFrom()){
      startLink(id);
    } else {
      const made = newConn(linkFrom(), id);
      stopLink();
      renderAll();
      if (made){
        if (made.duplicate){
          toast('Ще одне з\'єднання між тими самими сценами — вкажіть боки, щоб їх розвести');
        }
        select('conn', made.conn.id);
      }
    }
    ev.preventDefault();
  } else if (!ev.target.closest('#hud')){
    stopLink();
  }
}

function startTokenDrag(wrap, tokEl, ev){
  const t = token(tokEl.dataset.token);
  if (!t) return false;

  const ghost = tokEl.cloneNode(true);
  ghost.classList.add('ghost');
  ghost.style.left = ev.clientX + 8 + 'px';
  ghost.style.top = ev.clientY + 8 + 'px';
  document.body.appendChild(ghost);

  drag = { kind: 'token', id: t.id, ghost };
  wrap.setPointerCapture(ev.pointerId);
  ev.preventDefault();
  ev.stopPropagation();
  return true;
}

function startNodeDrag(wrap, nodeE, ev){
  const s = scene(nodeE.dataset.scene);
  if (!s) return false;

  // Dragging one of a marked group moves the whole group; dragging anything
  // else drops the group first, so a stray drag cannot scatter the board.
  const group = marked.has(s.id) && marked.size > 1;
  if (!group) setMarked([s.id]);

  select('scene', s.id);
  renderAll();

  const w0 = screenToWorld(ev.clientX, ev.clientY);
  const ids = group ? [...marked].filter(id => scene(id)) : [s.id];
  const movers = ids.map(id => {
    const target = scene(id);
    const element = nodeEl(id);
    if (element) element.style.willChange = 'transform';
    return { id, el: element, ox: target.x, oy: target.y };
  }).filter(m => m.el);

  drag = {
    kind: 'node', id: s.id, movers,
    dx: w0.x - s.x, dy: w0.y - s.y,
    moved: false, raf: 0,
  };
  wrap.setPointerCapture(ev.pointerId);
  ev.preventDefault();
  return true;
}

function startMarquee(wrap, ev){
  const box = el('marquee');
  box.hidden = false;
  const r = wrap.getBoundingClientRect();
  drag = {
    kind: 'marquee', box, rect: r,
    sx: ev.clientX - r.left, sy: ev.clientY - r.top,
    add: ev.ctrlKey || ev.metaKey ? new Set(marked) : new Set(),
  };
  drawMarquee(drag, drag.sx, drag.sy);
  wrap.setPointerCapture(ev.pointerId);
  ev.preventDefault();
}

function drawMarquee(d, x, y){
  const left = Math.min(d.sx, x), top = Math.min(d.sy, y);
  d.box.style.left = left + 'px';
  d.box.style.top = top + 'px';
  d.box.style.width = Math.abs(x - d.sx) + 'px';
  d.box.style.height = Math.abs(y - d.sy) + 'px';
}

/** Every scene whose card overlaps the box, in world coordinates. */
function insideMarquee(d, x, y){
  const a = screenToWorld(d.rect.left + Math.min(d.sx, x), d.rect.top + Math.min(d.sy, y));
  const b = screenToWorld(d.rect.left + Math.max(d.sx, x), d.rect.top + Math.max(d.sy, y));
  return S.scenes.filter(s => {
    const h = nodeSize(s.id).h;
    return s.x < b.x && s.x + NODE_W > a.x && s.y < b.y && s.y + h > a.y;
  }).map(s => s.id);
}

function onMove(ev){
  if (!drag) return;

  if (drag.kind === 'pan'){
    cam.x = drag.cx + (ev.clientX - drag.sx);
    cam.y = drag.cy + (ev.clientY - drag.sy);
    if (Math.abs(ev.clientX - drag.sx) + Math.abs(ev.clientY - drag.sy) > 3) drag.moved = true;
    applyCam();
    return;
  }

  if (drag.kind === 'node'){
    drag.px = ev.clientX;
    drag.py = ev.clientY;
    drag.moved = true;
    if (!drag.raf) drag.raf = requestAnimationFrame(dragNodeFrame);
    return;
  }

  if (drag.kind === 'marquee'){
    const x = ev.clientX - drag.rect.left, y = ev.clientY - drag.rect.top;
    drawMarquee(drag, x, y);
    drag.hits = insideMarquee(drag, x, y);
    return;
  }

  if (drag.kind === 'token'){
    drag.ghost.style.left = ev.clientX + 8 + 'px';
    drag.ghost.style.top = ev.clientY + 8 + 'px';
  }
}

function dragNodeFrame(){
  if (!drag || drag.kind !== 'node') return;
  drag.raf = 0;
  const lead = scene(drag.id);
  if (!lead) return;

  // One delta, applied to everything being dragged, so the group keeps shape.
  const w = screenToWorld(drag.px, drag.py);
  const anchor = drag.movers.find(m => m.id === drag.id) || drag.movers[0];
  const nx = Math.round((w.x - drag.dx) / SNAP) * SNAP;
  const ny = Math.round((w.y - drag.dy) / SNAP) * SNAP;
  const dx = nx - anchor.ox, dy = ny - anchor.oy;

  drag.movers.forEach(m => {
    const s = scene(m.id);
    if (!s) return;
    s.x = m.ox + dx;
    s.y = m.oy + dy;
    m.el.style.transform = `translate(${dx}px,${dy}px)`;
    moveEdgesOf(m.id);
  });
}

function onUp(wrap, ev){
  if (!drag) return;

  if (drag.kind === 'token'){
    dropToken(ev);
    return;
  }

  if (drag.kind === 'marquee'){
    drag.box.hidden = true;
    const hits = drag.hits || [];
    setMarked([...drag.add, ...hits]);
    drag = null;
    wrap.classList.remove('panning');
    renderAll();
    return;
  }

  if (drag.kind === 'node'){
    if (drag.raf) cancelAnimationFrame(drag.raf);
    drag.movers.forEach(m => {
      const s = scene(m.id);
      m.el.style.willChange = '';
      m.el.style.transform = '';
      if (s){
        m.el.style.left = s.x + 'px';
        m.el.style.top = s.y + 'px';
        moveEdgesOf(m.id);
      }
    });
    if (drag.moved) mark();
  }

  wrap.classList.remove('panning');
  drag = null;
}

function dropToken(ev){
  drag.ghost.remove();
  const t = token(drag.id);
  drag = null;
  if (!t) return;

  const under = document.elementFromPoint(ev.clientX, ev.clientY);
  const node = under && under.closest('.node');
  const connEl = under && under.closest('[data-conn]');

  if (node) t.at = { kind: 'scene', id: node.dataset.scene };
  else if (connEl) t.at = { kind: 'conn', id: connEl.getAttribute('data-conn') };
  else if (under && under.closest('#boardWrap')) t.at = null;   // dropped on bare board

  mark();
  renderAll();
}

function onCancel(wrap){
  if (drag && drag.ghost) drag.ghost.remove();
  if (drag && drag.box) drag.box.hidden = true;
  if (drag && drag.kind === 'node' && drag.raf) cancelAnimationFrame(drag.raf);
  drag = null;
  wrap.classList.remove('panning');
}

function onWheel(wrap, ev){
  ev.preventDefault();
  const r = wrap.getBoundingClientRect();
  const factor = Math.exp(-ev.deltaY * 0.0016);
  const next = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, cam.z * factor));
  setZoom(next, ev.clientX - r.left, ev.clientY - r.top);
}

function onDblClick(ev){
  if (mode === 'view') return;
  if (ev.target.closest('.node, [data-conn], #hud')) return;
  const w = screenToWorld(ev.clientX, ev.clientY);
  createSceneAt(Math.round((w.x - NODE_W / 2) / SNAP) * SNAP, Math.round((w.y - 40) / SNAP) * SNAP);
}
