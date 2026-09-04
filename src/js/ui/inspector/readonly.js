/**
 * View mode: the briefing a DM reads at the table.
 *
 * Nothing here edits the board — except counters and token positions, which
 * are game state rather than authoring. Every reference to another scene is a
 * button that jumps there.
 */

import { scene, conn, regs, byId } from '../../core/state.js';
import { connsOf, owedBy, tokensAt, blockOnLoc, blockOnConn, blockTargetLabel } from '../../core/model.js';
import { locs, isTreasure, locName, locIcon, locColor, slotList, locDesc, locLinks,
  rootRooms, childrenOf } from '../../core/locations.js';
import { itemsIn } from '../../core/registries.js';
import { tokenTypeColor } from '../../core/constants.js';
import { t } from '../../i18n/index.js';
import { esc, T, safeColor } from '../../util/html.js';
import { SIDE_SYM, sideLabel } from '../../util/geometry.js';
import { srcRef, owedLoc, lvlDots, ctrRow, renderLinks,
  roomBadges, roomLabel, roomIndent } from './shared.js';
import { isRoomOpen } from './folds.js';

export function readScene(s){
  if (!s) return '';
  const owed = owedBy(s.id);

  let h = `<div class="ihead">
      <div class="t">${esc(s.name)}</div>
      <div class="s">${s.dm ? T('view.dm', { name: s.dm }) : T('view.noDm')}${registrySummary(s)}</div>
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

  if (s.counters.length) h += `<div class="rd"><h4>${T('view.counters')}</h4>${ctrRow(s, 's')}</div>`;
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
  let h = `<div class="rd"><h4>${T('view.exits')} <span>${conns.length}</span></h4>`;
  if (!conns.length) h += `<div class="empty">${T('view.isolated')}</div>`;
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
      + `${c.minutes ? ' · ' + esc(c.minutes) + T('conn.min') : ''}</span>
    </button>`;
  });
  return h + `</div></div>`;
}

/**
 * Rooms, folded shut — the same accordion as the edit form, sharing its open
 * state so a room opened in one mode is still open in the other.
 *
 * At the table a scene is read one room at a time; six of them unrolled at
 * once pushes the dangers and the passages off the screen. The header carries
 * the name and a badge for anything worth knowing before opening it.
 */
function rooms(s, owed){
  if (!locs(s).length) return '';
  let h = `<div class="rd"><h4>${T('view.rooms')} <span>${locs(s).length}</span></h4>`;
  h += rootRooms(s).map(l => readRoom(s, l, owed, 0)).join('');
  return h + `</div>`;
}

function readRoom(s, l, owed, depth){
  const open = isRoomOpen(l.id);
  const kids = childrenOf(s, l.id);
  const block = blockOnLoc(s, l.id);
  const answers = owed.filter(o => o.it.srcLoc === l.id);
  const kind = slotList(l).length ? 'o' : isTreasure(l) ? 't' : 'l';
  const spent = isTreasure(l) && l.taken;

  const body = `${locDesc(l) ? `<div class="w">${esc(locDesc(l))}</div>` : ''}
    ${isTreasure(l) && l.tre ? `<div class="k"><b>${T('view.treasure')}</b> ${esc(l.tre)}</div>` : ''}
    ${isTreasure(l) && l.guard ? `<div class="k"><b>${T('view.guard')}</b> ${esc(l.guard)}</div>` : ''}
    ${block ? `<div class="k"><b>${T('view.covered')}</b> ${esc(block.nm)}`
      + `${block.done ? T('room.solvedSuffix') : ''}`
      + `${block.src && scene(block.src) ? T('view.keyAt') + srcRef(block) : ''}</div>` : ''}
    ${renderLinks(l)}
    ${answers.length ? `<div class="k"><b>${T('view.answersFor')}</b> ${answers.map(o =>
      `${esc(o.it.nm)} (<button class="linkbtn" data-goto="${esc(o.from.id)}">`
      + `${esc(o.from.name)}</button>)`).join(', ')}</div>` : ''}`;

  // A room with nothing recorded has nothing behind the click, so it is a
  // plain line rather than an accordion that opens onto emptiness.
  const hasBody = !!body.trim();
  const label = roomLabel(l)
    + `${spent ? ` <span class="tag">${T('view.taken')}</span>` : ''}`
    + `<span class="rbadges">${roomBadges(s, l, owed)}</span>`;

  return `<div class="rdroom rdi ${kind} ${spent ? 'off' : ''}${open && hasBody ? ' open' : ''}"
      data-room-id="${esc(l.id)}" style="${roomIndent(depth, 11)}">
    ${hasBody
      ? `<button class="rdroom-head" data-room-open="${esc(l.id)}" aria-expanded="${open}">
          <span class="caret">${open ? '▾' : '▸'}</span>${label}</button>`
      : `<div class="rdroom-head bare"><span class="caret"></span>${label}</div>`}
    ${open && hasBody ? `<div class="rdroom-body">${body}</div>` : ''}
  </div>`
  + kids.map(child => readRoom(s, child, owed, depth + 1)).join('');
}

function dangers(s){
  if (!s.dangers.length) return '';
  const active = s.dangers.filter(d => d.active !== false).length;
  let h = `<div class="rd"><h4>${T('view.dangers')} <span>${T('view.activeCount', { n: active })}</span></h4>`;
  s.dangers.forEach(d => {
    h += `<div class="rdi d ${d.active === false ? 'off' : ''}">
      <div class="n">${esc(d.nm)}
        <span style="color:var(--blood);font-size:11px">${lvlDots(d.lvl)}</span>
        ${d.active === false ? `<span class="tag">${T('danger.disabled')}</span>` : ''}</div>
      ${d.what ? `<div class="w">${esc(d.what)}</div>` : ''}
      ${d.fix ? `<div class="k"><b>${T('danger.removedBy')}</b> ${esc(d.fix)}</div>` : ''}
      ${d.src ? `<div class="k">${srcRef(d)}</div>` : ''}
    </div>`;
  });
  return h + `</div>`;
}

function blocks(s){
  if (!s.blocks.length) return '';
  const open = s.blocks.filter(b => !b.done).length;
  let h = `<div class="rd"><h4>${T('view.blocks')} <span>${T('view.openCount', { n: open })}</span></h4>`;
  s.blocks.forEach(b => {
    const target = blockTargetLabel(s, b);
    h += `<div class="rdi b ${b.done ? 'off' : ''}">
      <div class="n">${esc(b.nm)}${target ? ` <span class="tag">${T('block.coversTag', { what: target })}</span>` : ''}
        ${b.done ? `<span class="tag">${T('block.done')}</span>` : ''}</div>
      ${b.what ? `<div class="w">${esc(b.what)}</div>` : ''}
      ${b.key ? `<div class="k"><b>${T('block.keyLabel')}</b> ${esc(b.key)}</div>` : ''}
      ${b.src ? `<div class="k"><b>${T('block.whereToLook')}</b> ${srcRef(b)}</div>` : ''}
    </div>`;
  });
  return h + `</div>`;
}

function events(s){
  if (!s.events.length) return '';
  const pending = s.events.filter(e => !e.fired).length;
  let h = `<div class="rd"><h4>${T('view.events')} <span>${T('view.pendingCount', { n: pending })}</span></h4>`;
  s.events.forEach(e => {
    const c = e.conn ? conn(e.conn) : null;
    const other = c ? scene(c.from === s.id ? c.to : c.from) : null;
    h += `<div class="rdi e ${e.fired ? 'off' : ''}">
      <div class="n">${esc(e.nm)}${e.fired ? ` <span class="tag">${T('event.fired')}</span>` : ''}</div>
      ${e.trig ? `<div class="k"><b>${T('event.triggerLabel')}</b> ${esc(e.trig)}</div>` : ''}
      ${e.eff ? `<div class="w">${esc(e.eff)}</div>` : ''}
      ${c ? `<div class="k">${esc(e.act === 'close' ? t('event.closesPassage') : t('event.opensPassage'))}
        <button class="linkbtn" data-selconn="${esc(c.id)}">${esc(c.name)}</button>
        ${other ? `→ <button class="linkbtn" data-goto="${esc(other.id)}">${esc(other.name)}</button>` : ''}</div>` : ''}
    </div>`;
  });
  return h + `</div>`;
}

function unlocks(s, owed){
  let h = `<div class="rd"><h4>${T('view.solves')} <span>${owed.length}</span></h4>`;
  if (!owed.length) h += `<div class="empty">${T('owed.nothing')}</div>`;
  owed.forEach(o => {
    const solved = o.kind === 'danger' ? o.it.active === false : !!o.it.done;
    const where = owedLoc(s, o.it);
    h += `<div class="rdi o ${solved ? 'off' : ''}">
      <div class="n">${o.kind === 'danger' ? '☠' : '⛔'} ${esc(o.it.nm)}`
      + `${solved ? ` <span class="tag">${T('owed.closed')}</span>` : ''}</div>
      <div class="w">${esc(o.kind === 'danger' ? o.it.fix : o.it.key)}</div>
      ${where ? `<div class="k"><b>${T('owed.hereLabel')}</b> ${where}</div>` : ''}
      <div class="k">${T('owed.for')} <button class="linkbtn" data-goto="${esc(o.from.id)}">${esc(o.from.name)}</button></div>
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
      + `${c.open === false ? T('conn.closed') : ''}`
      + `${c.minutes ? ' · ' + esc(c.minutes) + ' ' + T('conn.min') : ''}</div>
    </div>
    <div class="ipad">
      <div class="rd"><h4>${T('conn.leads')}</h4><div class="jump">
        <button data-goto="${esc(c.from)}">
          <span class="a">${a ? esc(a.name) : '?'}</span>
          <span class="b">${T('conn.start')}${c.fromSide ? T('conn.exitTo', { side: sideLabel(c.fromSide) }) : ''}</span></button>
        <button data-goto="${esc(c.to)}">
          <span class="a">${b ? esc(b.name) : '?'}</span>
          <span class="b">${esc(c.dir === 'one' ? t('conn.onlyHere') : t('conn.end'))}`
          + `${c.toSide ? T('conn.entryFrom', { side: sideLabel(c.toSide) }) : ''}</span></button>
      </div></div>`;

  const covered = blockOnConn(c.id);
  if (covered){
    h += `<div class="rdi b ${covered.block.done ? 'off' : ''}">
      <div class="n">⛔ ${T('conn.blockedBy', { name: covered.block.nm })}`
      + `${covered.block.done ? T('room.solvedSuffix') : ''}</div>
      ${covered.block.key ? `<div class="k"><b>${T('block.keyLabel')}</b> ${esc(covered.block.key)}</div>` : ''}
      <div class="k"><button class="linkbtn" data-goto="${esc(covered.scene.id)}">${esc(covered.scene.name)}</button></div>
    </div>`;
  }
  if (c.desc) h += `<div class="rd"><h4>${T('conn.howItWorks')}</h4><div style="color:#CBD3C9">${esc(c.desc)}</div></div>`;
  if (c.counters.length) h += `<div class="rd"><h4>${T('view.counters')}</h4>${ctrRow(c, 'c')}</div>`;
  h += tokenRow(t('view.tokens'), tokensAt('conn', c.id));

  return h + `</div>`;
}
