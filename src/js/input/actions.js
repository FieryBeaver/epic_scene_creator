/**
 * Click handling for the whole app.
 *
 * One delegated listener reads the `data-*` attribute on whatever was
 * clicked. Markup therefore stays declarative and re-rendering never has to
 * rebind anything.
 */

import { S, sel, byId, mark, scene, conn, regs, reg, uid, setSel } from '../core/state.js';
import {
  delScene, delConn, delToken, mkToken,
  newDanger, newBlock, newEvent, newCounter,
} from '../core/model.js';
import { locs, mkLoc, locLinks, locEmpty } from '../core/locations.js';
import { hostOf, place, clearSlot } from '../core/registries.js';
import { setPath } from '../core/paths.js';
import { renderAll, renderLive, select } from '../ui/render.js';
import { focusScene } from '../ui/camera.js';
import { renderInsp } from '../ui/inspector/index.js';
import { setTab } from '../ui/rail.js';
import { startLink } from './linkmode.js';

export function initActions(){
  document.addEventListener('click', onClick);
  document.addEventListener('click', onDangerLevel);
}

function onClick(ev){
  const target = ev.target;
  const hit = attr => target.closest(`[${attr}]`);
  let e;

  /* ---------- navigation ---------- */
  if ((e = hit('data-goto'))){ focusScene(e.getAttribute('data-goto')); return; }
  if ((e = hit('data-selconn'))){ select('conn', e.getAttribute('data-selconn')); return; }
  if ((e = hit('data-seltoken'))){ select('token', e.getAttribute('data-seltoken')); return; }
  if ((e = hit('data-conn'))){ select('conn', e.getAttribute('data-conn')); return; }

  /* ---------- counters (live game state, allowed in view mode) ---------- */
  if ((e = hit('data-ctr'))){ bumpCounter(e.getAttribute('data-ctr')); return; }

  /* ---------- deletion ---------- */
  if ((e = hit('data-del'))){ delListItem(e.getAttribute('data-del')); return; }
  if ((e = hit('data-del-scene'))){
    if (confirm('Видалити сцену разом з її з\'єднаннями?')){
      delScene(e.getAttribute('data-del-scene'));
      renderAll();
    }
    return;
  }
  if ((e = hit('data-del-conn'))){ delConn(e.getAttribute('data-del-conn')); renderAll(); return; }
  if ((e = hit('data-del-token'))){ delToken(e.getAttribute('data-del-token')); renderAll(); return; }

  /* ---------- connections ---------- */
  if ((e = hit('data-swap'))){
    const c = conn(e.getAttribute('data-swap'));
    if (c){
      [c.from, c.to] = [c.to, c.from];
      [c.fromSide, c.toSide] = [c.toSide, c.fromSide];
      mark();
      renderAll();
    }
    return;
  }

  /* ---------- room links ---------- */
  if ((e = hit('data-addlink'))){ addLink(e.getAttribute('data-addlink')); return; }
  if ((e = hit('data-dellink'))){ delLink(e.getAttribute('data-dellink')); return; }

  /* ---------- adding things ---------- */
  if ((e = hit('data-add'))){ addItem(e.getAttribute('data-add'), e.getAttribute('data-id')); return; }
  if ((e = hit('data-newtok'))){ newToken(e.getAttribute('data-newtok')); return; }
  if ((e = hit('data-place'))){ placeItem(e.getAttribute('data-place')); return; }

  /* ---------- registries ---------- */
  if (target.closest('[data-addreg]')){ addRegistry(); return; }
  if ((e = hit('data-delreg'))){ delRegistry(e.getAttribute('data-delreg')); return; }
  if ((e = hit('data-additem'))){ addRegistryItem(e.getAttribute('data-additem')); return; }
  if ((e = hit('data-delitem'))){ delRegistryItem(e.getAttribute('data-delitem')); return; }

  /* ---------- fold a card shut ---------- */
  if ((e = hit('data-fold'))){
    const s = scene(e.getAttribute('data-fold'));
    if (s){ s.collapsed = !s.collapsed; mark(); renderAll(); }
    return;
  }

  /* ---------- node footer buttons ---------- */
  if ((e = hit('data-act'))){
    const action = e.getAttribute('data-act');
    const id = e.getAttribute('data-id');
    if (action === 'open') select('scene', id);
    if (action === 'link') startLink(id);
  }
}

/** Danger level pips: `<span class="lvl" data-lvl="…"><button data-v="2">`. */
function onDangerLevel(ev){
  const b = ev.target.closest('.lvl button');
  if (!b) return;
  const path = b.parentElement.getAttribute('data-lvl');
  setPath(path + ':lvl', parseInt(b.getAttribute('data-v'), 10));
  renderAll();
}

