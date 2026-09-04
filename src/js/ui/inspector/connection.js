/** Connection editor: ends, direction, pinned sides, counters, tokens. */

import { scene } from '../../core/state.js';
import { tokensAt, blockOnConn } from '../../core/model.js';
import { TPL_CONN, tplName } from '../../core/templates.js';
import { t } from '../../i18n/index.js';
import { esc } from '../../util/html.js';
import { SIDES, SIDE_SYM, sideLabel } from '../../util/geometry.js';

export function inspConn(c){
  if (!c) return '';
  const a = scene(c.from), b = scene(c.to);
  const toks = tokensAt('conn', c.id);
  const id = esc(c.id);

  return `<div class="ihead">
      <div class="t">${esc(c.name)}</div>
      <div class="s">${esc(t('conn.external'))}</div>
    </div>
    <div class="ipad">
      <fieldset><legend>${esc(t('conn.ends'))}</legend>
        <div class="row" style="justify-content:space-between">
          <button class="linkbtn" data-goto="${esc(c.from)}">${a ? esc(a.name) : '?'}</button>
          <span>${c.dir === 'one' ? '→' : '↔'}</span>
          <button class="linkbtn" data-goto="${esc(c.to)}">${b ? esc(b.name) : '?'}</button>
        </div>
        <button class="btn sm" data-swap="${id}" style="margin-top:7px">${esc(t('conn.swap'))}</button>
        ${blockNote(c)}
      </fieldset>

      <fieldset><legend>${esc(t('conn.props'))}</legend>
        <label class="f"><span>${esc(t('conn.name'))}</span>
          <input type="text" data-path="c:${id}:name" value="${esc(c.name)}"></label>
        <div class="grid2">
          <label class="f"><span>${esc(t('conn.type'))}</span>
            <select data-path="c:${id}:dir">
              <option value="two"${c.dir === 'two' ? ' selected' : ''}>${esc(t('conn.twoWay'))}</option>
              <option value="one"${c.dir === 'one' ? ' selected' : ''}>${esc(t('conn.oneWay'))}</option>
            </select></label>
          <label class="f"><span>${esc(t('conn.minutes'))}</span>
            <input type="number" min="0" data-num="1" data-path="c:${id}:minutes" value="${esc(c.minutes)}"></label>
        </div>
        <div class="grid2">
          <label class="f"><span>${esc(t('conn.exits', { name: a ? a.name : '?' }))}</span>
            <select data-path="c:${id}:fromSide">${sideOptions(c.fromSide)}</select></label>
          <label class="f"><span>${esc(t('conn.enters', { name: b ? b.name : '?' }))}</span>
            <select data-path="c:${id}:toSide">${sideOptions(c.toSide)}</select></label>
        </div>
        <label class="f"><span>${esc(t('conn.how'))}</span>
          <textarea data-path="c:${id}:desc">${esc(c.desc)}</textarea></label>
        <label class="tgl">
          <input type="checkbox" data-path="c:${id}:open" ${c.open !== false ? 'checked' : ''}> ${esc(t('conn.open'))}</label>
        <div class="row" style="margin-top:8px">
          <select class="btn sm" data-tpl="conn" data-id="${id}" style="width:auto">
            <option value="">${esc(t('scene.fromTemplate'))}</option>
            ${TPL_CONN.map((tpl, i) => `<option value="${i}">${esc(tplName('conn', tpl))}</option>`).join('')}
          </select>
          <button class="x" data-del-conn="${id}">${esc(t('conn.delete'))}</button>
        </div>
      </fieldset>

      ${counters(c, id)}
      ${tokens(toks)}
    </div>`;
}

/** Same note a covered room shows, for a covered passage. */
function blockNote(c){
  const covered = blockOnConn(c.id);
  if (!covered) return '';
  return `<div style="font-size:11px;color:var(--sky);margin-top:7px">
    ⛔ ${esc(t('conn.blockedBy', { name: covered.block.nm }))}`
    + `${covered.block.done ? esc(t('room.solvedSuffix')) : ''}
    · <button class="linkbtn" data-goto="${esc(covered.scene.id)}">${esc(covered.scene.name)}</button>
  </div>`;
}

function sideOptions(current){
  return SIDES.map(v =>
    `<option value="${v}"${current === v ? ' selected' : ''}>`
    + `${SIDE_SYM[v] ? SIDE_SYM[v] + ' ' : ''}${esc(sideLabel(v))}</option>`).join('');
}

function counters(c, id){
  let h = `<fieldset><legend>${esc(t('counter.connLegend'))}</legend>`;
  if (!c.counters.length){
    h += `<div class="empty">${esc(t('counter.connNone'))}</div>`;
  }
  c.counters.forEach(k => {
    const p = `c:${id}:counters:${esc(k.id)}`;
    h += `<div class="ih">
      <input type="text" data-path="${p}:label" value="${esc(k.label)}">
      <input type="number" style="width:70px" data-num="1" data-path="${p}:value" value="${esc(k.value)}">
      <button class="x" data-del="${p}">✕</button>
    </div>`;
  });
  return h + `<button class="btn sm" data-add="conncounter" data-id="${id}">${esc(t('counter.connAdd'))}</button></fieldset>`;
}

function tokens(toks){
  let h = `<fieldset><legend>${esc(t('conn.tokensLegend', { n: toks.length }))}</legend>`;
  if (!toks.length) h += `<div class="empty">${esc(t('conn.tokensNone'))}</div>`;
  toks.forEach(tok => {
    h += `<div><button class="linkbtn" data-seltoken="${esc(tok.id)}">${esc(tok.name)}</button></div>`;
  });
  return h + `</fieldset>`;
}
