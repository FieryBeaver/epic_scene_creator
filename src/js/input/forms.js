/**
 * Form handling.
 *
 * Text fields update on `input` and only refresh the board and the scene
 * list, because re-rendering the inspector would take the caret with it.
 * Selects and checkboxes update on `change` and may rebuild everything,
 * since the choice can change which fields exist.
 */

import { t } from '../i18n/index.js';

import { sel, setSel, byId, mark, scene, conn, token, reg, uid } from '../core/state.js';
import { locs, mkLoc, locName, setParent } from '../core/locations.js';
import { place } from '../core/registries.js';
import { setPath } from '../core/paths.js';
import { mkToken, newDanger, newBlock, newEvent } from '../core/model.js';
import { TPL_DANGER, TPL_BLOCK, TPL_TREASURE, TPL_EVENT, TPL_CONN, tplName, tplText }
  from '../core/templates.js';
import { renderAll, renderLive } from '../ui/render.js';
import { toast } from '../util/dom.js';
import { setSearch, markSearchFocused } from '../ui/rail.js';

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

  if (el.id === 'sceneSearch'){
    markSearchFocused();
    setSearch(el.value);
    return;
  }

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
  if (el.hasAttribute('data-toreg')) return roomJoinsList(el);
  if (el.hasAttribute('data-nest')) return reparentRoom(el);
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

/**
 * A room becomes an entry in a list: a new item is created from the room's
 * own name and description, and the room is bound to it. The description
 * moves onto the item, since that is where v4 keeps it.
 */
function roomJoinsList(el){
  const [sceneId, locId] = el.getAttribute('data-toreg').split(':');
  const regId = el.value;
  el.value = '';
  if (!regId) return;

  const s = scene(sceneId);
  const l = s && byId(locs(s), locId);
  const r = reg(regId);
  if (!l || !r) return;

  const item = {
    id: uid('i'),
    nm: (l.nm || locName(l)).trim(),
    sym: '',
    note: '',
    desc: l.notes || '',
  };
  r.items.push(item);

  l.reg = { [regId]: item.id };
  l.nm = '';          // the item's name is the room's name now
  l.notes = '';       // and its description lives on the item
  mark();
  renderAll();
  toast(t('msg.joinedList', { item: item.nm, list: r.nm }));
}

/** Move a room inside another, or back out to the top level. */
function reparentRoom(el){
  const [sceneId, locId] = el.getAttribute('data-nest').split(':');
  const s = scene(sceneId);
  if (!s) return;
  setParent(s, locId, el.value);
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
  const tok = mkToken('boss', t('data.brokeThrough', { name: el.value }), at);
  el.value = '';
  setSel({ kind: 'token', id: tok.id });
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
    const tpl = TPL_DANGER[index];
    s.dangers.push(Object.assign(newDanger(), {
      nm: tplName('danger', tpl), what: tplText('danger', tpl, 'what'),
      fix: tplText('danger', tpl, 'fix'), lvl: tpl.lvl,
    }));
  }
  if (kind === 'block' && s){
    const tpl = TPL_BLOCK[index];
    s.blocks.push(Object.assign(newBlock(), {
      nm: tplName('block', tpl), what: tplText('block', tpl, 'what'),
      key: tplText('block', tpl, 'key'),
    }));
  }
  if (kind === 'event' && s){
    const tpl = TPL_EVENT[index];
    s.events.push(Object.assign(newEvent(), {
      nm: tplName('event', tpl), trig: tplText('event', tpl, 'trig'),
      eff: tplText('event', tpl, 'eff'),
    }));
  }
  if (kind === 'treasure' && s){
    const tpl = TPL_TREASURE[index];
    locs(s).push(mkLoc({
      nm: tplName('treasure', tpl), hasTre: true,
      tre: tplText('treasure', tpl, 'what'), guard: tplText('treasure', tpl, 'guard'),
    }));
  }
  if (kind === 'conn'){
    const c = conn(id);
    const tpl = TPL_CONN[index];
    if (c && tpl){
      c.name = tplName('conn', tpl);
      c.dir = tpl.dir;
      c.desc = tplText('conn', tpl, 'desc');
    }
  }

  mark();
  renderAll();
}
