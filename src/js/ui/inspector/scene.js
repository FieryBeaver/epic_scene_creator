/**
 * Scene editor. Each section is a fieldset; every input carries a
 * `data-path`, so the generic form handler in `input/forms.js` writes it back
 * without a listener of its own.
 */

import { scene, regs } from '../../core/state.js';
import { connsOf, owedBy, tokensAt, blockTargets, blockOnLoc } from '../../core/model.js';
import { locs, locName, locIcon, locColor, locLinks, regRoom, locDesc, locDescPath }
  from '../../core/locations.js';
import { hostOf } from '../../core/registries.js';
import { BLOCK_KINDS, blockKindLabel, tokenTypeName } from '../../core/constants.js';
import { t } from '../../i18n/index.js';
import { TPL_DANGER, TPL_BLOCK, TPL_TREASURE, TPL_EVENT, tplName } from '../../core/templates.js';
import { esc, safeColor } from '../../util/html.js';
import { SIDE_SYM } from '../../util/geometry.js';
import { sceneOptions, srcRef, srcLocField, owedLoc, renderLinks } from './shared.js';
import { isOpen, isRoomOpen } from './folds.js';

export function inspScene(s){
  if (!s) return '';
  const owed = owedBy(s.id);
  return `<div class="ihead">
      <div class="t">${esc(s.name)}</div>
      <div class="s">${esc(s.dm ? t('scene.kindDm', { name: s.dm }) : t('scene.kind'))}</div>
    </div>
    <div class="ipad">
      ${sectionBasics(s)}
      ${fold('rooms',  t('sect.rooms'),    locs(s).length,                 sectionRooms(s))}
      ${fold('danger', t('sect.dangers'),  s.dangers.length,               sectionDangers(s))}
      ${fold('block',  t('sect.blocks'),   s.blocks.length,                sectionBlocks(s))}
      ${fold('event',  t('sect.events'),   s.events.length,                sectionEvents(s))}
      ${fold('conn',   t('sect.conns'),    connsOf(s.id).length,           sectionConnections(s))}
      ${fold('token',  t('sect.tokens'),   tokensAt('scene', s.id).length, sectionTokens(s))}
      ${fold('ctr',    t('sect.counters'), s.counters.length,              sectionCounters(s))}
      ${fold('owed',   t('sect.owed'),     owed.length,                    sectionOwed(s, owed))}
    </div>`;
}

/**
 * One collapsible section.
 *
 * Nine fieldsets open at once is a wall of form. Folding them puts the count
 * in the header instead — enough to decide whether to look inside, which is
 * the whole test for progressive disclosure. Empty sections start closed;
 * whatever the DM opens stays open, per device.
 */
function fold(key, title, count, body){
  const open = isOpen(key, count > 0);
  return `<section class="isect${open ? ' open' : ''}">
    <button class="isect-head" data-section="${key}" aria-expanded="${open}">
      <span class="caret">${open ? '▾' : '▸'}</span>
      <span class="ft">${esc(title)}</span>
      <span class="fc${count ? '' : ' zero'}">${count}</span>
    </button>
    ${open ? `<div class="isect-body">${body}</div>` : ''}
  </section>`;
}

/** Dropdown that fills a new item from one of the prepared templates. */
function tplPicker(kind, id, list, label){
  return `<select class="btn sm" data-tpl="${kind}" data-id="${esc(id)}" style="width:auto">
    <option value="">${esc(label || t('scene.fromTemplate'))}</option>
    ${list.map((tpl, i) => `<option value="${i}">${esc(tplName(kind, tpl))}</option>`).join('')}
  </select>`;
}

/* ---------- scene itself ---------- */

function sectionBasics(s){
  return `<fieldset><legend>${esc(t('scene.legend'))}</legend>
    <label class="f"><span>${esc(t('scene.name'))}</span>
      <input type="text" data-path="s:${esc(s.id)}:name" value="${esc(s.name)}"></label>
    <div class="grid2">
      <label class="f"><span>${esc(t('scene.dm'))}</span>
        <input type="text" data-path="s:${esc(s.id)}:dm" value="${esc(s.dm)}"></label>
      <label class="f"><span>${esc(t('scene.color'))}</span>
        <input type="color" data-path="s:${esc(s.id)}:color" value="${esc(safeColor(s.color, '#54685C'))}"></label>
    </div>
    <label class="f"><span>${esc(t('scene.notes'))}</span>
      <textarea data-path="s:${esc(s.id)}:notes">${esc(s.notes)}</textarea></label>
    <button class="x" data-del-scene="${esc(s.id)}">${esc(t('scene.delete'))}</button>
  </fieldset>`;
}

