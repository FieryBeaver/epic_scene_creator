/** Token editor, and its read-only twin for view mode. */

import { tokenHost } from '../../core/model.js';
import { TOKTYPE, tokenTypeName, tokenTypeColor } from '../../core/constants.js';
import { t } from '../../i18n/index.js';
import { esc, safeColor } from '../../util/html.js';
import { sceneOptions } from './shared.js';

const typeName = tok => tokenTypeName(tok.type);
const typeColor = tok => safeColor(tok.color || tokenTypeColor(tok.type));

export function inspToken(tok){
  if (!tok) return '';
  const host = tokenHost(tok);
  const id = esc(tok.id);

  return `<div class="ihead">
      <div class="t">${esc(tok.name)}</div>
      <div class="s">${esc(t('token.kind', { type: typeName(tok) }))}</div>
    </div>
    <div class="ipad">
      <fieldset><legend>${esc(t('token.legend'))}</legend>
        <label class="f"><span>${esc(t('token.name'))}</span>
          <input type="text" data-path="t:${id}:name" value="${esc(tok.name)}"></label>
        <div class="grid2">
          <label class="f"><span>${esc(t('token.type'))}</span>
            <select data-path="t:${id}:type">
              ${Object.entries(TOKTYPE).map(([k, v]) =>
                `<option value="${k}"${tok.type === k ? ' selected' : ''}>${esc(tokenTypeName(k))}</option>`).join('')}
            </select></label>
          <label class="f"><span>${esc(t('token.color'))}</span>
            <input type="color" data-path="t:${id}:color" value="${esc(typeColor(tok))}"></label>
        </div>
        <label class="f"><span>${esc(t('token.hp'))}</span>
          <input type="text" data-path="t:${id}:hp" value="${esc(tok.hp || '')}"></label>
        <label class="f"><span>${esc(t('token.notes'))}</span>
          <textarea data-path="t:${id}:notes">${esc(tok.notes || '')}</textarea></label>
      </fieldset>

      <fieldset><legend>${esc(t('token.place'))}</legend>
        <div>${hostLink(tok, host)}</div>
        <label class="f" style="margin-top:7px"><span>${esc(t('token.moveTo'))}</span>
          <select data-movetok="${id}">
            ${sceneOptions(tok.at && tok.at.kind === 'scene' ? tok.at.id : '', true)}</select></label>
        <p class="hint">${esc(t('token.dragHint'))}</p>
        <button class="x" data-del-token="${id}">${esc(t('token.delete'))}</button>
      </fieldset>
    </div>`;
}

/** View mode: the same facts, nothing editable. */
export function readToken(tok){
  if (!tok) return '';
  const host = tokenHost(tok);
  return `<div class="ihead">
      <div class="t">${esc(tok.name)}</div>
      <div class="s">${esc(t('token.kind', { type: typeName(tok) }))}</div>
    </div>
    <div class="ipad">
      <div class="rd"><h4>${esc(t('token.state'))}</h4>
        <div class="row">
          <span class="chip" style="border-color:${typeColor(tok)};color:${typeColor(tok)}">
            ${esc(typeName(tok))}</span>
          ${tok.hp ? `<span class="chip">${esc(tok.hp)}</span>` : ''}
        </div>
        ${tok.notes ? `<div class="rdi" style="margin-top:6px"><div class="w">${esc(tok.notes)}</div></div>` : ''}
      </div>
      <div class="rd"><h4>${esc(t('token.whereStands'))}</h4>${hostLink(tok, host)}</div>
    </div>`;
}

function hostLink(tok, host){
  if (!host) return `<span class="empty">${esc(t('token.offBoard'))}</span>`;
  return tok.at.kind === 'scene'
    ? `<button class="linkbtn" data-goto="${esc(host.id)}">→ ${esc(host.name)}</button>`
    : `<button class="btn sm" data-selconn="${esc(host.id)}">${esc(t('token.onConn', { name: host.name }))}</button>`;
}
