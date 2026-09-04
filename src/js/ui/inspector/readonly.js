/**
 * View mode: the briefing a DM reads at the table.
 *
 * Nothing here edits the board — except counters and token positions, which
 * are game state rather than authoring. Every reference to another scene is a
 * button that jumps there.
 */

import { scene, conn, regs, byId } from '../../core/state.js';
import { connsOf, owedBy, tokensAt, blockOnLoc, blockTargetLabel } from '../../core/model.js';
import { locs, isTreasure, locName, locIcon, locColor, slotList } from '../../core/locations.js';
import { itemsIn } from '../../core/registries.js';
import { TOKTYPE } from '../../core/constants.js';
import { esc, safeColor } from '../../util/html.js';
import { SIDE_SYM, sideLabel } from '../../util/geometry.js';
import { srcRef, owedLoc, lvlDots, ctrRow, renderLinks } from './shared.js';

export function readScene(s){
  if (!s) return '';
  const owed = owedBy(s.id);

  let h = `<div class="ihead">
      <div class="t">${esc(s.name)}</div>
      <div class="s">${s.dm ? 'ДМ ' + esc(s.dm) : 'ДМ не вказано'}${registrySummary(s)}</div>
    </div>
    <div class="ipad">`;

  if (s.notes){
    h += `<div class="rd" style="color:#CBD3C9;white-space:pre-wrap">${esc(s.notes)}</div>`;
  }

  h += exits(s);
  h += rooms(s, owed);
  h += dangers(s);
  h += blocks(s);
  h += events(s);
  h += unlocks(s, owed);

  if (s.counters.length) h += `<div class="rd"><h4>Лічильники</h4>${ctrRow(s, 's')}</div>`;
  h += tokenRow('Токени', tokensAt('scene', s.id));

  return h + `</div>`;
}

/** "· Обо'лака, Трикутник" — which registry items are kept in this scene. */
function registrySummary(s){
  return regs().map(r => {
    const ids = itemsIn(s, r.id);
    if (!ids.length) return '';
    return ' · ' + ids.map(i => esc((byId(r.items, i) || {}).nm || i)).join(', ');
  }).join('');
}

function exits(s){
  const conns = connsOf(s.id);
  let h = `<div class="rd"><h4>Переходи <span>${conns.length}</span></h4>`;
  if (!conns.length) h += `<div class="empty">Сцена ізольована</div>`;
  h += `<div class="jump">`;
  conns.forEach(c => {
    const otherId = c.from === s.id ? c.to : c.from;
    const other = scene(otherId);
    const arrow = c.dir === 'one' ? (c.from === s.id ? '→' : '←') : '↔';
    const mySide = c.from === s.id ? c.fromSide : c.toSide;
    h += `<button data-goto="${esc(otherId)}">
      <span class="a">${mySide ? (SIDE_SYM[mySide] || '') + ' ' : ''}${arrow} ${other ? esc(other.name) : '?'}</span>
      <span class="b">${c.open === false ? '✕ ' : ''}${esc(c.name)}`
      + `${mySide ? ' · ' + esc(sideLabel(mySide)) : ''}`
      + `${c.minutes ? ' · ' + esc(c.minutes) + 'хв' : ''}</span>
    </button>`;
  });
  return h + `</div></div>`;
}

function rooms(s, owed){
  if (!locs(s).length) return '';
  let h = `<div class="rd"><h4>Кімнати <span>${locs(s).length}</span></h4>`;

  locs(s).forEach(l => {
    const block = blockOnLoc(s, l.id);
    const extras = slotList(l).slice(1);
    const answers = owed.filter(o => o.it.srcLoc === l.id);
    const kind = slotList(l).length ? 'o' : isTreasure(l) ? 't' : 'l';

    h += `<div class="rdi ${kind} ${isTreasure(l) && l.taken ? 'off' : ''}">
      <div class="n" style="color:${safeColor(locColor(l))}">${locIcon(l)} ${esc(locName(l))}`
      + `${isTreasure(l) && l.taken ? ' <span class="tag">забрано</span>' : ''}`
      + `${extras.map(x => ` <span class="tag">${esc(x.r.one || x.r.nm)} ${esc(x.it.nm)}</span>`).join('')}</div>
      ${l.notes ? `<div class="w">${esc(l.notes)}</div>` : ''}
      ${isTreasure(l) && l.tre ? `<div class="k"><b>Скарб:</b> ${esc(l.tre)}</div>` : ''}
      ${isTreasure(l) && l.guard ? `<div class="k"><b>Захисник:</b> ${esc(l.guard)}</div>` : ''}
      ${block ? `<div class="k"><b>Перекрита:</b> ${esc(block.nm)}${block.done ? ' (вирішено)' : ''}`
        + `${block.src && scene(block.src) ? ` · ключ ${srcRef(block)}` : ''}</div>` : ''}
      ${renderLinks(l)}
      ${answers.length ? `<div class="k"><b>Рішення для інших сцен:</b> ${answers.map(o =>
        `${esc(o.it.nm)} (<button class="linkbtn" data-goto="${esc(o.from.id)}">`
        + `${esc(o.from.name)}</button>)`).join(', ')}</div>` : ''}
    </div>`;
  });

  return h + `</div>`;
}

function dangers(s){
  if (!s.dangers.length) return '';
  const active = s.dangers.filter(d => d.active !== false).length;
  let h = `<div class="rd"><h4>Небезпеки <span>${active} активних</span></h4>`;
  s.dangers.forEach(d => {
    h += `<div class="rdi d ${d.active === false ? 'off' : ''}">
      <div class="n">${esc(d.nm)}
        <span style="color:var(--blood);font-size:11px">${lvlDots(d.lvl)}</span>
        ${d.active === false ? '<span class="tag">вимкнена</span>' : ''}</div>
      ${d.what ? `<div class="w">${esc(d.what)}</div>` : ''}
      ${d.fix ? `<div class="k"><b>Знімається:</b> ${esc(d.fix)}</div>` : ''}
      ${d.src ? `<div class="k">${srcRef(d)}</div>` : ''}
    </div>`;
  });
  return h + `</div>`;
}

