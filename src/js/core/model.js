/**
 * Entities and the queries that relate them: scenes, connections, tokens and
 * the things that live inside a scene (dangers, blocks, events, counters).
 *
 * Everything here mutates the board and nothing here renders — callers are
 * responsible for asking the view to refresh.
 */

import { t } from '../i18n/index.js';

import { S, uid, mark, scene, conn, sel, setSel } from './state.js';
import { SCENE_COLORS, tokenTypeName, tokenTypeColor } from './constants.js';
import { locs, locName, locIcon } from './locations.js';

/* ============================================================
   Creation
   ============================================================ */

export function newScene(x, y, patch){
  const n = S.scenes.length;
  const s = {
    id: uid('s'),
    name: t('data.newScene', { n: n + 1 }),
    dm: '',
    color: SCENE_COLORS[n % SCENE_COLORS.length],
    x: x | 0, y: y | 0,
    notes: '',
    collapsed: false,
    dangers: [], blocks: [], events: [], locations: [], counters: [],
  };
  Object.assign(s, patch || {});
  S.scenes.push(s);
  mark();
  return s;
}

/**
 * Connect two scenes. Returns null for a self-link. Parallel connections are
 * allowed (a corridor and a shaft between the same rooms) and get numbered.
 */
export function newConn(from, to){
  if (from === to) return null;
  const dup = S.connections.filter(
    c => (c.from === from && c.to === to) || (c.from === to && c.to === from)).length;
  const c = {
    id: uid('c'), from, to,
    name: dup ? t('data.connectionN', { n: dup + 1 }) : t('data.connection'),
    dir: 'two', fromSide: '', toSide: '', desc: '', minutes: 1, open: true, counters: [],
  };
  S.connections.push(c);
  mark();
  return { conn: c, duplicate: dup > 0 };
}

export function mkToken(type, name, at){
  const token = {
    id: uid('t'), name: name || tokenTypeName(type), type, color: tokenTypeColor(type),
    hp: '', notes: '', at: at || null,
  };
  S.tokens.push(token);
  mark();
  return token;
}

/**
 * Copy a scene, offset a little, with fresh ids throughout.
 *
 * Registry entries are deliberately *not* copied: a tomb is in exactly one
 * room on the whole board, so duplicating the room that holds it must not
 * claim to duplicate the tomb.
 */
export function duplicateScene(id, offset = 32){
  const src = scene(id);
  if (!src) return null;

  const copy = JSON.parse(JSON.stringify(src));
  copy.id = uid('s');
  copy.name = t('data.copySuffix', { name: src.name });
  copy.x = src.x + offset;
  copy.y = src.y + offset;

  copy.dangers.forEach(d => { d.id = uid('d'); });
  copy.blocks.forEach(b => { b.id = uid('b'); b.tgt = ''; });
  copy.events.forEach(e => { e.id = uid('e'); e.conn = ''; });
  copy.counters.forEach(c => { c.id = uid('n'); });
  copy.locations.forEach(l => {
    l.id = uid('l');
    l.reg = {};                       // the one thing that cannot be in two places
    (l.links || []).forEach(k => { k.id = uid('k'); });
  });
  // Room targets pointed at the original's rooms; they no longer exist here.
  copy.blocks.forEach(b => { if (b.tgtKind === 'loc') b.tgt = ''; });

  S.scenes.push(copy);
  mark();
  return copy;
}

export function newDanger(){
  return { id: uid('d'), nm: t('data.danger'), what: '', fix: '', lvl: 2, active: true, src: '', srcLoc: '' };
}

export function newBlock(){
  return { id: uid('b'), nm: t('data.block'), what: '', key: '', tgtKind: 'conn', tgt: '', tgtText: '',
           src: '', srcLoc: '', done: false };
}

export function newEvent(){
  return { id: uid('e'), nm: t('data.event'), trig: '', eff: '', conn: '', act: 'open', fired: false };
}

export function newCounter(label){
  return { id: uid('n'), label: label || t('data.counter'), value: 0 };
}

/* ============================================================
   Deletion
   ============================================================ */

/**
 * Delete a scene along with its connections, and clean up every reference to
 * it: tokens standing there, and the `src` fields of dangers and blocks that
 * pointed at it for their solution.
 */
