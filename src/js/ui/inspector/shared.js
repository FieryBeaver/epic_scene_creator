/**
 * Fragments shared by the edit forms and the read-only briefing:
 * cross-references between scenes, room headers, counter strips, link lists.
 */

import { S, byId, scene } from '../../core/state.js';
import { blockOnLoc } from '../../core/model.js';
import { locs, locName, locIcon, locColor, locLinks, isTreasure, childrenOf }
  from '../../core/locations.js';
import { tplName } from '../../core/templates.js';
import { esc, T, safeColor, safeUrl, linkLabel } from '../../util/html.js';
import { t } from '../../i18n/index.js';

/** `<option>` list of every scene, optionally with an empty choice on top. */
export function sceneOptions(current, withEmpty){
  let h = withEmpty ? `<option value="">${T('insp.notSet')}</option>` : '';
  S.scenes.forEach(s => {
    h += `<option value="${esc(s.id)}"${s.id === current ? ' selected' : ''}>${esc(s.name)}</option>`;
  });
  return h;
}

/**
 * "Where the answer is": a jump button to the scene a danger or block points
 * at, narrowed to a room when one was named.
 */
export function srcRef(it){
  if (!it.src) return `<span class="empty">${T('insp.unassigned')}</span>`;
  const s = scene(it.src);
  if (!s) return `<span class="empty">${T('insp.sceneDeleted')}</span>`;
  const l = it.srcLoc ? byId(locs(s), it.srcLoc) : null;
  return `<button class="linkbtn" data-goto="${esc(s.id)}">→ ${esc(s.name)}`
    + `${l ? ' · ' + esc(locIcon(l)) + ' ' + esc(locName(l)) : ''}</button>`;
}

/** Room picker narrowing a `src` reference down to one room of that scene. */
export function srcLocField(it, path){
  const s = it.src && scene(it.src);
  if (!s) return '';
  if (!locs(s).length){
    return `<div style="font-size:11px;color:var(--dim);margin-bottom:6px">`
      + `${T('insp.noRoomsThere', { name: s.name })}</div>`;
  }
  return `<label class="f"><span>${T('insp.exactRoom', { name: s.name })}</span>
    <select data-path="${esc(path)}:srcLoc">
      <option value="">${T('insp.wholeScene')}</option>
      ${locs(s).map(l => `<option value="${esc(l.id)}"${it.srcLoc === l.id ? ' selected' : ''}>`
        + `${esc(locIcon(l))} ${esc(locName(l))}</option>`).join('')}
    </select></label>`;
}

/** Label of the room in *this* scene that holds someone else's answer. */
export function owedLoc(hostScene, it){
  const l = it.srcLoc ? byId(locs(hostScene), it.srcLoc) : null;
  return l ? `${esc(locIcon(l))} ${esc(locName(l))}` : '';
}

/** Danger level as filled/empty dots. */
export function lvlDots(n){
  const level = Math.min(4, Math.max(1, n || 1));
  return '●'.repeat(level) + `<span style="opacity:.3">${'●'.repeat(4 - level)}</span>`;
}

/** Row of +/− counters for a scene (`s`) or a connection (`c`). */
export function ctrRow(host, kind){
  if (!host.counters.length) return '';
  return `<div class="row" style="margin-top:4px">` + host.counters.map(c =>
    `<span class="ctr"><b>${esc(c.label)}</b>`
    + `<button data-ctr="${kind}:${esc(host.id)}:${esc(c.id)}:-1">−</button>`
    + `<span class="v">${esc(c.value)}</span>`
    + `<button data-ctr="${kind}:${esc(host.id)}:${esc(c.id)}:1">+</button></span>`).join('') + `</div>`;
}

/** Clickable external links attached to a room. */
export function renderLinks(l){
  const links = locLinks(l).filter(k => k.url && safeUrl(k.url));
  if (!links.length) return '';
  return `<div class="lnks">` + links.map(k =>
    `<a class="lnk" href="${esc(safeUrl(k.url))}" target="_blank" rel="noopener noreferrer">`
    + `🔗 ${esc(linkLabel(k))}</a>`).join('') + `</div>`;
}

/* ============================================================
   Rooms
   ============================================================ */

/**
 * The badges on a room header: one per thing worth knowing before opening it.
 *
 * Shared because the edit form and the briefing draw the same row, and the
 * two had already drifted apart on which of them checked `hasTre` versus
 * `isTreasure`.
 */
export function roomBadges(s, l, owed){
  const spent = isTreasure(l) && l.taken;
  const block = blockOnLoc(s, l.id);
  const answers = owed.filter(o => o.it.srcLoc === l.id);
  const kids = childrenOf(s, l.id);

  return [
    isTreasure(l)
      ? `<span class="rb tre" title="${T(spent ? 'room.takenTip' : 'room.hasTreasureTip')}">`
        + `◈${spent ? '✓' : ''}</span>` : '',
    block ? `<span class="rb blk" title="${T('room.blockedBy', { name: block.nm })}">⛔</span>` : '',
    answers.length ? `<span class="rb owe" title="${T('room.answersTip')}">↩</span>` : '',
    locLinks(l).filter(k => k.url).length
      ? `<span class="rb lnk" title="${T('room.hasLinks')}">🔗</span>` : '',
    kids.length
      ? `<span class="rb sub" title="${T('room.subTip', { n: kids.length })}">▤ ${kids.length}</span>` : '',
  ].join('');
}

/** Icon and name, in the room's own colour. */
export function roomLabel(l){
  return `<span class="rname" style="color:${safeColor(locColor(l))}">`
    + `${esc(locIcon(l))} ${esc(locName(l))}</span>`;
}

/** Indent for a nested room, capped so deep trees stay on screen. */
export function roomIndent(depth, step){
  return depth ? `margin-left:${Math.min(depth, 4) * step}px` : '';
}

/** Dropdown that fills a new item from one of the prepared templates. */
export function tplPicker(kind, id, list, label){
  return `<select class="btn sm" data-tpl="${kind}" data-id="${esc(id)}" style="width:auto">
    <option value="">${esc(label || t('scene.fromTemplate'))}</option>
    ${list.map((tpl, i) => `<option value="${i}">${esc(tplName(kind, tpl))}</option>`).join('')}
  </select>`;
}