/* ---------- dangers ---------- */

function sectionDangers(s){
  let h = `<fieldset><legend>${esc(t('sect.dangers'))} · ${s.dangers.length}</legend>`;
  if (!s.dangers.length) h += `<div class="empty">${esc(t('danger.none'))}</div>`;

  s.dangers.forEach(d => {
    const p = `s:${esc(s.id)}:dangers:${esc(d.id)}`;
    h += `<div class="item dgi">
      <div class="ih">
        <input type="text" data-path="${p}:nm" value="${esc(d.nm)}">
        <button class="x" data-del="${p}">✕</button>
      </div>
      <label class="f"><span>${esc(t('danger.what'))}</span>
        <textarea data-path="${p}:what">${esc(d.what)}</textarea></label>
      <label class="f"><span>${esc(t('danger.fix'))}</span>
        <textarea data-path="${p}:fix">${esc(d.fix)}</textarea></label>
      <label class="f"><span>${esc(t('danger.src'))}</span>
        <select data-path="${p}:src">${sceneOptions(d.src, true)}</select></label>
      ${srcLocField(d, `s:${s.id}:dangers:${d.id}`)}
      <div>${srcRef(d)}</div>
      <div class="row" style="margin-top:6px;justify-content:space-between">
        <span class="lvl" data-lvl="${p}">
          ${[1, 2, 3, 4].map(i =>
            `<button data-v="${i}" class="${(d.lvl || 1) >= i ? 'on' : ''}">${i}</button>`).join('')}
        </span>
        <label class="tgl">
          <input type="checkbox" data-path="${p}:active" ${d.active !== false ? 'checked' : ''}> ${esc(t('danger.active'))}</label>
      </div>
    </div>`;
  });

  h += `<div class="row">
    <button class="btn sm" data-add="danger" data-id="${esc(s.id)}">${esc(t('danger.add'))}</button>
    ${tplPicker('danger', s.id, TPL_DANGER)}
  </div></fieldset>`;
  return h;
}

/* ---------- blocks ---------- */

function sectionBlocks(s){
  let h = `<fieldset><legend>${esc(t('sect.blocks'))} · ${s.blocks.length}</legend>`;
  if (!s.blocks.length) h += `<div class="empty">${esc(t('block.none'))}</div>`;

  s.blocks.forEach(b => {
    const p = `s:${esc(s.id)}:blocks:${esc(b.id)}`;
    h += `<div class="item bki">
      <div class="ih">
        <input type="text" data-path="${p}:nm" value="${esc(b.nm)}">
        <button class="x" data-del="${p}">✕</button>
      </div>
      <label class="f"><span>${esc(t('block.what'))}</span>
        <textarea data-path="${p}:what">${esc(b.what)}</textarea></label>
      <label class="f"><span>${esc(t('block.key'))}</span>
        <textarea data-path="${p}:key">${esc(b.key)}</textarea></label>
      <div class="grid2">
        <label class="f"><span>${esc(t('block.covers'))}</span>
          <select data-path="${p}:tgtKind">
            ${BLOCK_KINDS.map(v =>
              `<option value="${v}"${b.tgtKind === v ? ' selected' : ''}>${esc(blockKindLabel(v))}</option>`).join('')}
          </select></label>
        <label class="f"><span>${esc(t('block.src'))}</span>
          <select data-path="${p}:src">${sceneOptions(b.src, true)}</select></label>
      </div>
      ${blockTargetField(s, b, p)}
      ${srcLocField(b, `s:${s.id}:blocks:${b.id}`)}
      <div style="font-size:11px;color:var(--dim)">${esc(t('block.keyIsAt'))}${srcRef(b)}</div>
      <label class="tgl" style="margin-top:5px">
        <input type="checkbox" data-path="${p}:done" ${b.done ? 'checked' : ''}> ${esc(t('block.done'))}</label>
    </div>`;
  });

  h += `<div class="row">
    <button class="btn sm" data-add="block" data-id="${esc(s.id)}">${esc(t('block.add'))}</button>
    ${tplPicker('block', s.id, TPL_BLOCK)}
  </div></fieldset>`;
  return h;
}

