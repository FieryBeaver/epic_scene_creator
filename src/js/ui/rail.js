/**
 * Left rail: a tab per list. Scenes and tokens are fixed; every registry the
 * DM defines gets a tab of its own, created and removed as needed.
 */

import { S, sel, regs, reg } from '../core/state.js';
import { tokenHost } from '../core/model.js';
import { locs, isTreasure, locName, locIcon, locColor } from '../core/locations.js';
import { hostOf } from '../core/registries.js';
import { tokenTypeName, tokenTypeColor } from '../core/constants.js';
import { t } from '../i18n/index.js';
import { TPL_BOSS } from '../core/templates.js';
import { esc, safeColor } from '../util/html.js';
import { el } from '../util/dom.js';
import { sceneOptions } from './inspector/shared.js';

let tab = 'scenes';
let query = '';

export function setTab(name){
  tab = name;
  showTab();
}

export function renderRail(){
  renderTabs();
  renderPaneScenes();
  renderPaneTokens();
  renderRegPanes();
  showTab();
}

/**
 * Only the strip is rebuilt; the "new list" button is markup and stays put.
 * Exported because renaming a list has to move its tab label without
 * rebuilding the pane the DM is typing into.
 */
export function renderTabs(){
  el('tabStrip').innerHTML =
    `<button data-p="scenes">${esc(t('rail.scenes'))}</button>`
    + `<button data-p="tokens">${esc(t('rail.tokens'))}</button>`
    + regs().map(r => `<button data-p="reg-${esc(r.id)}">${esc(r.sym || '')} ${esc(r.nm)}</button>`).join('');
  markActive();
}

function showTab(){
  // A registry tab can disappear while it is open.
  if (tab.startsWith('reg-') && !reg(tab.slice(4))) tab = 'scenes';
  markActive();
  document.querySelectorAll('.pane')
    .forEach(p => p.classList.toggle('on', p.id === 'p-' + tab));
}

