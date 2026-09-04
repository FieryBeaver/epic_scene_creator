/**
 * Scene editor. Each section is a fieldset; every input carries a
 * `data-path`, so the generic form handler in `input/forms.js` writes it back
 * without a listener of its own.
 */

import { scene } from '../../core/state.js';
import { connsOf, owedBy, tokensAt, blockTargets } from '../../core/model.js';
import { locs } from '../../core/locations.js';
import { BLOCK_KINDS, blockKindLabel, tokenTypeName } from '../../core/constants.js';
import { t } from '../../i18n/index.js';
import { TPL_DANGER, TPL_BLOCK, TPL_EVENT, tplName } from '../../core/templates.js';
import { esc, T, safeColor } from '../../util/html.js';
import { SIDE_SYM } from '../../util/geometry.js';
import { sceneOptions, srcRef, srcLocField, owedLoc, tplPicker } from './shared.js';
import { sectionRooms } from './rooms.js';
import { isOpen } from './folds.js';

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

/* ---------- scene itself ---------- */

function sectionBasics(s){
  return `<fieldset><legend>${T('scene.legend')}</legend>
    <label class="f"><span>${T('scene.name')}</span>
      <input type="text" data-path="s:${esc(s.id)}:name" value="${esc(s.name)}"></label>
    <div class="grid2">
      <label class="f"><span>${T('scene.dm')}</span>
        <input type="text" data-path="s:${esc(s.id)}:dm" value="${esc(s.dm)}"></label>
      <label class="f"><span>${T('scene.color')}</span>
        <input type="color" data-path="s:${esc(s.id)}:color" value="${esc(safeColor(s.color, '#54685C'))}"></label>
    </div>
    <label class="f"><span>${T('scene.notes')}</span>
      <textarea data-path="s:${esc(s.id)}:notes">${esc(s.notes)}</textarea></label>
    <button class="x" data-del-scene="${esc(s.id)}">${T('scene.delete')}</button>
  </fieldset>`;
}

/* ---------- dangers ---------- */

function sectionDangers(s){
  let h = `<fieldset><legend>${T('sect.dangers')} · ${s.dangers.length}</legend>`;
  if (!s.dangers.length) h += `<div class="empty">${T('danger.none')}</div>`;

  s.dangers.forEach(d => {
    const p = `s:${esc(s.id)}:dangers:${esc(d.id)}`;
    h += `<div class="item dgi">
      <div class="ih">
        <input type="text" data-path="${p}:nm" value="${esc(d.nm)}">
        <button class="x" data-del="${p}">✕</button>
      </div>
      <label class="f"><span>${T('danger.what')}</span>
        <textarea data-path="${p}:what">${esc(d.what)}</textarea></label>
      <label class="f"><span>${T('danger.fix')}</span>
        <textarea data-path="${p}:fix">${esc(d.fix)}</textarea></label>
      <label class="f"><span>${T('danger.src')}</span>
        <select data-path="${p}:src">${sceneOptions(d.src, true)}</select></label>
      ${srcLocField(d, `s:${s.id}:dangers:${d.id}`)}
      <div>${srcRef(d)}</div>
      <div class="row" style="margin-top:6px;justify-content:space-between">
        <span class="lvl" data-lvl="${p}">
          ${[1, 2, 3, 4].map(i =>
            `<button data-v="${i}" class="${(d.lvl || 1) >= i ? 'on' : ''}">${i}</button>`).join('')}
        </span>
        <label class="tgl">
          <input type="checkbox" data-path="${p}:active" ${d.active !== false ? 'checked' : ''}> ${T('danger.active')}</label>
      </div>
    </div>`;
  });

  h += `<div class="row">
    <button class="btn sm" data-add="danger" data-id="${esc(s.id)}">${T('danger.add')}</button>
    ${tplPicker('danger', s.id, TPL_DANGER)}
  </div></fieldset>`;
  return h;
}

/* ---------- blocks ---------- */