export function delScene(id){
  const goneConns = S.connections.filter(c => c.from === id || c.to === id).map(c => c.id);
  S.scenes = S.scenes.filter(s => s.id !== id);
  S.connections = S.connections.filter(c => c.from !== id && c.to !== id);
  S.tokens.forEach(t => { if (t.at && t.at.id === id) t.at = null; });
  S.scenes.forEach(s => {
    [...s.dangers, ...s.blocks].forEach(x => {
      if (x.src === id){ x.src = ''; x.srcLoc = ''; }
    });
    s.blocks.forEach(b => { if (b.tgtKind === 'conn' && goneConns.includes(b.tgt)) b.tgt = ''; });
    s.events.forEach(e => { if (goneConns.includes(e.conn)) e.conn = ''; });
  });
  if (sel && sel.id === id) setSel(null);
  mark();
}

/** Delete a connection and detach whatever pointed at it. */
export function delConn(id){
  S.connections = S.connections.filter(c => c.id !== id);
  S.tokens.forEach(t => { if (t.at && t.at.id === id) t.at = null; });
  S.scenes.forEach(s => {
    s.blocks.forEach(b => { if (b.tgtKind === 'conn' && b.tgt === id) b.tgt = ''; });
    s.events.forEach(e => { if (e.conn === id) e.conn = ''; });
  });
  if (sel && sel.id === id) setSel(null);
  mark();
}

export function delToken(id){
  S.tokens = S.tokens.filter(t => t.id !== id);
  if (sel && sel.kind === 'token' && sel.id === id) setSel(null);
  mark();
}

/* ============================================================
   Queries
   ============================================================ */

/** Connections touching a scene. */
export function connsOf(sceneId){
  return S.connections.filter(c => c.from === sceneId || c.to === sceneId);
}

/** Connections between the same pair of scenes, this one included. */
export function siblings(c){
  return S.connections.filter(
    x => (x.from === c.from && x.to === c.to) || (x.from === c.to && x.to === c.from));
}

/** The scene itself plus everything one hop away — used to dim the rest. */
export function neighborsOf(id){
  const set = new Set([id]);
  S.connections.forEach(c => {
    if (c.from === id) set.add(c.to);
    if (c.to === id) set.add(c.from);
  });
  return set;
}

/**
 * What other scenes expect to find here: the dangers they cannot switch off
 * and the blocks they cannot open without something kept in this scene.
 */
export function owedBy(sceneId){
  const out = [];
  S.scenes.forEach(s => {
    if (s.id === sceneId) return;
    s.dangers.forEach(d => { if (d.src === sceneId) out.push({ from: s, kind: 'danger', it: d }); });
    s.blocks.forEach(b => { if (b.src === sceneId) out.push({ from: s, kind: 'block', it: b }); });
  });
  return out;
}

/** Options a block in scene `s` can point at, for the chosen target kind. */
export function blockTargets(s, kind){
  if (kind === 'conn') return connsOf(s.id).map(c => {
    const other = scene(c.from === s.id ? c.to : c.from);
    return { v: c.id, l: c.name + ' → ' + (other ? other.name : '?') };
  });
  if (kind === 'loc') return locs(s).map(l => ({ v: l.id, l: locIcon(l) + ' ' + locName(l) }));
  return [];
}

export function blockTargetLabel(s, b){
  if (!b.tgtKind || b.tgtKind === 'other') return b.tgtText || '';
  const o = blockTargets(s, b.tgtKind).find(x => x.v === b.tgt);
  return o ? o.l : '';
}

/**
 * The block standing in front of a passage, and the scene that owns it.
 *
 * A block always lives in one scene but can cover a passage leading out of
 * it, so the passage itself has to look outward to find its own block.
 */
export function blockOnConn(connId){
  for (const s of S.scenes){
    const b = s.blocks.find(x => x.tgtKind === 'conn' && x.tgt === connId);
    if (b) return { scene: s, block: b };
  }
  return null;
}

/** The block standing in front of a room, if any. */
export function blockOnLoc(s, locId){
  return s.blocks.find(b => b.tgtKind === 'loc' && b.tgt === locId) || null;
}

/** Tokens standing on a scene or on a connection. */
export function tokensAt(kind, id){
  return S.tokens.filter(t => t.at && t.at.kind === kind && t.at.id === id);
}

/** Where a token currently is, resolved to the scene or connection object. */
export function tokenHost(t){
  if (!t || !t.at) return null;
  return t.at.kind === 'scene' ? scene(t.at.id) : conn(t.at.id);
}
