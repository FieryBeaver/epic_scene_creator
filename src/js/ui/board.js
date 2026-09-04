/**
 * The board: one card per scene, showing at a glance what the DM running it
 * needs — who runs it, how dangerous it is, what is still locked, which
 * rooms it has and who is standing in it.
 */

import { S, sel } from '../core/state.js';
import { neighborsOf, owedBy, tokensAt } from '../core/model.js';
import { locs, isTreasure, locName, locIcon, locColor } from '../core/locations.js';
import { TOKTYPE, dangerColor } from '../core/constants.js';
import { esc, safeColor } from '../util/html.js';
import { el } from '../util/dom.js';
import { measureNodes } from './nodes.js';
import { drawEdges } from './edges.js';

export function renderBoard(){
  const world = el('world');
  const svg = el('edges');

  world.querySelectorAll('.node').forEach(n => n.remove());

  const frag = document.createDocumentFragment();
  // When a scene is selected, everything further than one hop away fades.
  const neighbours = sel && sel.kind === 'scene' ? neighborsOf(sel.id) : null;

  S.scenes.forEach(s => {
    const node = document.createElement('div');
    node.className = 'node';
    node.dataset.scene = s.id;
    node.style.setProperty('--nc', safeColor(s.color, '#54685C'));
    node.style.left = s.x + 'px';
    node.style.top = s.y + 'px';
    if (sel && sel.kind === 'scene' && sel.id === s.id) node.classList.add('sel');
    if (neighbours && !neighbours.has(s.id) && sel.id !== s.id) node.classList.add('dim');
    node.innerHTML = nodeMarkup(s);
    frag.appendChild(node);
  });

  world.appendChild(frag);
  measureNodes(world);
  drawEdges(svg, world);
}

function nodeMarkup(s){
  const activeDangers = s.dangers.filter(x => x.active !== false);
  const openBlocks = s.blocks.filter(x => !x.done);
  const treasures = locs(s).filter(isTreasure);
  const unlooted = treasures.filter(x => !x.taken);
  const worstDanger = activeDangers.reduce((m, x) => Math.max(m, x.lvl || 1), 0);
  const toks = tokensAt('scene', s.id);

  let h = `<div class="head">`
    + `<div class="nm">${esc(s.name)}</div>`
    + `<div class="dm">${s.dm ? 'ДМ: ' + esc(s.dm) : 'ДМ не вказано'}</div>`
    + `</div><div class="body">`;

  /* summary chips */
  const dgStyle = worstDanger
    ? `border-color:${dangerColor(worstDanger)};color:${dangerColor(worstDanger)}` : '';
  h += `<div class="row">`
    + `<span class="chip dg" title="Активні небезпеки" style="${dgStyle}">☠ ${activeDangers.length}</span>`
    + `<span class="chip tr" title="Не забрані скарби">◈ ${unlooted.length}/${treasures.length}</span>`
    + `<span class="chip bk" title="Нерозв'язані блоки">⛔ ${openBlocks.length}/${s.blocks.length}</span>`;

  const pending = (s.events || []).filter(e => !e.fired);
  if (pending.length){
    h += `<span class="chip ev" title="Івенти, які ще не спрацювали: `
      + `${esc(pending.map(e => e.nm).join('; '))}">⚡ ${pending.length}</span>`;
  }

  const owed = owedBy(s.id);
  if (owed.length){
    h += `<span class="chip owe" title="Тут лежать рішення для інших сцен: `
      + `${esc(owed.map(o => o.from.name + ' → ' + o.it.nm).join('; '))}">↩ ${owed.length}</span>`;
  }
  h += `</div>`;

  /* rooms */
  if (locs(s).length){
    h += `<div class="row">` + locs(s).map(l => {
      const col = safeColor(locColor(l));
      return `<span class="chip" style="color:${col};border-color:${col}55;background:${col}14"`
        + ` title="${esc(l.notes || 'кімната')}">${esc(locIcon(l))} ${esc(locName(l))}</span>`;
    }).join('') + `</div>`;
  }

  /* counters */
  if (s.counters.length){
    h += `<div class="row">` + s.counters.map(c =>
      `<span class="ctr"><b>${esc(c.label)}</b>`
      + `<button data-ctr="s:${esc(s.id)}:${esc(c.id)}:-1">−</button>`
      + `<span class="v">${esc(c.value)}</span>`
      + `<button data-ctr="s:${esc(s.id)}:${esc(c.id)}:1">+</button></span>`).join('') + `</div>`;
  }

  /* tokens standing here */
  if (toks.length){
    h += `<div class="tokrow">` + toks.map(t => {
      const col = safeColor(t.color || (TOKTYPE[t.type] || TOKTYPE.other).c);
      const hp = t.hp != null && t.hp !== '' ? ' · ' + esc(t.hp) : '';
      return `<span class="tok" data-token="${esc(t.id)}" style="--tc:${col}">`
        + `<i class="dot"></i>${esc(t.name)}${hp}</span>`;
    }).join('') + `</div>`;
  }

  h += `</div><div class="foot">`
    + `<button class="mini eonly" data-act="link" data-id="${esc(s.id)}">з'єднати</button>`
    + `<button class="mini" data-act="open" data-id="${esc(s.id)}">деталі</button>`
    + `</div>`;

  return h;
}
