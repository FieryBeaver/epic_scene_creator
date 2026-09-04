/**
 * Field addressing.
 *
 * Every input in the inspector carries `data-path="…"`, a colon-separated
 * address of the field it edits. One generic handler then writes the value
 * back, so forms stay declarative markup instead of hundreds of listeners.
 *
 * Shapes:
 *   b:title                                   — a field on the board itself
 *   s:<sceneId>:name                          — a field on the scene
 *   c:<connId>:desc                           — a field on the connection
 *   t:<tokenId>:hp                            — a field on the token
 *   r:<regId>:nm                              — a field on the registry
 *   s:<sceneId>:dangers:<dangerId>:what       — a field on a list item
 *   s:<sceneId>:locations:<locId>:links:<linkId>:url  — one level deeper
 */

import { S, byId, mark, scene, conn, token, reg } from './state.js';

const ROOTS = { s: scene, c: conn, t: token, r: reg };

/** Resolve a path to `{obj, key}`, or null when anything along it is gone. */
export function resolve(path){
  const p = String(path).split(':');

  // `b:<field>` is the board itself — the title and nothing else so far.
  if (p[0] === 'b' && p.length === 2) return { obj: S, key: p[1] };

  const root = ROOTS[p[0]];
  const obj = root ? root(p[1]) : null;
  if (!obj) return null;

  if (p.length === 3) return { obj, key: p[2] };

  if (p.length === 5){
    const it = byId(obj[p[2]], p[3]);
    return it ? { obj: it, key: p[4] } : null;
  }

  if (p.length === 7){
    const it = byId(obj[p[2]], p[3]);
    if (!it) return null;
    const sub = byId(it[p[4]], p[5]);
    return sub ? { obj: sub, key: p[6] } : null;
  }

  return null;
}

/** Write a value at a path. Silently ignores paths that no longer resolve. */
export function setPath(path, value){
  const r = resolve(path);
  if (!r) return false;
  r.obj[r.key] = value;
  mark();
  return true;
}