function sectionBlocks(s){
  let h = `<fieldset><legend>${T('sect.blocks')} · ${s.blocks.length}</legend>`;
  if (!s.blocks.length) h += `<div class="empty">${T('block.none')}</div>`;

  s.blocks.forEach(b => {
    const p = `s:${esc(s.id)}:blocks:${esc(b.id)}`;
    h += `<div class="item bki">
      <div class="ih">
        <input type="text" data-path="${p}:nm" value="${esc(b.nm)}">
        <button class="x" data-del="${p}">✕</button>
      </div>
      <label class="f"><span>${T('block.what')}</span>
        <textarea data-path="${p}:what">${esc(b.what)}</textarea></label>
      <label class="f"><span>${T('block.key')}</span>
        <textarea data-path="${p}:key">${esc(b.key)}</textarea></label>
      <div class="grid2">
        <label class="f"><span>${T('block.covers')}</span>
          <select data-path="${p}:tgtKind">
            ${BLOCK_KINDS.map(v =>
              `<option value="${v}"${b.tgtKind === v ? ' selected' : ''}>${esc(blockKindLabel(v))}</option>`).join('')}
          </select></label>
        <label class="f"><span>${T('block.src')}</span>
          <select data-path="${p}:src">${sceneOptions(b.src, true)}</select></label>
      </div>
      ${blockTargetField(s, b, p)}
      ${srcLocField(b, `s:${s.id}:blocks:${b.id}`)}
      <div style="font-size:11px;color:var(--dim)">${T('block.keyIsAt')}${srcRef(b)}</div>
      <label class="tgl" style="margin-top:5px">
        <input type="checkbox" data-path="${p}:done" ${b.done ? 'checked' : ''}> ${T('block.done')}</label>
    </div>`;
  });

  h += `<div class="row">
    <button class="btn sm" data-add="block" data-id="${esc(s.id)}">${T('block.add')}</button>
    ${tplPicker('block', s.id, TPL_BLOCK)}
  </div></fieldset>`;
  return h;
}

function blockTargetField(s, b, p){
  if (b.tgtKind === 'other'){
    return `<label class="f"><span>${T('block.whatText')}</span>
      <input type="text" data-path="${p}:tgtText" value="${esc(b.tgtText || '')}"></label>`;
  }
  const opts = blockTargets(s, b.tgtKind);
  if (!opts.length){
    return `<div class="empty">${T('block.noTargets')}</div>`;
  }
  return `<label class="f"><span>${T('block.exactly')}</span>
    <select data-path="${p}:tgt">
      <option value="">${T('rail.choose')}</option>
      ${opts.map(o => `<option value="${esc(o.v)}"${b.tgt === o.v ? ' selected' : ''}>`
        + `${esc(o.l)}</option>`).join('')}
    </select></label>`;
}

/* ---------- counters ---------- */

function sectionCounters(s){
  let h = `<fieldset><legend>${T('sect.counters')}</legend>`;
  if (!s.counters.length) h += `<div class="empty">${T('counter.none')}</div>`;
  s.counters.forEach(c => {
    const p = `s:${esc(s.id)}:counters:${esc(c.id)}`;
    h += `<div class="ih">
      <input type="text" data-path="${p}:label" value="${esc(c.label)}">
      <input type="number" style="width:70px" data-path="${p}:value" data-num="1" value="${esc(c.value)}">
      <button class="x" data-del="${p}">✕</button>
    </div>`;
  });
  return h + `<button class="btn sm" data-add="counter" data-id="${esc(s.id)}">${T('counter.add')}</button>
    <span class="hint" style="display:block;margin-top:5px">${T('counter.hint')}</span></fieldset>`;
}

/* ---------- connections ---------- */

function sectionConnections(s){
  const conns = connsOf(s.id);
  let h = `<fieldset><legend>${T('sect.conns')} · ${conns.length}</legend>`;
  if (!conns.length) h += `<div class="empty">${T('conn.none')}</div>`;

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

  return h + `<button class="btn sm" data-act="link" data-id="${esc(s.id)}">${T('conn.addFromScene')}</button></fieldset>`;
}

/* ---------- tokens ---------- */

