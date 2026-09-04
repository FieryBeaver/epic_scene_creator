/**
 * Scene editor. Each section is a fieldset; every input carries a
 * `data-path`, so the generic form handler in `input/forms.js` writes it back
 * without a listener of its own.
 */

import { scene, regs } from '../../core/state.js';
import { connsOf, owedBy, tokensAt, blockTargets, blockOnLoc } from '../../core/model.js';
import { locs, locName, locLinks, regRoom, locDesc, locDescPath } from '../../core/locations.js';
import { hostOf } from '../../core/registries.js';
import { TOKTYPE, BLOCK_KINDS } from '../../core/constants.js';
import { TPL_DANGER, TPL_BLOCK, TPL_TREASURE, TPL_EVENT } from '../../core/templates.js';
import { esc, safeColor } from '../../util/html.js';
import { SIDE_SYM } from '../../util/geometry.js';
import { sceneOptions, srcRef, srcLocField, owedLoc, renderLinks } from './shared.js';

export function inspScene(s){
  if (!s) return '';
  return `<div class="ihead">
      <div class="t">${esc(s.name)}</div>
      <div class="s">Сцена${s.dm ? ' · ДМ ' + esc(s.dm) : ''}</div>
    </div>
    <div class="ipad">
      ${sectionBasics(s)}
      ${sectionDangers(s)}
      ${sectionBlocks(s)}
      ${sectionRooms(s)}
      ${sectionCounters(s)}
      ${sectionConnections(s)}
      ${sectionTokens(s)}
      ${sectionEvents(s)}
      ${sectionOwed(s)}
    </div>`;
}

/** Dropdown that fills a new item from one of the prepared templates. */
function tplPicker(kind, id, list, label = 'з заготовки…'){
  return `<select class="btn sm" data-tpl="${kind}" data-id="${esc(id)}" style="width:auto">
    <option value="">${esc(label)}</option>
    ${list.map((t, i) => `<option value="${i}">${esc(t.nm)}</option>`).join('')}
  </select>`;
}

/* ---------- scene itself ---------- */

function sectionBasics(s){
  return `<fieldset><legend>Сцена</legend>
    <label class="f"><span>Назва</span>
      <input type="text" data-path="s:${esc(s.id)}:name" value="${esc(s.name)}"></label>
    <div class="grid2">
      <label class="f"><span>ДМ</span>
        <input type="text" data-path="s:${esc(s.id)}:dm" value="${esc(s.dm)}"></label>
      <label class="f"><span>Колір</span>
        <input type="color" data-path="s:${esc(s.id)}:color" value="${esc(safeColor(s.color, '#54685C'))}"></label>
    </div>
    <label class="f"><span>Нотатки</span>
      <textarea data-path="s:${esc(s.id)}:notes">${esc(s.notes)}</textarea></label>
    <button class="x" data-del-scene="${esc(s.id)}">Видалити сцену</button>
  </fieldset>`;
}

/* ---------- dangers ---------- */

function sectionDangers(s){
  let h = `<fieldset><legend>Небезпеки · ${s.dangers.length}</legend>`;
  if (!s.dangers.length) h += `<div class="empty">Немає небезпек</div>`;

  s.dangers.forEach(d => {
    const p = `s:${esc(s.id)}:dangers:${esc(d.id)}`;
    h += `<div class="item dgi">
      <div class="ih">
        <input type="text" data-path="${p}:nm" value="${esc(d.nm)}">
        <button class="x" data-del="${p}">✕</button>
      </div>
      <label class="f"><span>Що відбувається</span>
        <textarea data-path="${p}:what">${esc(d.what)}</textarea></label>
      <label class="f"><span>Як прибрати</span>
        <textarea data-path="${p}:fix">${esc(d.fix)}</textarea></label>
      <label class="f"><span>Вимикається у сцені</span>
        <select data-path="${p}:src">${sceneOptions(d.src, true)}</select></label>
      ${srcLocField(d, `s:${s.id}:dangers:${d.id}`)}
      <div>${srcRef(d)}</div>
      <div class="row" style="margin-top:6px;justify-content:space-between">
        <span class="lvl" data-lvl="${p}">
          ${[1, 2, 3, 4].map(i =>
            `<button data-v="${i}" class="${(d.lvl || 1) >= i ? 'on' : ''}">${i}</button>`).join('')}
        </span>
        <label class="tgl">
          <input type="checkbox" data-path="${p}:active" ${d.active !== false ? 'checked' : ''}> активна</label>
      </div>
    </div>`;
  });

  h += `<div class="row">
    <button class="btn sm" data-add="danger" data-id="${esc(s.id)}">+ небезпека</button>
    ${tplPicker('danger', s.id, TPL_DANGER)}
  </div></fieldset>`;
  return h;
}