/* ============================================================
   Handlers
   ============================================================ */

/** `data-ctr="s|c:<hostId>:<counterId>:<delta>"` */
function bumpCounter(spec){
  const [kind, hostId, counterId, delta] = spec.split(':');
  const host = kind === 's' ? scene(hostId) : conn(hostId);
  const counter = host && byId(host.counters, counterId);
  if (!counter) return;
  counter.value = (counter.value | 0) + parseInt(delta, 10);
  mark();
  renderLive();
  renderInsp();
}

/** `data-del="s|c:<hostId>:<arrayName>:<itemId>"` */
function delListItem(spec){
  const [kind, hostId, arrayName, itemId] = spec.split(':');
  const host = kind === 's' ? scene(hostId) : conn(hostId);
  if (!host || !Array.isArray(host[arrayName])) return;
  host[arrayName] = host[arrayName].filter(x => x.id !== itemId);
  mark();
  renderAll();
}

/** `data-addlink="<sceneId>:<locId>"` */
function addLink(spec){
  const [sceneId, locId] = spec.split(':');
  const s = scene(sceneId);
  const l = s && byId(locs(s), locId);
  if (!l) return;
  locLinks(l).push({ id: uid('k'), label: '', url: '' });
  mark();
  renderAll();
}

/** `data-dellink="<sceneId>:<locId>:<linkId>"` */
function delLink(spec){
  const [sceneId, locId, linkId] = spec.split(':');
  const s = scene(sceneId);
  const l = s && byId(locs(s), locId);
  if (!l) return;
  l.links = locLinks(l).filter(x => x.id !== linkId);
  mark();
  renderAll();
}

/** `data-add="<kind>" data-id="<hostId>"` */
function addItem(kind, id){
  const s = scene(id);

  if (kind === 'token'){
    const t = mkToken('other', 'Токен', { kind: 'scene', id });
    setSel({ kind: 'token', id: t.id });
    renderAll();
    return;
  }

  if (kind === 'conncounter'){
    const c = conn(id);
    if (c) c.counters.push(newCounter('проходів'));
  } else if (s){
    if (kind === 'danger') s.dangers.push(newDanger());
    if (kind === 'block') s.blocks.push(newBlock());
    if (kind === 'event') s.events.push(newEvent());
    if (kind === 'counter') s.counters.push(newCounter());
    if (kind === 'loc') locs(s).push(mkLoc());
    if (kind === 'loctre') locs(s).push(mkLoc({ hasTre: true }));
  }

  mark();
  renderAll();
}

/** `data-newtok="<type>"` — drops the token into the selected scene, if any. */
function newToken(type){
  const at = sel && sel.kind === 'scene' ? { kind: 'scene', id: sel.id } : null;
  const t = mkToken(type, null, at);
  setSel({ kind: 'token', id: t.id });
  renderAll();
}

/** `data-place="<sceneId>:<regId>:<itemId>"` — toggle an item into this scene. */
function placeItem(spec){
  const [sceneId, regId, itemId] = spec.split(':');
  const host = hostOf(regId, itemId);
  place(regId, itemId, host && host.id === sceneId ? null : sceneId);
  renderAll();
}

function addRegistry(){
  const r = { id: uid('g'), nm: 'Новий список', one: '', sym: '◆', color: '#6A9BD1', items: [] };
  regs().push(r);
  setTab('reg-' + r.id);
  mark();
  renderAll();

  // Land in the name field with the placeholder selected, so the first
  // keystroke names the list instead of appending to "Новий список".
  const name = document.querySelector(`#p-reg-${CSS.escape(r.id)} input[data-path$=":nm"]`);
  if (name){
    name.focus();
    name.select();
  }
}

function delRegistry(regId){
  const r = reg(regId);
  if (!r || !confirm(`Видалити список «${r.nm}» разом із прив'язками?`)) return;
  S.scenes.forEach(s => {
    locs(s).forEach(l => { if (l.reg) delete l.reg[regId]; });
    s.locations = locs(s).filter(l => !locEmpty(l));
  });
  S.registries = regs().filter(x => x.id !== regId);
  setTab('scenes');
  mark();
  renderAll();
}

function addRegistryItem(regId){
  const r = reg(regId);
  if (!r) return;
  r.items.push({ id: uid('i'), nm: 'Новий елемент', sym: '', note: '' });
  mark();
  renderAll();
}

/** `data-delitem="<regId>:<itemId>"` */
function delRegistryItem(spec){
  const [regId, itemId] = spec.split(':');
  const r = reg(regId);
  if (!r) return;
  clearSlot(regId, itemId);
  r.items = r.items.filter(x => x.id !== itemId);
  mark();
  renderAll();
}
