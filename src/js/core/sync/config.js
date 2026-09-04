/**
 * Per-device sync settings.
 *
 * These live in this browser's localStorage and never in the board file: the
 * board gets exported and passed around, and a token must not travel with it.
 *
 * The repo coordinates are not secret, so they can be handed to another DM as
 * a link — `#sync=owner/repo/path/to/board.json`. Opening it fills in
 * everything except the token, which each DM supplies themselves.
 */

const KEY = 'toa-board-sync';
const DEVICE_KEY = 'toa-board-device';

const EMPTY = { owner: '', repo: '', path: 'board.json', branch: '', token: '', enabled: false };

function store(){
  try { return window.localStorage; } catch { return null; }
}

/** A stable id for this browser, used to break stamp ties. */
export function deviceId(){
  const ls = store();
  let id = ls && ls.getItem(DEVICE_KEY);
  if (!id){
    id = 'd' + Math.random().toString(36).slice(2, 8);
    try { ls && ls.setItem(DEVICE_KEY, id); } catch { /* private mode */ }
  }
  return id;
}

export function loadConfig(){
  const ls = store();
  let saved = {};
  try { saved = JSON.parse((ls && ls.getItem(KEY)) || '{}') || {}; } catch { saved = {}; }
  return Object.assign({}, EMPTY, saved, fromHash());
}

export function saveConfig(cfg){
  const ls = store();
  if (!ls) return;
  try { ls.setItem(KEY, JSON.stringify(Object.assign({}, EMPTY, cfg))); } catch { /* full */ }
}

export function clearConfig(){
  const ls = store();
  try { ls && ls.removeItem(KEY); } catch { /* ignore */ }
}

/** Everything needed to talk to GitHub is present. */
export function isConfigured(cfg){
  return !!(cfg && cfg.owner && cfg.repo && cfg.path && cfg.token);
}

/** `#sync=owner/repo/path...` — an invite another DM can click. */
function fromHash(hash = (typeof location !== 'undefined' ? location.hash : '')){
  const m = /[#&]sync=([^&]+)/.exec(hash || '');
  if (!m) return {};
  const parts = decodeURIComponent(m[1]).split('/').filter(Boolean);
  if (parts.length < 3) return {};
  const [owner, repo, ...rest] = parts;
  return { owner, repo, path: rest.join('/') };
}

export function shareLink(cfg, base){
  const root = (base || (typeof location !== 'undefined' ? location.href : '')).split('#')[0];
  return `${root}#sync=${encodeURIComponent(`${cfg.owner}/${cfg.repo}/${cfg.path}`)}`;
}