/* ---------- blocks ---------- */

function sectionBlocks(s){
  let h = `<fieldset><legend>Блоки · ${s.blocks.length}</legend>`;
  if (!s.blocks.length) h += `<div class="empty">Немає блоків</div>`;

  s.blocks.forEach(b => {
    const p = `s:${esc(s.id)}:blocks:${esc(b.id)}`;
    h += `<div class="item bki">
      <div class="ih">
        <input type="text" data-path="${p}:nm" value="${esc(b.nm)}">
        <button class="x" data-del="${p}">✕</button>
      </div>
      <label class="f"><span>Що відбувається</span>
        <textarea data-path="${p}:what">${esc(b.what)}</textarea></label>
      <label class="f"><span>Ключ / рішення</span>
        <textarea data-path="${p}:key">${esc(b.key)}</textarea></label>
      <div class="grid2">
        <label class="f"><span>Що перекриває</span>
          <select data-path="${p}:tgtKind">
            ${BLOCK_KINDS.map(([v, l]) =>
              `<option value="${v}"${b.tgtKind === v ? ' selected' : ''}>${esc(l)}</option>`).join('')}
          </select></label>
        <label class="f"><span>Ключ лежить у сцені</span>
          <select data-path="${p}:src">${sceneOptions(b.src, true)}</select></label>
      </div>
      ${blockTargetField(s, b, p)}
      ${srcLocField(b, `s:${s.id}:blocks:${b.id}`)}
      <div style="font-size:11px;color:var(--dim)">Ключ лежить: ${srcRef(b)}</div>
      <label class="tgl" style="margin-top:5px">
        <input type="checkbox" data-path="${p}:done" ${b.done ? 'checked' : ''}> вирішено</label>
    </div>`;
  });

  h += `<div class="row">
    <button class="btn sm" data-add="block" data-id="${esc(s.id)}">+ блок</button>
    ${tplPicker('block', s.id, TPL_BLOCK)}
  </div></fieldset>`;
  return h;
}

function blockTargetField(s, b, p){
  if (b.tgtKind === 'other'){
    return `<label class="f"><span>Що саме</span>
      <input type="text" data-path="${p}:tgtText" value="${esc(b.tgtText || '')}"></label>`;
  }
  const opts = blockTargets(s, b.tgtKind);
  if (!opts.length){
    return `<div class="empty">У цій сцені поки немає таких об'єктів — `
      + `додайте їх або оберіть «щось інше».</div>`;
  }
  return `<label class="f"><span>Конкретно</span>
    <select data-path="${p}:tgt">
      <option value="">— оберіть —</option>
      ${opts.map(o => `<option value="${esc(o.v)}"${b.tgt === o.v ? ' selected' : ''}>`
        + `${esc(o.l)}</option>`).join('')}
    </select></label>`;
}

/* ---------- rooms ---------- */

