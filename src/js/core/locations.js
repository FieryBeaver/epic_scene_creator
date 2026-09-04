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
    id: uid('l'), nm: '', notes: '', reg: {},
    hasTre: false, tre: '', guard: '', taken: false, links: [],
  }, patch || {});
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
