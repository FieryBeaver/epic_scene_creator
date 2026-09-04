/**
 * Pointer work on the board: panning, zooming, dragging scene cards,
 * dragging tokens between scenes and connections, and completing a link.
 *
 * Node drags bypass the renderer: the card is moved with a transform and only
 * its own edges are updated, so a drag costs one transform per frame instead
 * of a full rebuild.
 */

import { mode, mark, scene, token } from '../core/state.js';
import { newConn } from '../core/model.js';
import { toast, el } from '../util/dom.js';
import { NODE_W, nodeEl } from '../ui/nodes.js';
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
  if (head && nodeE && startNodeDrag(wrap, nodeE, ev)) return;

  // Interactive furniture inside cards and labels handles its own clicks.
  if (ev.target.closest('[data-ctr], .mini, .ctr, .elabel, #hud, [data-conn]')) return;

  if (nodeE){
    select('scene', nodeE.dataset.scene);
    return;
  }

  drag = { kind: 'pan', sx: ev.clientX, sy: ev.clientY, cx: cam.x, cy: cam.y, moved: false };
  wrap.classList.add('panning');
  wrap.setPointerCapture(ev.pointerId);
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

  select('scene', s.id);
  // select() rebuilds the board, so re-read the element we are about to move.
  const element = nodeEl(s.id) || nodeE;
  const w0 = screenToWorld(ev.clientX, ev.clientY);

  drag = {
    kind: 'node', id: s.id, el: element,
    dx: w0.x - s.x, dy: w0.y - s.y,
    ox: s.x, oy: s.y,
    moved: false, raf: 0,
  };
  element.style.willChange = 'transform';
  wrap.setPointerCapture(ev.pointerId);
  ev.preventDefault();
  return true;
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

  if (drag.kind === 'token'){
    drag.ghost.style.left = ev.clientX + 8 + 'px';
    drag.ghost.style.top = ev.clientY + 8 + 'px';
  }
}

function dragNodeFrame(){
  if (!drag || drag.kind !== 'node') return;
  drag.raf = 0;
  const s = scene(drag.id);
  if (!s) return;
  const w = screenToWorld(drag.px, drag.py);
  s.x = Math.round((w.x - drag.dx) / SNAP) * SNAP;
  s.y = Math.round((w.y - drag.dy) / SNAP) * SNAP;
  drag.el.style.transform = `translate(${s.x - drag.ox}px,${s.y - drag.oy}px)`;
  moveEdgesOf(s.id);
}

function onUp(wrap, ev){
  if (!drag) return;

  if (drag.kind === 'token'){
    dropToken(ev);
    return;
  }

  if (drag.kind === 'node'){
    if (drag.raf) cancelAnimationFrame(drag.raf);
    const s = scene(drag.id);
    drag.el.style.willChange = '';
    drag.el.style.transform = '';
    if (s){
      drag.el.style.left = s.x + 'px';
      drag.el.style.top = s.y + 'px';
      moveEdgesOf(s.id);
    }
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