function blockTargetField(s, b, p){
  if (b.tgtKind === 'other'){
    return `<label class="f"><span>${esc(t('block.whatText'))}</span>
      <input type="text" data-path="${p}:tgtText" value="${esc(b.tgtText || '')}"></label>`;
  }
  const opts = blockTargets(s, b.tgtKind);
  if (!opts.length){
    return `<div class="empty">${esc(t('block.noTargets'))}</div>`;
  }
  return `<label class="f"><span>${esc(t('block.exactly'))}</span>
    <select data-path="${p}:tgt">
      <option value="">${esc(t('rail.choose'))}</option>
      ${opts.map(o => `<option value="${esc(o.v)}"${b.tgt === o.v ? ' selected' : ''}>`
        + `${esc(o.l)}</option>`).join('')}
    </select></label>`;
}

/* ---------- rooms ---------- */

function sectionRooms(s){
  // What other scenes are waiting to find here, indexed by the room it sits in.
  const owed = owedBy(s.id);

  let h = `<fieldset><legend>${esc(t('sect.rooms'))} · ${locs(s).length}</legend>`;
  if (!locs(s).length){
    h += `<div class="empty">${esc(t('room.none'))}</div>`;
  }

  h += locs(s).map(l => room(s, l, owed)).join('');

  h += `<div class="row">
    <button class="btn sm" data-add="loc" data-id="${esc(s.id)}">${esc(t('room.add'))}</button>
    <button class="btn sm" data-add="loctre" data-id="${esc(s.id)}">${esc(t('room.addTreasure'))}</button>
    ${tplPicker('treasure', s.id, TPL_TREASURE, t('room.treasureTemplate'))}
  </div>`;

  // One-click placement: each list entry becomes a room of this scene.
  regs().forEach(r => {
    h += `<p class="hint" style="margin:8px 0 4px">${esc(t('room.placeHint', { list: r.nm }))}</p>
      <div class="row">` + r.items.map(it => {
      const host = hostOf(r.id, it.id);
      const col = safeColor(r.color, '#C7D6E0');
      return `<button class="chip clk ${host && host.id === s.id ? '' : 'done'}"
        data-place="${esc(s.id)}:${esc(r.id)}:${esc(it.id)}"
        style="color:${col};border-color:${col}55"
        title="${esc(it.note || '')}${host ? esc(t('room.inScene', { name: host.name })) : ''}">`
        + `${esc(it.sym || r.sym || '◆')} ${esc(it.nm)}</button>`;
    }).join('') + `</div>`;
  });

  // The moment a DM wants to track something the two default lists do not
  // cover — artefacts, NPCs, seals — is right here, not in the tab strip.
  h += `<div class="row eonly" style="margin-top:9px">
    <button class="btn sm" data-addreg>${esc(t('room.ownList'))}</button>
    <span class="hint" style="margin:0">${esc(t('room.ownListHint'))}</span>
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
function room(s, l, owed){
  const open = isRoomOpen(l.id);
  const owner = regRoom(l);
  const col = safeColor(locColor(l));
  const block = blockOnLoc(s, l.id);
  const answers = owed.filter(o => o.it.srcLoc === l.id);

  const badges = [
    l.hasTre ? `<span class="rb tre" title="${esc(l.taken ? t('room.takenTip') : t('room.hasTreasureTip'))}">
      ◈${l.taken ? '✓' : ''}</span>` : '',
    block ? `<span class="rb blk" title="${esc(t('room.blockedBy', { name: block.nm }))}">⛔</span>` : '',
    answers.length ? `<span class="rb owe" title="${esc(t('room.answersTip'))}">↩</span>` : '',
    locLinks(l).filter(k => k.url).length ? `<span class="rb lnk" title="${esc(t('room.hasLinks'))}">🔗</span>` : '',
  ].join('');

  return `<div class="room${open ? ' open' : ''}" data-room-id="${esc(l.id)}">
    <div class="room-head">
      <button class="room-toggle" data-room-open="${esc(l.id)}" aria-expanded="${open}">
        <span class="caret">${open ? '▾' : '▸'}</span>
        <span class="rname" style="color:${col}">${esc(locIcon(l))} ${esc(locName(l))}</span>
        <span class="rbadges">${badges}</span>
      </button>
      <button class="x" data-del="s:${esc(s.id)}:locations:${esc(l.id)}"
        title="${esc(owner ? t('room.removeFromBoard') : t('room.delete'))}">✕</button>
    </div>
    ${open ? `<div class="room-body">${roomBody(s, l, owner, block, owed)}</div>` : ''}
  </div>`;
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
    <label class="f"><span>${esc(t('room.name'))}</span>
      <input type="text" placeholder="${esc(owner ? owner.r.one || owner.r.nm : t('room.generic'))}"
        data-path="${namePath}" value="${esc(nameValue)}"></label>
    <label class="f"><span>${esc(t('room.desc'))}</span>
      <textarea data-path="${esc(locDescPath(l, `s:${s.id}:locations:${l.id}`))}"
        >${esc(locDesc(l))}</textarea></label>
    <label class="tgl">
      <input type="checkbox" data-path="${p}:hasTre" ${l.hasTre ? 'checked' : ''}> ${esc(t('room.hasTreasure'))}</label>
    ${l.hasTre ? `
      <label class="f" style="margin-top:6px"><span>${esc(t('room.treasure'))}</span>
        <textarea data-path="${p}:tre">${esc(l.tre || '')}</textarea></label>
      <label class="f"><span>${esc(t('room.guard'))}</span>
        <textarea data-path="${p}:guard">${esc(l.guard || '')}</textarea></label>
      <label class="tgl">
        <input type="checkbox" data-path="${p}:taken" ${l.taken ? 'checked' : ''}> ${esc(t('room.taken'))}</label>` : ''}
    <div style="margin-top:7px">
      <span style="font-size:11px;color:var(--dim)">${esc(t('room.links'))}</span>
      ${locLinks(l).map(k => `<div class="ih" style="margin-top:4px">
        <input type="text" style="flex:0 0 33%" placeholder="${esc(t('room.linkName'))}"
          data-path="${p}:links:${esc(k.id)}:label" value="${esc(k.label || '')}">
        <input type="text" placeholder="https://…"
          data-path="${p}:links:${esc(k.id)}:url" value="${esc(k.url || '')}">
        <button class="x" data-dellink="${esc(s.id)}:${esc(l.id)}:${esc(k.id)}">✕</button>
      </div>`).join('')}
      <button class="btn sm" style="margin-top:4px"
        data-addlink="${esc(s.id)}:${esc(l.id)}">${esc(t('room.addLink'))}</button>
      ${renderLinks(l)}
    </div>
    <div style="font-size:11px;color:var(--dim);margin-top:5px">${block
      ? esc(t('room.blockedBy', { name: block.nm })) + (block.done ? esc(t('room.solvedSuffix')) : '')
      : esc(t('room.free'))}</div>
    ${answersHere(owed, l)}
    ${owner ? '' : joinList(s, l, owner)}`;
}