function markActive(){
  let active = null;
  document.querySelectorAll('#tabStrip button[data-p]').forEach(b => {
    const on = b.dataset.p === tab;
    b.classList.toggle('on', on);
    if (on) active = b;
  });
  // The strip scrolls, so a tab selected from elsewhere — a new list, or one
  // reached through the inspector — has to bring itself into view.
  if (active && active.scrollIntoView){
    active.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
}

/* ---------- scenes ---------- */

export function renderPaneScenes(){
  const hits = S.scenes.filter(matches);
  const filtering = !!query;

  let h = `<h3>${esc(t('rail.scenes'))} · ${hits.length}`
    + `${filtering ? `<span class="of">${esc(t('rail.of', { total: S.scenes.length }))}</span>` : ''}</h3>`;

  if (S.scenes.length > 4 || filtering){
    h += `<div class="srch">
      <input type="search" id="sceneSearch" class="srch-in" placeholder="${esc(t('rail.searchPlaceholder'))}"
        aria-label="${esc(t('rail.searchLabel'))}" value="${esc(query)}">
      ${filtering ? `<button class="srch-x" data-search-clear title="${esc(t('rail.clear'))}">✕</button>` : ''}
    </div>`;
  }

  if (!S.scenes.length){
    h += `<p class="hint">${t('rail.noScenes')}</p>`;
  } else if (!hits.length){
    h += `<p class="hint">${esc(t('rail.noMatches', { query }))}</p>`;
  }

  hits.forEach(s => {
    const active = sel && sel.kind === 'scene' && sel.id === s.id;
    const dangers = s.dangers.filter(d => d.active !== false).length;
    const blocks = s.blocks.filter(b => !b.done).length;
    const treasure = locs(s).filter(l => isTreasure(l) && !l.taken).length;
    const rooms = locs(s).length;

    h += `<div class="card ${active ? 'act' : ''}" data-goto="${esc(s.id)}" tabindex="0"
        style="border-left:3px solid ${safeColor(s.color, '#54685C')}">
      <div class="cn">${esc(s.name)}</div>
      <div class="cs">${s.dm ? esc(s.dm) + ' · ' : ''}☠ ${dangers} · ◈ ${treasure} · ⛔ ${blocks}`
      + `${rooms ? ' · ▣ ' + rooms : ''}</div>
      ${rooms ? `<div class="tagline">${locs(s).map(l =>
        `<span class="tag" style="color:${safeColor(locColor(l))}">${esc(locIcon(l))} ${esc(locName(l))}</span>`
      ).join('')}</div>` : ''}
    </div>`;
  });

  el('p-scenes').innerHTML = h;
  restoreSearchFocus();
}

/**
 * Match on everything a DM might remember a scene by — its name, who runs
 * it, and what is in it. Searching only titles would miss "which table has
 * the alchemy stash?", which is the question people actually arrive with.
 */
function matches(s){
  if (!query) return true;
  const q = query.toLowerCase();
  if (s.name.toLowerCase().includes(q)) return true;
  if ((s.dm || '').toLowerCase().includes(q)) return true;
  if ((s.notes || '').toLowerCase().includes(q)) return true;
  if (locs(s).some(l => locName(l).toLowerCase().includes(q))) return true;
  return [...s.dangers, ...s.blocks, ...s.events]
    .some(x => (x.nm || '').toLowerCase().includes(q));
}

export function setSearch(next){
  query = next || '';
  renderPaneScenes();
}

export function clearSearch(){
  setSearch('');
  const box = el('sceneSearch');
  if (box) box.focus();
}

/** The pane is rebuilt on every keystroke, so put the caret back. */
function restoreSearchFocus(){
  if (!searchHadFocus) return;
  const box = el('sceneSearch');
  if (!box) return;
  box.focus();
  const end = box.value.length;
  try { box.setSelectionRange(end, end); } catch { /* not supported */ }
  searchHadFocus = false;
}

let searchHadFocus = false;

export function markSearchFocused(){
  searchHadFocus = true;
}

/* ---------- tokens ---------- */

function renderPaneTokens(){
  let h = `<h3>${esc(t('rail.tokens'))} · ${S.tokens.length}</h3>
    <p class="hint">${esc(t('rail.tokensHint'))}</p>
    <div class="row eonly" style="margin-bottom:8px">
      <button class="btn sm" data-newtok="boss">${esc(t('rail.addBoss'))}</button>
      <button class="btn sm" data-newtok="scouts">${esc(t('rail.addScouts'))}</button>
      <button class="btn sm" data-newtok="ally">${esc(t('rail.addAlly'))}</button>
      <button class="btn sm" data-newtok="party">${esc(t('rail.addParty'))}</button>
    </div>
    <label class="f eonly"><span>${esc(t('rail.bossQuick'))}</span>
      <select data-boss-tpl>
        <option value="">${esc(t('rail.choose'))}</option>
        ${TPL_BOSS.map(b => `<option>${esc(b)}</option>`).join('')}
      </select></label>
    <div class="sep"></div>`;

  if (!S.tokens.length) h += `<p class="hint">${esc(t('rail.noTokens'))}</p>`;

  S.tokens.forEach(tok => {
    const host = tokenHost(tok);
    const c = safeColor(tok.color || tokenTypeColor(tok.type));
    h += `<div class="card" style="border-left:3px solid ${c}">
      <div class="cn">${esc(tok.name)}</div>
      <div class="cs">${esc(tokenTypeName(tok.type))}${tok.hp ? ' · ' + esc(tok.hp) : ''}</div>
      <div style="margin-top:4px">${host
        ? (tok.at.kind === 'scene'
            ? `<button class="linkbtn" data-goto="${esc(host.id)}">→ ${esc(host.name)}</button>`
            : `<button class="linkbtn" data-selconn="${esc(host.id)}">${esc(t('rail.onConn', { name: host.name }))}</button>`)
        : `<span class="empty">${esc(t('rail.offBoard'))}</span>`}
        <button class="btn sm" data-seltoken="${esc(tok.id)}" style="float:right">${esc(t('rail.edit'))}</button></div>
    </div>`;
  });

  el('p-tokens').innerHTML = h;
}

/* ---------- registries ---------- */

/**
 * Refresh the list panes unless the DM is typing into one.
 *
 * A registry item's description is edited from two places at once — the list
 * on the left and the room on the right, both on screen together — so an edit
 * in either has to show up in the other. Skipping the rebuild while the focus
 * is inside a pane is what keeps that from eating the caret.
 */
export function refreshRegPanes(){
  const active = document.activeElement;
  if (active && active.closest && active.closest('.pane[id^="p-reg-"]')) return;
  renderRegPanes();
}

function renderRegPanes(){
  const box = el('panes');
  const wanted = new Set(regs().map(r => 'p-reg-' + r.id));
  box.querySelectorAll('.pane[id^="p-reg-"]').forEach(pane => {
    if (!wanted.has(pane.id)) pane.remove();
  });

  regs().forEach(r => {
    let pane = document.getElementById('p-reg-' + r.id);
    if (!pane){
      pane = document.createElement('section');
      pane.className = 'pane';
      pane.id = 'p-reg-' + r.id;
      box.appendChild(pane);
    }
    pane.innerHTML = regPaneHtml(r);
  });
}

function regPaneHtml(r){
  const placed = r.items.filter(it => hostOf(r.id, it.id)).length;
  const id = esc(r.id);

  let h = `<h3>${esc(r.sym || '')} ${esc(r.nm)} · ${placed}/${r.items.length}</h3>
    <p class="hint">${esc(t('reg.hint'))}</p>
    <div class="eonly" style="border:1px solid var(--line);border-radius:5px;padding:7px;margin-bottom:9px">
      <div class="grid2">
        <label class="f"><span>${esc(t('reg.listName'))}</span>
          <input type="text" data-path="r:${id}:nm" value="${esc(r.nm)}"></label>
        <label class="f"><span>${esc(t('reg.glyph'))}</span>
          <input type="text" data-path="r:${id}:sym" value="${esc(r.sym || '')}"></label>
      </div>
      <div class="grid2">
        <label class="f"><span>${esc(t('reg.roomWord'))}</span>
          <input type="text" placeholder="${esc(r.nm)}" data-path="r:${id}:one" value="${esc(r.one || '')}"></label>
        <label class="f"><span>${esc(t('reg.color'))}</span>
          <input type="color" data-path="r:${id}:color" value="${esc(safeColor(r.color))}"></label>
      </div>
      <button class="x" data-delreg="${id}">${esc(t('reg.deleteList'))}</button>
    </div>`;

  if (!r.items.length) h += `<p class="hint">${esc(t('reg.empty'))}</p>`;

  r.items.forEach(it => {
    const host = hostOf(r.id, it.id);
    const p = `r:${id}:items:${esc(it.id)}`;
    h += `<div class="card" style="border-left:3px solid ${safeColor(r.color, '#54685C')}">
      <div class="cn">${esc(it.sym || r.sym || '◆')} ${esc(it.nm)}</div>
      ${it.note ? `<div class="cs">${esc(it.note)}</div>` : ''}
      <div class="eonly grid2" style="margin-top:5px">
        <input type="text" placeholder="${esc(t('reg.itemName'))}" data-path="${p}:nm" value="${esc(it.nm)}">
        <input type="text" placeholder="${esc(t('reg.itemGlyph'))}" data-path="${p}:sym" value="${esc(it.sym || '')}">
      </div>
      <input class="eonly" type="text" style="margin-top:4px" placeholder="${esc(t('reg.itemNote'))}"
        data-path="${p}:note" value="${esc(it.note || '')}">
      <label class="f eonly" style="margin-top:5px"><span>${esc(t('reg.roomDesc'))}</span>
        <textarea data-path="${p}:desc"
          placeholder="${esc(t('reg.roomDescPlaceholder'))}">${esc(it.desc || '')}</textarea></label>
      ${it.desc && !host ? `<div class="cs" style="margin-top:3px">${esc(it.desc)}</div>` : ''}
      <div style="margin-top:5px">${host
        ? `<button class="linkbtn" data-goto="${esc(host.id)}">→ ${esc(host.name)}</button>`
        : `<span class="empty">${esc(t('reg.unplaced'))}</span>`}</div>
      <div class="eonly row" style="margin-top:5px">
        <select style="flex:1" data-setitem="${id}:${esc(it.id)}">
          <option value="">${esc(t('reg.chooseScene'))}</option>${sceneOptions(host ? host.id : '', false)}</select>
        <button class="x" data-delitem="${id}:${esc(it.id)}">✕</button>
      </div>
    </div>`;
  });

  return h + `<button class="btn sm eonly" data-additem="${id}">${esc(t('reg.addItem'))}</button>`;
}
