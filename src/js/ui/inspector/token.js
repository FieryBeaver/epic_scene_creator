/** Token editor, and its read-only twin for view mode. */

import { tokenHost } from '../../core/model.js';
import { TOKTYPE } from '../../core/constants.js';
import { esc, safeColor } from '../../util/html.js';
import { sceneOptions } from './shared.js';

const typeName = t => (TOKTYPE[t.type] || TOKTYPE.other).nm;
const typeColor = t => safeColor(t.color || (TOKTYPE[t.type] || TOKTYPE.other).c);

export function inspToken(t){
  if (!t) return '';
  const host = tokenHost(t);
  const id = esc(t.id);

  return `<div class="ihead">
      <div class="t">${esc(t.name)}</div>
      <div class="s">Токен · ${esc(typeName(t))}</div>
    </div>
    <div class="ipad">
      <fieldset><legend>Токен</legend>
        <label class="f"><span>Назва</span>
          <input type="text" data-path="t:${id}:name" value="${esc(t.name)}"></label>
        <div class="grid2">
          <label class="f"><span>Тип</span>
            <select data-path="t:${id}:type">
              ${Object.entries(TOKTYPE).map(([k, v]) =>
                `<option value="${k}"${t.type === k ? ' selected' : ''}>${esc(v.nm)}</option>`).join('')}
            </select></label>
          <label class="f"><span>Колір</span>
            <input type="color" data-path="t:${id}:color" value="${esc(typeColor(t))}"></label>
        </div>
        <label class="f"><span>HP / стан</span>
          <input type="text" data-path="t:${id}:hp" value="${esc(t.hp || '')}"></label>
        <label class="f"><span>Нотатки</span>
          <textarea data-path="t:${id}:notes">${esc(t.notes || '')}</textarea></label>
      </fieldset>

      <fieldset><legend>Розташування</legend>
        <div>${hostLink(t, host)}</div>
        <label class="f" style="margin-top:7px"><span>Перемістити у сцену</span>
          <select data-movetok="${id}">
            ${sceneOptions(t.at && t.at.kind === 'scene' ? t.at.id : '', true)}</select></label>
        <p class="hint">Або просто перетягніть токен по дошці.</p>
        <button class="x" data-del-token="${id}">Видалити токен</button>
      </fieldset>
    </div>`;
}

/** View mode: the same facts, nothing editable. */
export function readToken(t){
  if (!t) return '';
  const host = tokenHost(t);
  return `<div class="ihead">
      <div class="t">${esc(t.name)}</div>
      <div class="s">Токен · ${esc(typeName(t))}</div>
    </div>
    <div class="ipad">
      <div class="rd"><h4>Стан</h4>
        <div class="row">
          <span class="chip" style="border-color:${typeColor(t)};color:${typeColor(t)}">
            ${esc(typeName(t))}</span>
          ${t.hp ? `<span class="chip">${esc(t.hp)}</span>` : ''}
        </div>
        ${t.notes ? `<div class="rdi" style="margin-top:6px"><div class="w">${esc(t.notes)}</div></div>` : ''}
      </div>
      <div class="rd"><h4>Де стоїть</h4>${hostLink(t, host)}</div>
    </div>`;
}

function hostLink(t, host){
  if (!host) return `<span class="empty">поза дошкою</span>`;
  return t.at.kind === 'scene'
    ? `<button class="linkbtn" data-goto="${esc(host.id)}">→ ${esc(host.name)}</button>`
    : `<button class="btn sm" data-selconn="${esc(host.id)}">на з'єднанні «${esc(host.name)}»</button>`;
}