/** Which list this room belongs to, and the way out of it. */
function membership(s, l, owner){
  const col = safeColor(owner.r.color, '#C7D6E0');
  return `<div class="rmemb" style="border-color:${col}55">
    <span style="color:${col}">${esc(owner.it.sym || owner.r.sym || '◆')} ${esc(owner.r.nm)}</span>
    ${owner.it.note ? `<span class="hint" style="margin:0">${esc(owner.it.note)}</span>` : ''}
    <button class="btn sm eonly" data-place="${esc(s.id)}:${esc(owner.r.id)}:${esc(owner.it.id)}"
      title="${esc(t('room.removeTip'))}">${esc(t('room.removeFromScene'))}</button>
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
    <span>${esc(t('room.joinList'))}</span>
    <select data-toreg="${esc(s.id)}:${esc(l.id)}">
      <option value="">${esc(t('room.notInList'))}</option>
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
    ${esc(t('room.answersHere'))}
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

/* ---------- counters ---------- */

function sectionCounters(s){
  let h = `<fieldset><legend>${esc(t('sect.counters'))}</legend>`;
  if (!s.counters.length) h += `<div class="empty">${esc(t('counter.none'))}</div>`;
  s.counters.forEach(c => {
    const p = `s:${esc(s.id)}:counters:${esc(c.id)}`;
    h += `<div class="ih">
      <input type="text" data-path="${p}:label" value="${esc(c.label)}">
      <input type="number" style="width:70px" data-path="${p}:value" data-num="1" value="${esc(c.value)}">
      <button class="x" data-del="${p}">✕</button>
    </div>`;
  });
  return h + `<button class="btn sm" data-add="counter" data-id="${esc(s.id)}">${esc(t('counter.add'))}</button>
    <span class="hint" style="display:block;margin-top:5px">${esc(t('counter.hint'))}</span></fieldset>`;
}

/* ---------- connections ---------- */

function sectionConnections(s){
  const conns = connsOf(s.id);
  let h = `<fieldset><legend>${esc(t('sect.conns'))} · ${conns.length}</legend>`;
  if (!conns.length) h += `<div class="empty">${esc(t('conn.none'))}</div>`;

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

  return h + `<button class="btn sm" data-act="link" data-id="${esc(s.id)}">${esc(t('conn.addFromScene'))}</button></fieldset>`;
}

/* ---------- tokens ---------- */

function sectionTokens(s){
  const toks = tokensAt('scene', s.id);
  let h = `<fieldset><legend>${esc(t('sect.tokens'))} · ${toks.length}</legend>`;
  if (!toks.length) h += `<div class="empty">${esc(t('token.inSceneNone'))}</div>`;
  toks.forEach(tok => {
    h += `<div class="row" style="justify-content:space-between;margin-bottom:3px">
      <button class="linkbtn" data-seltoken="${esc(tok.id)}">${esc(tok.name)}</button>
      <span class="tag">${esc(tokenTypeName(tok.type))}</span>
    </div>`;
  });
  return h + `<button class="btn sm" data-add="token" data-id="${esc(s.id)}">${esc(t('token.addHere'))}</button></fieldset>`;
}

/* ---------- events ---------- */

function sectionEvents(s){
  const conns = connsOf(s.id);
  let h = `<fieldset><legend>${esc(t('sect.events'))} · ${s.events.length}</legend>`;
  if (!s.events.length){
    h += `<div class="empty">${esc(t('event.none'))}</div>`;
  }

  s.events.forEach(e => {
    const p = `s:${esc(s.id)}:events:${esc(e.id)}`;
    h += `<div class="item evi">
      <div class="ih">
        <input type="text" data-path="${p}:nm" value="${esc(e.nm)}">
        <button class="x" data-del="${p}">✕</button>
      </div>
      <label class="f"><span>${esc(t('event.trigger'))}</span>
        <textarea data-path="${p}:trig">${esc(e.trig)}</textarea></label>
      <label class="f"><span>${esc(t('event.effect'))}</span>
        <textarea data-path="${p}:eff">${esc(e.eff)}</textarea></label>
      <div class="grid2">
        <label class="f"><span>${esc(t('event.affects'))}</span>
          <select data-path="${p}:conn">
            <option value="">${esc(t('event.none2'))}</option>
            ${conns.map(c => {
              const other = scene(c.from === s.id ? c.to : c.from);
              return `<option value="${esc(c.id)}"${e.conn === c.id ? ' selected' : ''}>`
                + `${esc(c.name)} → ${esc(other ? other.name : '?')}</option>`;
            }).join('')}
          </select></label>
        <label class="f"><span>${esc(t('event.action'))}</span>
          <select data-path="${p}:act">
            <option value="open"${e.act === 'open' ? ' selected' : ''}>${esc(t('event.opens'))}</option>
            <option value="close"${e.act === 'close' ? ' selected' : ''}>${esc(t('event.closes'))}</option>
          </select></label>
      </div>
      <label class="tgl">
        <input type="checkbox" data-fire="${esc(s.id)}:${esc(e.id)}" ${e.fired ? 'checked' : ''}> ${esc(t('event.fired'))}</label>
    </div>`;
  });

  return h + `<div class="row">
    <button class="btn sm" data-add="event" data-id="${esc(s.id)}">${esc(t('event.add'))}</button>
    ${tplPicker('event', s.id, TPL_EVENT)}
  </div></fieldset>`;
}

/* ---------- what this scene unlocks elsewhere ---------- */

function sectionOwed(s, owed){
  let h = `<fieldset><legend>${esc(t('sect.owed'))} · ${owed.length}</legend>`;
  if (!owed.length){
    h += `<div class="empty">${esc(t('owed.none'))}</div>`;
  }

  owed.forEach(o => {
    const solved = o.kind === 'danger' ? o.it.active === false : !!o.it.done;
    const where = owedLoc(s, o.it);
    h += `<div class="item ${o.kind === 'danger' ? 'dgi' : 'bki'}">
      <div class="ih"><b>${o.kind === 'danger' ? '☠' : '⛔'} ${esc(o.it.nm)}</b></div>
      <div style="font-size:12px;color:#CBD3C9">${esc(o.kind === 'danger' ? o.it.fix : o.it.key)}</div>
      ${where ? `<div style="font-size:12px;color:var(--jade);margin-top:3px">${esc(t('owed.here', { room: '' }))}${where}</div>` : ''}
      <div style="margin-top:4px">${esc(t('owed.for'))}
        <button class="linkbtn" data-goto="${esc(o.from.id)}">${esc(o.from.name)}</button>
        ${solved ? `<span class="tag">${esc(o.kind === 'danger' ? t('owed.alreadyOff') : t('owed.alreadyDone'))}</span>` : ''}</div>
    </div>`;
  });

  return h + `</fieldset>`;
}
