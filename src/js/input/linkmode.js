/**
 * Link mode: pick a source scene, then a target, and a connection appears.
 * Kept in its own module because the toolbar, the board and the scene form
 * all switch it on.
 */

import { t } from '../i18n/index.js';

import { mode, scene } from '../core/state.js';
import { el } from '../util/dom.js';

let active = null;   // null | {from: sceneId|null}

export function linkFrom(){
  return active ? active.from : undefined;
}

export function isLinking(){
  return active !== null;
}

export function startLink(fromId){
  if (mode === 'view') return;
  active = { from: fromId || null };

  const from = fromId && scene(fromId);
  const bar = el('modeBar');
  bar.textContent = from
    ? t('msg.linkPickSecond', { name: from.name })
    : t('msg.linkPickFirst');
  bar.classList.add('on');
  el('boardWrap').classList.add('linking');
  el('bLink').classList.add('on');
}

export function stopLink(){
  active = null;
  el('boardWrap').classList.remove('linking');
  el('modeBar').classList.remove('on');
  el('bLink').classList.remove('on');
}

export function toggleLink(fromId){
  if (active) stopLink();
  else startLink(fromId);
}
