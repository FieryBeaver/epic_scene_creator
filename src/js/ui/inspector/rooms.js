/**
 * The rooms of a scene, as a tree of accordions.
 *
 * Split out of `scene.js` because it is the one section with a shape of its
 * own — nesting, per-room fold state, list membership — while the others are
 * flat lists of items.
 */

import { regs, scene } from '../../core/state.js';
import { owedBy, blockOnLoc } from '../../core/model.js';
import { locs, locName, locIcon, locLinks, regRoom, locDesc, locDescPath,
  rootRooms, childrenOf, canNest } from '../../core/locations.js';
import { hostOf } from '../../core/registries.js';
import { TPL_TREASURE } from '../../core/templates.js';
import { esc, T, safeColor } from '../../util/html.js';
import { t } from '../../i18n/index.js';
import { renderLinks, roomBadges, roomLabel, roomIndent, tplPicker } from './shared.js';
import { isRoomOpen } from './folds.js';

export function sectionRooms(s){
  // What other scenes are waiting to find here, indexed by the room it sits in.
  const owed = owedBy(s.id);

  let h = `<fieldset><legend>${T('sect.rooms')} · ${locs(s).length}</legend>`;
  if (!locs(s).length){
    h += `<div class="empty">${T('room.none')}</div>`;
  }

  // Rooms hold rooms, so the list is a tree rather than a flat run.
  h += rootRooms(s).map(l => room(s, l, owed, 0)).join('');

  h += `<div class="row">
    <button class="btn sm" data-add="loc" data-id="${esc(s.id)}">${T('room.add')}</button>
    <button class="btn sm" data-add="loctre" data-id="${esc(s.id)}">${T('room.addTreasure')}</button>
    ${tplPicker('treasure', s.id, TPL_TREASURE, t('room.treasureTemplate'))}
  </div>`;

  // One-click placement: each list entry becomes a room of this scene.
  regs().forEach(r => {
    h += `<p class="hint" style="margin:8px 0 4px">${T('room.placeHint', { list: r.nm })}</p>
      <div class="row">` + r.items.map(it => {
      const host = hostOf(r.id, it.id);
      const col = safeColor(r.color, '#C7D6E0');
      return `<button class="chip clk ${host && host.id === s.id ? '' : 'done'}"
        data-place="${esc(s.id)}:${esc(r.id)}:${esc(it.id)}"
        style="color:${col};border-color:${col}55"
        title="${esc(it.note || '')}${host ? T('room.inScene', { name: host.name }) : ''}">`
        + `${esc(it.sym || r.sym || '◆')} ${esc(it.nm)}</button>`;
    }).join('') + `</div>`;
  });

  // The moment a DM wants to track something the two default lists do not
  // cover — artefacts, NPCs, seals — is right here, not in the tab strip.
  h += `<div class="row eonly" style="margin-top:9px">
    <button class="btn sm" data-addreg>${T('room.ownList')}</button>
    <span class="hint" style="margin:0">${T('room.ownListHint')}</span>
  </div>`;

  return h + `</fieldset>`;
}

/**
 * One room, folded shut.
 *
 * A scene can have half a dozen rooms and each carries a description,
 * treasure, links and cross-references. Open all at once they bury the rest
 * of the scene, so the header carries the name and a badge per thing worth
 * knowing, and the body waits until it is asked for.
 */
function room(s, l, owed, depth){
  const open = isRoomOpen(l.id);
  const kids = childrenOf(s, l.id);
  const owner = regRoom(l);
  const block = blockOnLoc(s, l.id);
  const answers = owed.filter(o => o.it.srcLoc === l.id);

  return `<div class="room${open ? ' open' : ''}" data-room-id="${esc(l.id)}"
      style="${roomIndent(depth, 12)}">
    <div class="room-head">
      <button class="room-toggle" data-room-open="${esc(l.id)}" aria-expanded="${open}">
        <span class="caret">${open ? '▾' : '▸'}</span>
        ${roomLabel(l)}
        <span class="rbadges">${roomBadges(s, l, owed)}</span>
      </button>
      <button class="x" data-del="s:${esc(s.id)}:locations:${esc(l.id)}"
        title="${esc(owner ? t('room.removeFromBoard') : t('room.delete'))}">✕</button>
    </div>
    ${open ? `<div class="room-body">${roomBody(s, l, owner, block, owed)}</div>` : ''}
  </div>`
  + kids.map(child => room(s, child, owed, depth + 1)).join('');
}

/**
 * The room's fields.
 *
 * A room that belongs to a list is still one room: one name, one description,
 * and a line saying which list it is in. It used to show an identity chip
 * *and* a separate name box *and* a description labelled as coming from
 * somewhere else, which read as two things stapled together.
 */