function sectionRooms(s){
  // What other scenes are waiting to find here, indexed by the room it sits in.
  const owed = owedBy(s.id);

  let h = `<fieldset><legend>Кімнати · ${locs(s).length}</legend>`;
  if (!locs(s).length){
    h += `<div class="empty">Кімната — частина сцени: зала, коридор, ділянка. `
      + `Гробниця бога чи скелетний ключ — теж кімнати: додайте їх чипами нижче.</div>`;
  }

  locs(s).forEach(l => {
    const p = `s:${esc(s.id)}:locations:${esc(l.id)}`;
    const block = blockOnLoc(s, l.id);
    const owner = regRoom(l);
    h += `<div class="item loi">
      ${owner ? identityRow(owner) : ''}
      <div class="ih">
        <input type="text" placeholder="${esc(locName(l))}" data-path="${p}:nm" value="${esc(l.nm)}">
        <button class="x" data-del="${p}"
          title="${owner ? 'Прибрати з дошки' : 'Видалити кімнату'}">✕</button>
      </div>
      <label class="f"><span>Опис${owner ? ` · зі списку «${esc(owner.r.nm)}»` : ''}</span>
        <textarea data-path="${esc(locDescPath(l, `s:${s.id}:locations:${l.id}`))}"
          >${esc(locDesc(l))}</textarea></label>
      <label class="tgl">
        <input type="checkbox" data-path="${p}:hasTre" ${l.hasTre ? 'checked' : ''}> тут є скарб</label>
      ${l.hasTre ? `
        <label class="f" style="margin-top:6px"><span>Вміст скарбу</span>
          <textarea data-path="${p}:tre">${esc(l.tre || '')}</textarea></label>
        <label class="f"><span>Захисник / підстава</span>
          <textarea data-path="${p}:guard">${esc(l.guard || '')}</textarea></label>
        <label class="tgl">
          <input type="checkbox" data-path="${p}:taken" ${l.taken ? 'checked' : ''}> скарб забрано</label>` : ''}
      <div style="margin-top:7px">
        <span style="font-size:11px;color:var(--dim)">Посилання</span>
        ${locLinks(l).map(k => `<div class="ih" style="margin-top:4px">
          <input type="text" style="flex:0 0 33%" placeholder="назва"
            data-path="${p}:links:${esc(k.id)}:label" value="${esc(k.label || '')}">
          <input type="text" placeholder="https://…"
            data-path="${p}:links:${esc(k.id)}:url" value="${esc(k.url || '')}">
          <button class="x" data-dellink="${esc(s.id)}:${esc(l.id)}:${esc(k.id)}">✕</button>
        </div>`).join('')}
        <button class="btn sm" style="margin-top:4px"
          data-addlink="${esc(s.id)}:${esc(l.id)}">+ посилання</button>
        ${renderLinks(l)}
      </div>
      <div style="font-size:11px;color:var(--dim);margin-top:5px">${block
        ? `Перекрита блоком «${esc(block.nm)}»${block.done ? ' (вирішено)' : ''}`
        : 'Вільна. Щоб перекрити — у блоці цієї сцени вкажіть ціллю цю кімнату.'}</div>
      ${answersHere(owed, l)}
    </div>`;
  });

  h += `<div class="row">
    <button class="btn sm" data-add="loc" data-id="${esc(s.id)}">+ кімната</button>
    <button class="btn sm" data-add="loctre" data-id="${esc(s.id)}">+ кімната зі скарбом</button>
    ${tplPicker('treasure', s.id, TPL_TREASURE, 'скарб із заготовки…')}
  </div>`;

  // One-click placement: each registry item becomes its own room here.
  regs().forEach(r => {
    h += `<p class="hint" style="margin:8px 0 4px">${esc(r.nm)} — клік робить це кімнатою цієї сцени:</p>
      <div class="row">` + r.items.map(it => {
      const host = hostOf(r.id, it.id);
      const col = safeColor(r.color, '#C7D6E0');
      return `<button class="chip clk ${host && host.id === s.id ? '' : 'done'}"
        data-place="${esc(s.id)}:${esc(r.id)}:${esc(it.id)}"
        style="color:${col};border-color:${col}55"
        title="${esc(it.note || '')}${host ? ' · зараз у «' + esc(host.name) + '»' : ''}">`
        + `${esc(it.sym || r.sym || '◆')} ${esc(it.nm)}</button>`;
    }).join('') + `</div>`;
  });

  // The moment a DM wants to track something the two default lists do not
  // cover — artefacts, NPCs, seals — is right here, not in the tab strip.
  h += `<div class="row eonly" style="margin-top:9px">
    <button class="btn sm" data-addreg>＋ свій список</button>
    <span class="hint" style="margin:0">Наприклад: артефакти, NPC, печатки.
      Кожен елемент лежить рівно в одній кімнаті.</span>
  </div>`;

  return h + `</fieldset>`;
}

