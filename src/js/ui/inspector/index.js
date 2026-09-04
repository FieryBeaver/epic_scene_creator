/**
 * Inspector entry point: picks the right panel for the current selection and
 * the current mode, and supplies the two "nothing selected" screens.
 */

import { sel, mode, scene, conn, token } from '../../core/state.js';
import { el } from '../../util/dom.js';
import { T } from '../../util/html.js';
import { t } from '../../i18n/index.js';
import { inspScene } from './scene.js';
import { inspConn } from './connection.js';
import { inspToken, readToken } from './token.js';
import { readScene, readConn } from './readonly.js';

export function renderInsp(){
  const box = el('insp');
  box.innerHTML = panelHtml() || emptyPanel();
}

function panelHtml(){
  if (!sel) return '';
  if (mode === 'view'){
    if (sel.kind === 'scene') return readScene(scene(sel.id));
    if (sel.kind === 'conn') return readConn(conn(sel.id));
    return readToken(token(sel.id));
  }
  if (sel.kind === 'scene') return inspScene(scene(sel.id));
  if (sel.kind === 'conn') return inspConn(conn(sel.id));
  if (sel.kind === 'token') return inspToken(token(sel.id));
  return '';
}

function emptyPanel(){
  return mode === 'view' ? emptyView() : emptyEdit();
}

function emptyView(){
  return `<div class="ihead">
      <div class="t">${T('empty.viewTitle')}</div>
      <div class="s">${T('empty.viewSub')}</div>
    </div>
    <div class="ipad">
      <p class="hint">${T('empty.viewHint')}</p>
      <ul class="tight" style="color:var(--dim);font-size:12px">
        <li>${T('empty.viewL1')}</li>
        <li>${T('empty.viewL2')}</li>
        <li>${T('empty.viewL3')}</li>
        <li>${T('empty.viewL4')}</li>
      </ul>
    </div>`;
}

function emptyEdit(){
  return `<div class="ihead">
      <div class="t">${T('empty.editTitle')}</div>
      <div class="s">${T('empty.editSub')}</div>
    </div>
    <div class="ipad">
      <p class="hint">${T('empty.quickStart')}</p>
      <ul class="tight" style="color:var(--dim);font-size:12px">
        <li>${t('empty.editL1')}</li>
        <li>${t('empty.editL2')}</li>
        <li>${t('empty.editL3')}</li>
        <li>${t('empty.editL4')}</li>
        <li>${t('empty.editL5')}</li>
        <li>${t('empty.editL6')}</li>
      </ul>
      <div class="sep"></div>
      <p class="hint">${t('empty.firstTime')}</p>
      <div class="sep"></div>
      <p class="hint">${T('empty.legend')}</p>
    </div>`;
}
