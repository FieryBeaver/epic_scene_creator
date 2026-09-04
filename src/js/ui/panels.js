/**
 * Side panel widths. Dragging a gutter resizes, double-clicking collapses.
 * Both are stored on the board, so a shared file opens the way it was left.
 */

import { ui, mark } from '../core/state.js';
import { el } from '../util/dom.js';
import { drawGrid } from './camera.js';

const DEFAULTS = { railW: 288, inspW: 340 };
const LIMITS = { railW: [190, 620], inspW: [240, 720] };

const GUTTERS = [
  { gutter: 'gutL', key: 'railW', hidden: 'hideL', cls: 'collapsedL' },
  { gutter: 'gutR', key: 'inspW', hidden: 'hideR', cls: 'collapsedR' },
];

function main(){
  return el('main');
}

function setPanel(key, px){
  const [lo, hi] = LIMITS[key];
  const v = Math.round(Math.min(hi, Math.max(lo, px)));
  main().style.setProperty('--' + key, v + 'px');
  ui()[key] = v;
  drawGrid();
}

/** Push stored widths and collapsed flags into the DOM. */
export function applyPanels(){
  const u = ui();
  main().style.setProperty('--railW', (Number(u.railW) || DEFAULTS.railW) + 'px');
  main().style.setProperty('--inspW', (Number(u.inspW) || DEFAULTS.inspW) + 'px');
  main().classList.toggle('collapsedL', !!u.hideL);
  main().classList.toggle('collapsedR', !!u.hideR);
  drawGrid();
}

export function initPanels(){
  GUTTERS.forEach(({ gutter, key, hidden, cls }) => {
    const g = el(gutter);

    g.addEventListener('pointerdown', ev => {
      ev.preventDefault();
      g.setPointerCapture(ev.pointerId);
      g.classList.add('drag');
      document.body.classList.add('resizing');
      const rect = main().getBoundingClientRect();

      const move = e => {
        const px = key === 'railW' ? e.clientX - rect.left : rect.right - e.clientX;
        // Dragging a collapsed panel brings it back.
        if (ui()[hidden]){
          ui()[hidden] = false;
          main().classList.remove(cls);
        }
        setPanel(key, px);
      };

      const up = () => {
        g.classList.remove('drag');
        document.body.classList.remove('resizing');
        g.removeEventListener('pointermove', move);
        g.removeEventListener('pointerup', up);
        g.removeEventListener('pointercancel', up);
        mark();
      };

      g.addEventListener('pointermove', move);
      g.addEventListener('pointerup', up);
      g.addEventListener('pointercancel', up);
    });

    g.addEventListener('dblclick', () => {
      ui()[hidden] = !ui()[hidden];
      mark();
      applyPanels();
    });
  });
}