/**
 * The other half of a cross-scene link. A danger or block elsewhere can name
 * this exact room as where its answer lies; without this the connection is
 * only visible from the side that needs it, and the DM running *this* room
 * has no idea it matters to anyone.
 */
function answersHere(owed, l){
  const answers = owed.filter(o => o.it.srcLoc === l.id);
  if (!answers.length) return '';
  return `<div style="font-size:11px;color:var(--jade);margin-top:5px">
    ↩ Тут рішення для:
    ${answers.map(o => `<button class="linkbtn" data-goto="${esc(o.from.id)}"
      title="${esc(o.kind === 'danger' ? o.it.fix : o.it.key)}">`
      + `${o.kind === 'danger' ? '☠' : '⛔'} ${esc(o.it.nm)} · ${esc(o.from.name)}`
      + `${solvedTag(o)}</button>`).join(', ')}
  </div>`;
}

function solvedTag(o){
  const solved = o.kind === 'danger' ? o.it.active === false : !!o.it.done;
  return solved ? ' (закрито)' : '';
}

/**
 * A registry room says what it is, and that is not editable here: an item
 * belongs to exactly one room, so it is moved by placing it elsewhere, not by
 * a dropdown on every room in the dungeon.
 */
function identityRow(owner){
  const col = safeColor(owner.r.color, '#C7D6E0');
  return `<div class="row" style="margin-bottom:6px">
    <span class="chip" style="color:${col};border-color:${col}55;background:${col}14">
      ${esc(owner.it.sym || owner.r.sym || '◆')} ${esc(owner.r.one || owner.r.nm)} ${esc(owner.it.nm)}</span>
    ${owner.it.note ? `<span class="hint" style="margin:0">${esc(owner.it.note)}</span>` : ''}
  </div>`;
}

/* ---------- counters ---------- */

function sectionCounters(s){
  let h = `<fieldset><legend>Лічильники</legend>`;
  if (!s.counters.length) h += `<div class="empty">Немає лічильників</div>`;
  s.counters.forEach(c => {
    const p = `s:${esc(s.id)}:counters:${esc(c.id)}`;
    h += `<div class="ih">
      <input type="text" data-path="${p}:label" value="${esc(c.label)}">
      <input type="number" style="width:70px" data-path="${p}:value" data-num="1" value="${esc(c.value)}">
      <button class="x" data-del="${p}">✕</button>
    </div>`;
  });
  return h + `<button class="btn sm" data-add="counter" data-id="${esc(s.id)}">+ лічильник</button>
    <span class="hint" style="display:block;margin-top:5px">
      Хвилі, раунди, HP союзників, спрацювання пасток…</span></fieldset>`;
}

/* ---------- connections ---------- */

function sectionConnections(s){
  const conns = connsOf(s.id);
  let h = `<fieldset><legend>З'єднання · ${conns.length}</legend>`;
  if (!conns.length) h += `<div class="empty">Немає з'єднань</div>`;

  conns.forEach(c => {
    const otherId = c.from === s.id ? c.to : c.from;
    const other = scene(otherId);
    const arrow = c.dir === 'one' ? (c.from === s.id ? '→' : '←') : '↔';
    const mySide = c.from === s.id ? c.fromSide : c.toSide;
    h += `<div class="row" style="justify-content:space-between;margin-bottom:4px">
      <button class="linkbtn" data-goto="${esc(otherId)}">
        ${mySide ? (SIDE_SYM[mySide] || '') + ' ' : ''}${arrow} ${other ? esc(other.name) : '?'}</button>
      <span><button class="btn sm" data-selconn="${esc(c.id)}">${esc(c.name)}</button></span>
    </div>`;
  });

  return h + `<button class="btn sm" data-act="link" data-id="${esc(s.id)}">
    + з'єднати з іншою сценою</button></fieldset>`;
}

/* ---------- tokens ---------- */

