/**
 * The store. One board object (`S`) plus the three pieces of session state
 * that are not part of the document: what is selected, which mode we are in
 * and whether there are unsaved changes.
 *
 * Nothing here touches the DOM. Modules import the accessors rather than
 * reaching into `S` directly wherever a helper exists.
 */

import { defaultRegistries } from './constants.js';

export const BOARD_APP = 'toa-scene-board';
export const BOARD_VERSION = 3;

/** An empty board. */
export function blank(){
  return {
    app: BOARD_APP,
    version: BOARD_VERSION,
    title: 'Друга фаза — дослідження підземелля',
    scenes: [],
    connections: [],
    tokens: [],
    registries: defaultRegistries(),
    ui: {},
    seq: 1,
  };
}

/** Current board. Replaced wholesale on import / clear via `setBoard`. */
export let S = blank();

export function setBoard(next){
  S = next;
}

/** `{kind:'scene'|'conn'|'token', id}` or null. */
export let sel = null;

export function setSel(next){
  sel = next;
}

/** 'edit' — the DM builds the board. 'view' — read-only briefing at the table. */
export let mode = 'edit';

export function setModeValue(m){
  mode = m;
}

/** Set once anything changes; cleared by export and import. Guards unload. */
export let dirty = false;

export function mark(){
  dirty = true;
}

export function clearDirty(){
  dirty = false;
}

/**
 * Ids are `<prefix><counter><random>`. The counter keeps them ordered and
 * readable; the random tail keeps two boards merged by hand from colliding.
 */
export function uid(prefix){
  return prefix + (S.seq++) + Math.random().toString(36).slice(2, 5);
}

/* ---------- lookups ---------- */

export function byId(list, id){
  return (list || []).find(x => x.id === id) || null;
}

export const scene = id => byId(S.scenes, id);
export const conn  = id => byId(S.connections, id);
export const token = id => byId(S.tokens, id);

/** Registry list, created lazily for boards imported without one. */
export function regs(){
  return S.registries || (S.registries = defaultRegistries());
}

export const reg = id => byId(regs(), id);

/** Persisted UI preferences (panel widths, collapsed panels). */
export function ui(){
  return S.ui || (S.ui = {});
}