function roomBody(s, l, owner, block, owed){
  const p = `s:${esc(s.id)}:locations:${esc(l.id)}`;
  const namePath = owner ? `r:${esc(owner.r.id)}:items:${esc(owner.it.id)}:nm` : `${p}:nm`;
  const nameValue = owner ? owner.it.nm : l.nm;

  return `${owner ? membership(s, l, owner) : ''}
    <label class="f"><span>${T('room.name')}</span>
      <input type="text" placeholder="${esc(owner ? owner.r.one || owner.r.nm : t('room.generic'))}"
        data-path="${namePath}" value="${esc(nameValue)}"></label>
    <label class="f"><span>${T('room.desc')}</span>
      <textarea data-path="${esc(locDescPath(l, `s:${s.id}:locations:${l.id}`))}"
        >${esc(locDesc(l))}</textarea></label>
    <label class="tgl">
      <input type="checkbox" data-path="${p}:hasTre" ${l.hasTre ? 'checked' : ''}> ${T('room.hasTreasure')}</label>
    ${l.hasTre ? `
      <label class="f" style="margin-top:6px"><span>${T('room.treasure')}</span>
        <textarea data-path="${p}:tre">${esc(l.tre || '')}</textarea></label>
      <label class="f"><span>${T('room.guard')}</span>
        <textarea data-path="${p}:guard">${esc(l.guard || '')}</textarea></label>
      <label class="tgl">
        <input type="checkbox" data-path="${p}:taken" ${l.taken ? 'checked' : ''}> ${T('room.taken')}</label>` : ''}
    <div style="margin-top:7px">
      <span style="font-size:11px;color:var(--dim)">${T('room.links')}</span>
      ${locLinks(l).map(k => `<div class="ih" style="margin-top:4px">
        <input type="text" style="flex:0 0 33%" placeholder="${T('room.linkName')}"
          data-path="${p}:links:${esc(k.id)}:label" value="${esc(k.label || '')}">
        <input type="text" placeholder="https://…"
          data-path="${p}:links:${esc(k.id)}:url" value="${esc(k.url || '')}">
        <button class="x" data-dellink="${esc(s.id)}:${esc(l.id)}:${esc(k.id)}">✕</button>
      </div>`).join('')}
      <button class="btn sm" style="margin-top:4px"
        data-addlink="${esc(s.id)}:${esc(l.id)}">${T('room.addLink')}</button>
      ${renderLinks(l)}
    </div>
    <div style="font-size:11px;color:var(--dim);margin-top:5px">${block
      ? T('room.blockedBy', { name: block.nm }) + (block.done ? T('room.solvedSuffix') : '')
      : T('room.free')}</div>
    ${answersHere(owed, l)}
    ${nesting(s, l)}
    ${owner ? '' : joinList(s, l, owner)}`;
}

/**
 * Where this room sits, and how to put another one inside it.
 *
 * The parent list leaves out the room itself and everything already under it:
 * moving a room into its own child would cut both loose from the tree.
 */
function nesting(s, l){
  const options = locs(s).filter(other => canNest(s, l.id, other.id) && other.id !== l.id);
  return `<div class="row eonly" style="margin-top:7px;gap:7px;align-items:flex-end">
    <label class="f" style="flex:1 1 auto;margin:0"><span>${T('room.inside')}</span>
      <select data-nest="${esc(s.id)}:${esc(l.id)}">
        <option value="">${T('room.topLevel')}</option>
        ${options.map(o => `<option value="${esc(o.id)}"${l.parent === o.id ? ' selected' : ''}>`
          + `${esc(locIcon(o))} ${esc(locName(o))}</option>`).join('')}
      </select></label>
    <button class="btn sm" data-add="subroom"
      data-id="${esc(s.id)}:${esc(l.id)}">${T('room.addSub')}</button>
  </div>`;
}

/** Which list this room belongs to, and the way out of it. */
function membership(s, l, owner){
  const col = safeColor(owner.r.color, '#C7D6E0');
  return `<div class="rmemb" style="border-color:${col}55">
    <span style="color:${col}">${esc(owner.it.sym || owner.r.sym || '◆')} ${esc(owner.r.nm)}</span>
    ${owner.it.note ? `<span class="hint" style="margin:0">${esc(owner.it.note)}</span>` : ''}
    <button class="btn sm eonly" data-place="${esc(s.id)}:${esc(owner.r.id)}:${esc(owner.it.id)}"
      title="${T('room.removeTip')}">${T('room.removeFromScene')}</button>
  </div>`;
}

/**
 * Put an existing room into one of the lists.
 *
 * The chips below create a room for an item that already exists. This is the
 * other direction, and the one that comes up while writing: the cave you just
 * described turns out to be worth tracking, so it becomes an entry — keeping
 * its name and its description.
 */
function joinList(s, l, owner){
  if (owner || !regs().length) return '';
  return `<label class="f eonly" style="margin-top:6px">
    <span>${T('room.joinList')}</span>
    <select data-toreg="${esc(s.id)}:${esc(l.id)}">
      <option value="">${T('room.notInList')}</option>
      ${regs().map(r => `<option value="${esc(r.id)}">${esc(r.sym || '◆')} ${esc(r.nm)}</option>`).join('')}
    </select></label>`;
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
    ${T('room.answersHere')}
    ${answers.map(o => `<button class="linkbtn" data-goto="${esc(o.from.id)}"
      title="${esc(o.kind === 'danger' ? o.it.fix : o.it.key)}">`
      + `${o.kind === 'danger' ? '☠' : '⛔'} ${esc(o.it.nm)} · ${esc(o.from.name)}`
      + `${solvedTag(o)}</button>`).join(', ')}
  </div>`;
}

function solvedTag(o){
  const solved = o.kind === 'danger' ? o.it.active === false : !!o.it.done;
  return solved ? t('room.closedSuffix') : '';
}