function sectionTokens(s){
  const toks = tokensAt('scene', s.id);
  let h = `<fieldset><legend>Токени у сцені · ${toks.length}</legend>`;
  if (!toks.length) h += `<div class="empty">Порожньо</div>`;
  toks.forEach(t => {
    h += `<div class="row" style="justify-content:space-between;margin-bottom:3px">
      <button class="linkbtn" data-seltoken="${esc(t.id)}">${esc(t.name)}</button>
      <span class="tag">${esc((TOKTYPE[t.type] || TOKTYPE.other).nm)}</span>
    </div>`;
  });
  return h + `<button class="btn sm" data-add="token" data-id="${esc(s.id)}">+ токен сюди</button></fieldset>`;
}

/* ---------- events ---------- */

function sectionEvents(s){
  const conns = connsOf(s.id);
  let h = `<fieldset><legend>Івенти · ${s.events.length}</legend>`;
  if (!s.events.length){
    h += `<div class="empty">Немає. Івент — подія, яку запускають самі гравці: `
      + `обвал, прорив води, пробудження механізму.</div>`;
  }

  s.events.forEach(e => {
    const p = `s:${esc(s.id)}:events:${esc(e.id)}`;
    h += `<div class="item evi">
      <div class="ih">
        <input type="text" data-path="${p}:nm" value="${esc(e.nm)}">
        <button class="x" data-del="${p}">✕</button>
      </div>
      <label class="f"><span>Тригер — що мають зробити гравці</span>
        <textarea data-path="${p}:trig">${esc(e.trig)}</textarea></label>
      <label class="f"><span>Що стається</span>
        <textarea data-path="${p}:eff">${esc(e.eff)}</textarea></label>
      <div class="grid2">
        <label class="f"><span>Впливає на перехід</span>
          <select data-path="${p}:conn">
            <option value="">— жоден —</option>
            ${conns.map(c => {
              const other = scene(c.from === s.id ? c.to : c.from);
              return `<option value="${esc(c.id)}"${e.conn === c.id ? ' selected' : ''}>`
                + `${esc(c.name)} → ${esc(other ? other.name : '?')}</option>`;
            }).join('')}
          </select></label>
        <label class="f"><span>Дія</span>
          <select data-path="${p}:act">
            <option value="open"${e.act === 'open' ? ' selected' : ''}>відкриває</option>
            <option value="close"${e.act === 'close' ? ' selected' : ''}>закриває</option>
          </select></label>
      </div>
      <label class="tgl">
        <input type="checkbox" data-fire="${esc(s.id)}:${esc(e.id)}" ${e.fired ? 'checked' : ''}> спрацював</label>
    </div>`;
  });

  return h + `<div class="row">
    <button class="btn sm" data-add="event" data-id="${esc(s.id)}">+ івент</button>
    ${tplPicker('event', s.id, TPL_EVENT)}
  </div></fieldset>`;
}

/* ---------- what this scene unlocks elsewhere ---------- */

function sectionOwed(s){
  const owed = owedBy(s.id);
  let h = `<fieldset><legend>Ця сцена розв'язує · ${owed.length}</legend>`;
  if (!owed.length){
    h += `<div class="empty">Ніхто не чекає рішення звідси. `
      + `Щоб з'явилось — у чужій небезпеці чи блоці вкажіть цю сцену.</div>`;
  }

  owed.forEach(o => {
    const solved = o.kind === 'danger' ? o.it.active === false : !!o.it.done;
    const where = owedLoc(s, o.it);
    h += `<div class="item ${o.kind === 'danger' ? 'dgi' : 'bki'}">
      <div class="ih"><b>${o.kind === 'danger' ? '☠' : '⛔'} ${esc(o.it.nm)}</b></div>
      <div style="font-size:12px;color:#CBD3C9">${esc(o.kind === 'danger' ? o.it.fix : o.it.key)}</div>
      ${where ? `<div style="font-size:12px;color:var(--jade);margin-top:3px">тут: ${where}</div>` : ''}
      <div style="margin-top:4px">для
        <button class="linkbtn" data-goto="${esc(o.from.id)}">${esc(o.from.name)}</button>
        ${solved ? `<span class="tag">${o.kind === 'danger' ? 'вже вимкнено' : 'вже вирішено'}</span>` : ''}</div>
    </div>`;
  });

  return h + `</fieldset>`;
}
