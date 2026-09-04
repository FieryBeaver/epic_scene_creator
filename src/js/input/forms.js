/**
 * Form handling.
 *
 * Text fields update on `input` and only refresh the board and the scene
 * list, because re-rendering the inspector would take the caret with it.
 * Selects and checkboxes update on `change` and may rebuild everything,
 * since the choice can change which fields exist.
 */

import { sel, setSel, byId, mark, scene, conn, token } from '../core/state.js';
import { locs, slots, mkLoc } from '../core/locations.js';
import { clearSlot, place } from '../core/registries.js';
import { setPath } from '../core/paths.js';
import { mkToken, newDanger, newBlock, newEvent } from '../core/model.js';
import { TPL_DANGER, TPL_BLOCK, TPL_TREASURE, TPL_EVENT, TPL_CONN } from '../core/templates.js';
import { renderAll, renderLive } from '../ui/render.js';

/** Debounce for the cheap re-render while typing. */
const LIVE_DELAY = 200;
let liveTimer = 0;

export function initForms(){
  document.addEventListener('input', onInput);
  document.addEventListener('change', onChange);
}

function fieldValue(el){
  let v = el.type === 'checkbox' ? el.checked : el.value;
  if (el.dataset.num) v = v === '' ? 0 : Number(v);
  return v;
}

function onInput(ev){
  const el = ev.target;
  const path = el.getAttribute && el.getAttribute('data-path');
  if (!path) return;
  setPath(path, fieldValue(el));
  clearTimeout(liveTimer);
  liveTimer = setTimeout(renderLive, LIVE_DELAY);
}

function onChange(ev){
  const el = ev.target;
  if (!el.getAttribute) return;

  if (el.hasAttribute('data-fire')) return fireEvent(el);
  if (el.hasAttribute('data-path')) return changePath(el);
  if (el.hasAttribute('data-setitem')) return setRegistryItemScene(el);
  if (el.hasAttribute('data-slot')) return setRoomSlot(el);
  if (el.hasAttribute('data-movetok')) return moveToken(el);
  if (el.hasAttribute('data-boss-tpl')) return spawnBoss(el);
  if (el.hasAttribute('data-tpl')) return applyTemplate(el);
}

/* ---------- generic field ---------- */

function changePath(el){
  const path = el.getAttribute('data-path');
  setPath(path, fieldValue(el));

  // Changing the kind of thing a block covers invalidates the old target,
  // and changing the source scene invalidates the room chosen inside it.
  if (path.endsWith(':tgtKind')) setPath(path.replace(/:tgtKind$/, ':tgt'), '');
  if (path.endsWith(':src')) setPath(path + 'Loc', '');

  if (el.tagName === 'SELECT' || el.type === 'checkbox') renderAll();
  else renderLive();
}

/* ---------- events firing ---------- */

/**
 * Marking an event as fired applies its effect: the connection it names
 * opens or closes. Un-checking it puts the connection back.
 */
function fireEvent(el){
  const [sceneId, eventId] = el.getAttribute('data-fire').split(':');
  const s = scene(sceneId);
  const e = s && byId(s.events, eventId);
  if (!e) return;

  e.fired = el.checked;
  const c = e.conn ? conn(e.conn) : null;
  if (c) c.open = e.fired ? (e.act !== 'close') : (e.act === 'close');
  mark();
  renderAll();
}

/* ---------- registries ---------- */

/** Rail: move a registry item to a scene chosen from a dropdown. */
function setRegistryItemScene(el){
  const [regId, itemId] = el.getAttribute('data-setitem').split(':');
  place(regId, itemId, el.value);
  renderAll();
}

/** Scene form: assign a registry item to this particular room. */
function setRoomSlot(el){
  const [sceneId, locId, regId] = el.getAttribute('data-slot').split(':');
  const s = scene(sceneId);
  const l = s && byId(locs(s), locId);
  if (!l) return;

  if (el.value){
    clearSlot(regId, el.value, locId);   // one item, one room, board-wide
    slots(l)[regId] = el.value;
  } else {
    delete slots(l)[regId];
  }
  mark();
  renderAll();
}

/* ---------- tokens ---------- */

function moveToken(el){
  const t = token(el.getAttribute('data-movetok'));
  if (!t) return;
  t.at = el.value ? { kind: 'scene', id: el.value } : null;
  mark();
  renderAll();
}

function spawnBoss(el){
  if (!el.value) return;
  const at = sel && sel.kind === 'scene' ? { kind: 'scene', id: sel.id } : null;
  const t = mkToken('boss', el.value + ' (прорвався)', at);
  el.value = '';
  setSel({ kind: 'token', id: t.id });
  renderAll();
}

/* ---------- templates ---------- */

function applyTemplate(el){
  const kind = el.getAttribute('data-tpl');
  const id = el.getAttribute('data-id');
  const index = el.value;
  if (index === '') return;
  el.value = '';

  const s = scene(id);

  if (kind === 'danger' && s){
    const t = TPL_DANGER[index];
    s.dangers.push(Object.assign(newDanger(), { nm: t.nm, what: t.what, fix: t.fix, lvl: t.lvl }));
  }
  if (kind === 'block' && s){
    const t = TPL_BLOCK[index];
    s.blocks.push(Object.assign(newBlock(), { nm: t.nm, what: t.what, key: t.key }));
  }
  if (kind === 'event' && s){
    const t = TPL_EVENT[index];
    s.events.push(Object.assign(newEvent(), { nm: t.nm, trig: t.trig, eff: t.eff }));
  }
  if (kind === 'treasure' && s){
    const t = TPL_TREASURE[index];
    locs(s).push(mkLoc({ nm: t.nm, hasTre: true, tre: t.what, guard: t.guard }));
  }
  if (kind === 'conn'){
    const c = conn(id);
    const t = TPL_CONN[index];
    if (c && t){ c.name = t.nm; c.dir = t.dir; c.desc = t.desc; }
  }

  mark();
  renderAll();
}