function sectionTokens(s){
  const toks = tokensAt('scene', s.id);
  let h = `<fieldset><legend>${T('sect.tokens')} · ${toks.length}</legend>`;
  if (!toks.length) h += `<div class="empty">${T('token.inSceneNone')}</div>`;
  toks.forEach(tok => {
    h += `<div class="row" style="justify-content:space-between;margin-bottom:3px">
      <button class="linkbtn" data-seltoken="${esc(tok.id)}">${esc(tok.name)}</button>
      <span class="tag">${esc(tokenTypeName(tok.type))}</span>
    </div>`;
  });
  return h + `<button class="btn sm" data-add="token" data-id="${esc(s.id)}">${T('token.addHere')}</button></fieldset>`;
}

/* ---------- events ---------- */

function sectionEvents(s){
  const conns = connsOf(s.id);
  let h = `<fieldset><legend>${T('sect.events')} · ${s.events.length}</legend>`;
  if (!s.events.length){
    h += `<div class="empty">${T('event.none')}</div>`;
  }

  s.events.forEach(e => {
    const p = `s:${esc(s.id)}:events:${esc(e.id)}`;
    h += `<div class="item evi">
      <div class="ih">
        <input type="text" data-path="${p}:nm" value="${esc(e.nm)}">
        <button class="x" data-del="${p}">✕</button>
      </div>
      <label class="f"><span>${T('event.trigger')}</span>
        <textarea data-path="${p}:trig">${esc(e.trig)}</textarea></label>
      <label class="f"><span>${T('event.effect')}</span>
        <textarea data-path="${p}:eff">${esc(e.eff)}</textarea></label>
      <div class="grid2">
        <label class="f"><span>${T('event.affects')}</span>
          <select data-path="${p}:conn">
            <option value="">${T('event.none2')}</option>
            ${conns.map(c => {
              const other = scene(c.from === s.id ? c.to : c.from);
              return `<option value="${esc(c.id)}"${e.conn === c.id ? ' selected' : ''}>`
                + `${esc(c.name)} → ${esc(other ? other.name : '?')}</option>`;
            }).join('')}
          </select></label>
        <label class="f"><span>${T('event.action')}</span>
          <select data-path="${p}:act">
            <option value="open"${e.act === 'open' ? ' selected' : ''}>${T('event.opens')}</option>
            <option value="close"${e.act === 'close' ? ' selected' : ''}>${T('event.closes')}</option>
          </select></label>
      </div>
      <label class="tgl">
        <input type="checkbox" data-fire="${esc(s.id)}:${esc(e.id)}" ${e.fired ? 'checked' : ''}> ${T('event.fired')}</label>
    </div>`;
  });

  return h + `<div class="row">
    <button class="btn sm" data-add="event" data-id="${esc(s.id)}">${T('event.add')}</button>
    ${tplPicker('event', s.id, TPL_EVENT)}
  </div></fieldset>`;
}

/* ---------- what this scene unlocks elsewhere ---------- */

function sectionOwed(s, owed){
  let h = `<fieldset><legend>${T('sect.owed')} · ${owed.length}</legend>`;
  if (!owed.length){
    h += `<div class="empty">${T('owed.none')}</div>`;
  }

  owed.forEach(o => {
    const solved = o.kind === 'danger' ? o.it.active === false : !!o.it.done;
    const where = owedLoc(s, o.it);
    h += `<div class="item ${o.kind === 'danger' ? 'dgi' : 'bki'}">
      <div class="ih"><b>${o.kind === 'danger' ? '☠' : '⛔'} ${esc(o.it.nm)}</b></div>
      <div style="font-size:12px;color:#CBD3C9">${esc(o.kind === 'danger' ? o.it.fix : o.it.key)}</div>
      ${where ? `<div style="font-size:12px;color:var(--jade);margin-top:3px">${T('owed.here', { room: '' })}${where}</div>` : ''}
      <div style="margin-top:4px">${T('owed.for')}
        <button class="linkbtn" data-goto="${esc(o.from.id)}">${esc(o.from.name)}</button>
        ${solved ? `<span class="tag">${esc(o.kind === 'danger' ? t('owed.alreadyOff') : t('owed.alreadyDone'))}</span>` : ''}</div>
    </div>`;
  });

  return h + `</fieldset>`;
}
