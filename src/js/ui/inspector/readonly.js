/**
 * View mode: the briefing a DM reads at the table.
 *
 * Nothing here edits the board — except counters and token positions, which
 * are game state rather than authoring. Every reference to another scene is a
 * button that jumps there.
 */

import { scene, conn, regs, byId } from '../../core/state.js';
import { connsOf, owedBy, tokensAt, blockOnLoc, blockTargetLabel } from '../../core/model.js';
import { locs, isTreasure, locName, locIcon, locColor, slotList, locDesc } from '../../core/locations.js';
import { itemsIn } from '../../core/registries.js';
import { tokenTypeColor } from '../../core/constants.js';
import { t } from '../../i18n/index.js';
import { esc, safeColor } from '../../util/html.js';
import { SIDE_SYM, sideLabel } from '../../util/geometry.js';
import { srcRef, owedLoc, lvlDots, ctrRow, renderLinks } from './shared.js';

export function readScene(s){
  if (!s) return '';
  const owed = owedBy(s.id);

  let h = `<div class="ihead">
      <div class="t">${esc(s.name)}</div>
      <div class="s">${s.dm ? esc(t('view.dm', { name: s.dm })) : esc(t('view.noDm'))}${registrySummary(s)}</div>
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

  if (s.counters.length) h += `<div class="rd"><h4>${esc(t('view.counters'))}</h4>${ctrRow(s, 's')}</div>`;
  h += tokenRow(t('view.tokens'), tokensAt('scene', s.id));

  return h + `</div>`;
}

/** "· Moa, Triangle" — which list entries are kept in this scene. */
function registrySummary(s){
  return regs().map(r => {
    const ids = itemsIn(s, r.id);
    if (!ids.length) return '';
    return ' · ' + ids.map(i => esc((byId(r.items, i) || {}).nm || i)).join(', ');
  }).join('');
}

function exits(s){
  const conns = connsOf(s.id);
  let h = `<div class="rd"><h4>${esc(t('view.exits'))} <span>${conns.length}</span></h4>`;
  if (!conns.length) h += `<div class="empty">${esc(t('view.isolated'))}</div>`;
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
      + `${c.minutes ? ' · ' + esc(c.minutes) + esc(t('conn.min')) : ''}</span>
    </button>`;
  });
  return h + `</div></div>`;
}

function rooms(s, owed){
  if (!locs(s).length) return '';
  let h = `<div class="rd"><h4>${esc(t('view.rooms'))} <span>${locs(s).length}</span></h4>`;

  locs(s).forEach(l => {
    const block = blockOnLoc(s, l.id);
    const extras = slotList(l).slice(1);
    const answers = owed.filter(o => o.it.srcLoc === l.id);
    const kind = slotList(l).length ? 'o' : isTreasure(l) ? 't' : 'l';

    h += `<div class="rdi ${kind} ${isTreasure(l) && l.taken ? 'off' : ''}" data-room-id="${esc(l.id)}">
      <div class="n" style="color:${safeColor(locColor(l))}">${esc(locIcon(l))} ${esc(locName(l))}`
      + `${isTreasure(l) && l.taken ? ` <span class="tag">${esc(t('view.taken'))}</span>` : ''}`
      + `${extras.map(x => ` <span class="tag">${esc(x.r.one || x.r.nm)} ${esc(x.it.nm)}</span>`).join('')}</div>
      ${locDesc(l) ? `<div class="w">${esc(locDesc(l))}</div>` : ''}
      ${isTreasure(l) && l.tre ? `<div class="k"><b>${esc(t('view.treasure'))}</b> ${esc(l.tre)}</div>` : ''}
      ${isTreasure(l) && l.guard ? `<div class="k"><b>${esc(t('view.guard'))}</b> ${esc(l.guard)}</div>` : ''}
      ${block ? `<div class="k"><b>${esc(t('view.covered'))}</b> ${esc(block.nm)}`
        + `${block.done ? esc(t('room.solvedSuffix')) : ''}`
        + `${block.src && scene(block.src) ? esc(t('view.keyAt')) + srcRef(block) : ''}</div>` : ''}
      ${renderLinks(l)}
      ${answers.length ? `<div class="k"><b>${esc(t('view.answersFor'))}</b> ${answers.map(o =>
        `${esc(o.it.nm)} (<button class="linkbtn" data-goto="${esc(o.from.id)}">`
        + `${esc(o.from.name)}</button>)`).join(', ')}</div>` : ''}
    </div>`;
  });

  return h + `</div>`;
}

function dangers(s){
  if (!s.dangers.length) return '';
  const active = s.dangers.filter(d => d.active !== false).length;
  let h = `<div class="rd"><h4>${esc(t('view.dangers'))} <span>${esc(t('view.activeCount', { n: active }))}</span></h4>`;
  s.dangers.forEach(d => {
    h += `<div class="rdi d ${d.active === false ? 'off' : ''}">
      <div class="n">${esc(d.nm)}
        <span style="color:var(--blood);font-size:11px">${lvlDots(d.lvl)}</span>
        ${d.active === false ? `<span class="tag">${esc(t('danger.disabled'))}</span>` : ''}</div>
      ${d.what ? `<div class="w">${esc(d.what)}</div>` : ''}
      ${d.fix ? `<div class="k"><b>${esc(t('danger.removedBy'))}</b> ${esc(d.fix)}</div>` : ''}
      ${d.src ? `<div class="k">${srcRef(d)}</div>` : ''}
    </div>`;
  });
  return h + `</div>`;
}

function blocks(s){
  if (!s.blocks.length) return '';
  const open = s.blocks.filter(b => !b.done).length;
  let h = `<div class="rd"><h4>${esc(t('view.blocks'))} <span>${esc(t('view.openCount', { n: open }))}</span></h4>`;
  s.blocks.forEach(b => {
    const target = blockTargetLabel(s, b);
    h += `<div class="rdi b ${b.done ? 'off' : ''}">
      <div class="n">${esc(b.nm)}${target ? ` <span class="tag">${esc(t('block.coversTag', { what: target }))}</span>` : ''}
        ${b.done ? `<span class="tag">${esc(t('block.done'))}</span>` : ''}</div>
      ${b.what ? `<div class="w">${esc(b.what)}</div>` : ''}
      ${b.key ? `<div class="k"><b>${esc(t('block.keyLabel'))}</b> ${esc(b.key)}</div>` : ''}
      ${b.src ? `<div class="k"><b>${esc(t('block.whereToLook'))}</b> ${srcRef(b)}</div>` : ''}
    </div>`;
  });
  return h + `</div>`;
}

function events(s){
  if (!s.events.length) return '';
  const pending = s.events.filter(e => !e.fired).length;
  let h = `<div class="rd"><h4>${esc(t('view.events'))} <span>${esc(t('view.pendingCount', { n: pending }))}</span></h4>`;
  s.events.forEach(e => {
    const c = e.conn ? conn(e.conn) : null;
    const other = c ? scene(c.from === s.id ? c.to : c.from) : null;
    h += `<div class="rdi e ${e.fired ? 'off' : ''}">
      <div class="n">${esc(e.nm)}${e.fired ? ` <span class="tag">${esc(t('event.fired'))}</span>` : ''}</div>
      ${e.trig ? `<div class="k"><b>${esc(t('event.triggerLabel'))}</b> ${esc(e.trig)}</div>` : ''}
      ${e.eff ? `<div class="w">${esc(e.eff)}</div>` : ''}
      ${c ? `<div class="k">${esc(e.act === 'close' ? t('event.closesPassage') : t('event.opensPassage'))}
        <button class="linkbtn" data-selconn="${esc(c.id)}">${esc(c.name)}</button>
        ${other ? `→ <button class="linkbtn" data-goto="${esc(other.id)}">${esc(other.name)}</button>` : ''}</div>` : ''}
    </div>`;
  });
  return h + `</div>`;
}

function unlocks(s, owed){
  let h = `<div class="rd"><h4>${esc(t('view.solves'))} <span>${owed.length}</span></h4>`;
  if (!owed.length) h += `<div class="empty">${esc(t('owed.nothing'))}</div>`;
  owed.forEach(o => {
    const solved = o.kind === 'danger' ? o.it.active === false : !!o.it.done;
    const where = owedLoc(s, o.it);
    h += `<div class="rdi o ${solved ? 'off' : ''}">
      <div class="n">${o.kind === 'danger' ? '☠' : '⛔'} ${esc(o.it.nm)}`
      + `${solved ? ` <span class="tag">${esc(t('owed.closed'))}</span>` : ''}</div>
      <div class="w">${esc(o.kind === 'danger' ? o.it.fix : o.it.key)}</div>
      ${where ? `<div class="k"><b>${esc(t('owed.hereLabel'))}</b> ${where}</div>` : ''}
      <div class="k">${esc(t('owed.for'))} <button class="linkbtn" data-goto="${esc(o.from.id)}">${esc(o.from.name)}</button></div>
    </div>`;
  });
  return h + `</div>`;
}

function tokenRow(title, toks){
  if (!toks.length) return '';
  return `<div class="rd"><h4>${esc(title)} <span>${toks.length}</span></h4><div class="row">`
    + toks.map(tok => {
      const c = safeColor(tok.color || tokenTypeColor(tok.type));
      return `<span class="chip" style="border-color:${c};color:${c}">${esc(tok.name)}`
        + `${tok.hp ? ' · ' + esc(tok.hp) : ''}</span>`;
    }).join('') + `</div></div>`;
}

export function readConn(c){
  if (!c) return '';
  const a = scene(c.from), b = scene(c.to);

  let h = `<div class="ihead">
      <div class="t">${esc(c.name)}</div>
      <div class="s">${esc(c.dir === 'one' ? t('conn.oneWayShort') : t('conn.twoWayShort'))}`
      + `${c.open === false ? esc(t('conn.closed')) : ''}`
      + `${c.minutes ? ' · ' + esc(c.minutes) + ' ' + esc(t('conn.min')) : ''}</div>
    </div>
    <div class="ipad">
      <div class="rd"><h4>${esc(t('conn.leads'))}</h4><div class="jump">
        <button data-goto="${esc(c.from)}">
          <span class="a">${a ? esc(a.name) : '?'}</span>
          <span class="b">${esc(t('conn.start'))}${c.fromSide ? esc(t('conn.exitTo', { side: sideLabel(c.fromSide) })) : ''}</span></button>
        <button data-goto="${esc(c.to)}">
          <span class="a">${b ? esc(b.name) : '?'}</span>
          <span class="b">${esc(c.dir === 'one' ? t('conn.onlyHere') : t('conn.end'))}`
          + `${c.toSide ? esc(t('conn.entryFrom', { side: sideLabel(c.toSide) })) : ''}</span></button>
      </div></div>`;

  if (c.desc) h += `<div class="rd"><h4>${esc(t('conn.howItWorks'))}</h4><div style="color:#CBD3C9">${esc(c.desc)}</div></div>`;
  if (c.counters.length) h += `<div class="rd"><h4>${esc(t('view.counters'))}</h4>${ctrRow(c, 'c')}</div>`;
  h += tokenRow(t('view.tokens'), tokensAt('conn', c.id));

  return h + `</div>`;
}
