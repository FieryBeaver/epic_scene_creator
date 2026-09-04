/**
 * Locations — the rooms inside a scene.
 *
 * A room is a hall, a corridor, a stretch of cave. It carries a description,
 * optional treasure, optional links, and one slot per registry: a room may
 * hold the tomb of a god, a skeleton key, or whatever list the DM invented.
 */

import { t } from '../i18n/index.js';

import { uid, byId, regs } from './state.js';

/** Rooms of a scene, created lazily. */
export function locs(s){
  return s.locations || (s.locations = []);
}

export function isTreasure(l){
  return !!l.hasTre;
}

/**
 * The registry entry of a room: `{registryId: itemId}`.
 *
 * At most one. A tomb or a skeleton key *is* a room, rather than something
 * kept inside one — so a room is either a plain room or that one thing.
 */
export function slots(l){
  return l.reg || (l.reg = {});
}

/** Resolved registry slots as `[{r: registry, it: item}]`, skipping dead ids. */
export function slotList(l){
  const out = [];
  regs().forEach(r => {
    const itemId = slots(l)[r.id];
    if (!itemId) return;
    const it = byId(r.items, itemId);
    if (it) out.push({ r, it });
  });
  return out;
}

export function mkLoc(patch){
  return Object.assign({
    id: uid('l'), nm: '', notes: '', reg: {}, parent: '',
    hasTre: false, tre: '', guard: '', taken: false, links: [],
  }, patch || {});
}

/* ============================================================
   Nesting
   ============================================================
   Rooms hold rooms: a forge contains its bellows and its office. Storage
   stays a flat list with a `parent` id — the alternative, nesting the arrays,
   makes every existing walk over `locs(s)` wrong and every id lookup a
   recursion.
   ============================================================ */

/** Direct children of a room, in board order. */
export function childrenOf(s, parentId){
  return locs(s).filter(l => (l.parent || '') === parentId);
}

/** Top-level rooms: the ones whose parent is gone or never set. */
export function rootRooms(s){
  const known = new Set(locs(s).map(l => l.id));
  return locs(s).filter(l => !l.parent || !known.has(l.parent));
}

/** A room and everything under it, depth first. */
export function subtree(s, id){
  const out = [];
  const walk = pid => childrenOf(s, pid).forEach(child => { out.push(child); walk(child.id); });
  walk(id);
  return out;
}

/** How deep a room sits, for indenting. */
export function roomDepth(s, l){
  let depth = 0;
  let node = l;
  const seen = new Set();
  while (node && node.parent && !seen.has(node.id)){
    seen.add(node.id);
    node = byId(locs(s), node.parent);
    if (node) depth++;
  }
  return depth;
}

/**
 * May `id` be moved inside `parentId`? Not into itself, and not into its own
 * descendant — that would cut the pair loose from the tree entirely.
 */
export function canNest(s, id, parentId){
  if (!parentId) return true;
  if (id === parentId) return false;
  return !subtree(s, id).some(x => x.id === parentId);
}

/** Re-parent a room, refusing moves that would make a loop. */
export function setParent(s, id, parentId){
  if (!canNest(s, id, parentId)) return false;
  const l = byId(locs(s), id);
  if (!l) return false;
  l.parent = parentId || '';
  return true;
}

/**
 * Remove a room, lifting its children to where it was.
 *
 * Deleting the subtree would be one click away from losing a whole wing of a
 * dungeon, with no undo to reach for.
 */
export function removeRoom(s, id){
  const gone = byId(locs(s), id);
  if (!gone) return;
  childrenOf(s, id).forEach(child => { child.parent = gone.parent || ''; });
  s.locations = locs(s).filter(l => l.id !== id);
}

/** A room nobody filled in. Dropped automatically when slots are cleared. */
export function locEmpty(l){
  return !l.nm && !l.notes && !l.hasTre && !(l.links || []).length
      && !Object.values(l.reg || {}).some(Boolean);
}

/** Display name: explicit, else derived from the first registry item, else generic. */
export function locName(l){
  if (l.nm) return l.nm;
  const sl = slotList(l);
  if (sl.length) return ((sl[0].r.one || sl[0].r.nm) + ' ' + sl[0].it.nm).trim();
  if (l.hasTre) return t('room.treasureRoom');
  return t('room.generic');
}

/** Glyphs for the room: one per registry item, plus ◈ when it holds treasure. */
export function locIcon(l){
  let s = slotList(l).map(x => x.it.sym || x.r.sym || '◆').join('');
  if (l.hasTre) s += '◈';
  return s || '▣';
}

/** Colour taken from the first registry that claims the room. */
export function locColor(l){
  const sl = slotList(l);
  if (sl.length) return sl[0].r.color || '#C7D6E0';
  return l.hasTre ? '#F0CE96' : '#C7D6E0';
}

export function locLinks(l){
  return l.links || (l.links = []);
}

/** `{r, it}` when this room *is* a registry item, else null. */
export function regRoom(l){
  return slotList(l)[0] || null;
}

/**
 * The room's description.
 *
 * For a registry room it lives on the list item, so all nine tombs can be
 * written in one place before any of them is placed; `notes` stays the
 * fallback for boards written before that was true.
 */
export function locDesc(l){
  const owner = regRoom(l);
  if (owner) return owner.it.desc || l.notes || '';
  return l.notes || '';
}

/** Where an edit to that description should be written. */
export function locDescPath(l, roomPath){
  const owner = regRoom(l);
  return owner ? `r:${owner.r.id}:items:${owner.it.id}:desc` : `${roomPath}:notes`;
}
