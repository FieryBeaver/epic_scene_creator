/**
 * Local autosave.
 *
 * Export JSON is still the way to keep a board, but a browser tab that closes
 * mid-session should not take the evening's counters with it. The board is
 * written to localStorage a moment after every change and offered back on the
 * next load.
 *
 * This is per-device and independent of sync: it is also what lets a device
 * keep working offline and push once it is back.
 */

import { S } from './state.js';
import { serialize, deserialize } from './serialize.js';

const KEY = 'toa-board-autosave';
const DELAY = 800;

let timer = 0;

function store(){
  try { return window.localStorage; } catch { return null; }
}

/** Write the board, debounced. Safe to call on every keystroke. */
export function scheduleAutosave(camera){
  clearTimeout(timer);
  timer = setTimeout(() => writeNow(camera), DELAY);
}

export function writeNow(camera){
  const ls = store();
  if (!ls) return false;
  try {
    const data = serialize(S, camera || { x: 0, y: 0, z: 1 });
    data.savedAt = new Date().toISOString();
    ls.setItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;   // quota, private mode — autosave is best effort
  }
}

/** The stored board, or null when there is nothing usable. */
export function readAutosave(){
  const ls = store();
  if (!ls) return null;
  let raw;
  try { raw = JSON.parse(ls.getItem(KEY) || 'null'); } catch { return null; }
  if (!raw || !Array.isArray(raw.scenes) || !raw.scenes.length) return null;
  try {
    return { board: deserialize(raw), camera: raw.camera || null, savedAt: raw.savedAt || null };
  } catch {
    return null;
  }
}

export function clearAutosave(){
  const ls = store();
  try { ls && ls.removeItem(KEY); } catch { /* ignore */ }
}
