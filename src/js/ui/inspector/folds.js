/**
 * Which inspector sections are open.
 *
 * Per device, not part of the board: two DMs looking at the same scene should
 * not fight over which sections are unfolded. Kept out of `ui` for the same
 * reason panel widths are kept out of sync.
 */

const KEY = 'toa-board-folds';

let state = load();

function load(){
  try { return JSON.parse(window.localStorage.getItem(KEY) || '{}') || {}; }
  catch { return {}; }
}

function save(){
  try { window.localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ }
}

/** Open unless told otherwise; a section with nothing in it starts closed. */
export function isOpen(key, fallback){
  return key in state ? !!state[key] : !!fallback;
}

export function toggleSection(key, fallback){
  state[key] = !isOpen(key, fallback);
  save();
  return state[key];
}