function blocks(s){
  if (!s.blocks.length) return '';
  const open = s.blocks.filter(b => !b.done).length;
  let h = `<div class="rd"><h4>Блоки <span>${open} відкритих</span></h4>`;
  s.blocks.forEach(b => {
    const target = blockTargetLabel(s, b);
    h += `<div class="rdi b ${b.done ? 'off' : ''}">
      <div class="n">${esc(b.nm)}${target ? ` <span class="tag">перекриває: ${esc(target)}</span>` : ''}
        ${b.done ? '<span class="tag">вирішено</span>' : ''}</div>
      ${b.what ? `<div class="w">${esc(b.what)}</div>` : ''}
      ${b.key ? `<div class="k"><b>Ключ:</b> ${esc(b.key)}</div>` : ''}
      ${b.src ? `<div class="k"><b>Де шукати:</b> ${srcRef(b)}</div>` : ''}
    </div>`;
  });
  return h + `</div>`;
}

function events(s){
  if (!s.events.length) return '';
  const pending = s.events.filter(e => !e.fired).length;
  let h = `<div class="rd"><h4>Івенти <span>${pending} не спрацювали</span></h4>`;
  s.events.forEach(e => {
    const c = e.conn ? conn(e.conn) : null;
    const other = c ? scene(c.from === s.id ? c.to : c.from) : null;
    h += `<div class="rdi e ${e.fired ? 'off' : ''}">
      <div class="n">${esc(e.nm)}${e.fired ? ' <span class="tag">спрацював</span>' : ''}</div>
      ${e.trig ? `<div class="k"><b>Тригер:</b> ${esc(e.trig)}</div>` : ''}
      ${e.eff ? `<div class="w">${esc(e.eff)}</div>` : ''}
      ${c ? `<div class="k">${e.act === 'close' ? 'закриває' : 'відкриває'} перехід
        <button class="linkbtn" data-selconn="${esc(c.id)}">${esc(c.name)}</button>
        ${other ? `→ <button class="linkbtn" data-goto="${esc(other.id)}">${esc(other.name)}</button>` : ''}</div>` : ''}
    </div>`;
  });
  return h + `</div>`;
}

function unlocks(s, owed){
  let h = `<div class="rd"><h4>Ця сцена розв'язує <span>${owed.length}</span></h4>`;
  if (!owed.length) h += `<div class="empty">Нічого. Жодна інша сцена не залежить від цієї.</div>`;
  owed.forEach(o => {
    const solved = o.kind === 'danger' ? o.it.active === false : !!o.it.done;
    const where = owedLoc(s, o.it);
    h += `<div class="rdi o ${solved ? 'off' : ''}">
      <div class="n">${o.kind === 'danger' ? '☠' : '⛔'} ${esc(o.it.nm)}`
      + `${solved ? ' <span class="tag">закрито</span>' : ''}</div>
      <div class="w">${esc(o.kind === 'danger' ? o.it.fix : o.it.key)}</div>
      ${where ? `<div class="k"><b>Тут:</b> ${where}</div>` : ''}
      <div class="k">для <button class="linkbtn" data-goto="${esc(o.from.id)}">${esc(o.from.name)}</button></div>
    </div>`;
  });
  return h + `</div>`;
}

function tokenRow(title, toks){
  if (!toks.length) return '';
  return `<div class="rd"><h4>${esc(title)} <span>${toks.length}</span></h4><div class="row">`
    + toks.map(t => {
      const c = safeColor(t.color || (TOKTYPE[t.type] || TOKTYPE.other).c);
      return `<span class="chip" style="border-color:${c};color:${c}">${esc(t.name)}`
        + `${t.hp ? ' · ' + esc(t.hp) : ''}</span>`;
    }).join('') + `</div></div>`;
}

export function readConn(c){
  if (!c) return '';
  const a = scene(c.from), b = scene(c.to);

  let h = `<div class="ihead">
      <div class="t">${esc(c.name)}</div>
      <div class="s">${c.dir === 'one' ? 'однобічний' : 'двосторонній'}`
      + `${c.open === false ? ' · закритий' : ''}`
      + `${c.minutes ? ' · ' + esc(c.minutes) + ' хв' : ''}</div>
    </div>
    <div class="ipad">
      <div class="rd"><h4>Веде</h4><div class="jump">
        <button data-goto="${esc(c.from)}">
          <span class="a">${a ? esc(a.name) : '?'}</span>
          <span class="b">початок${c.fromSide ? ' · вихід на ' + esc(sideLabel(c.fromSide)) : ''}</span></button>
        <button data-goto="${esc(c.to)}">
          <span class="a">${b ? esc(b.name) : '?'}</span>
          <span class="b">${c.dir === 'one' ? 'тільки сюди' : 'кінець'}`
          + `${c.toSide ? ' · вхід з ' + esc(sideLabel(c.toSide)) : ''}</span></button>
      </div></div>`;

  if (c.desc) h += `<div class="rd"><h4>Як працює</h4><div style="color:#CBD3C9">${esc(c.desc)}</div></div>`;
  if (c.counters.length) h += `<div class="rd"><h4>Лічильники</h4>${ctrRow(c, 'c')}</div>`;
  h += tokenRow('Токени', tokensAt('conn', c.id));

  return h + `</div>`;
}
