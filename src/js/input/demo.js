/**
 * Demo layout — a twelve-scene dungeon that shows every feature at once:
 * rooms, the nine tombs and five keys placed, treasure, a cross-scene danger,
 * a cross-scene block, an event, and tokens on the board.
 *
 * Handy as a starting skeleton, and as a smoke test after a change.
 */

import { S, uid, setBoard, setSel, blank } from '../core/state.js';
import { newScene, newConn, mkToken } from '../core/model.js';
import { locs, mkLoc, isTreasure } from '../core/locations.js';
import { place } from '../core/registries.js';
import { GODS, KEYS, SCENE_COLORS } from '../core/constants.js';
import { TPL_DANGER, TPL_BLOCK, TPL_EVENT, TPL_TREASURE, TPL_CONN } from '../core/templates.js';

const DMS = ['Бобер', 'Саша', 'Шкарпетка', 'Азварія', 'Прамисел', 'Ворон'];

/** Scene name and the rooms it starts with. */
const PLAN = [
  ['Гнилі зали',              ['Обеліск Ацерерака', 'Галерея трикстерів', 'Велетенські сходи']],
  ['Затоплені тунелі',        ['Підземна річка', 'Кам\'яний череп', 'Водоспад']],
  ['Підземелля обману',       ['Кільце тяжіння', 'Фальшива гробниця', 'Двері з зомбі']],
  ['Кузня могильних дворфів', ['Ковальня', 'Кабінет наглядача', 'Спіральні сходи']],
  ['Дзеркальна зала',         ['Дзеркальний коридор', 'Завіса води', 'Обертові лази']],
  ['Зала протистояння',       ['Купіль', 'Порожня комора']],
  ['Яма големів',             ['Яма', 'Статуї богів']],
  ['Зали жаху',               ['Стихійні камери', 'Лігво ящірок']],
  ['Тронна зала',             ['Трон із кісток', 'Крипта Сонячної Королеви']],
  ['Шестерні ненависті',      ['Кімната керування', 'Гниле коло', 'Кислотне коло']],
  ['Підземне озеро',          ['Озеро', 'Двері-пожирач']],
  ['Колиска бога смерті',     ['Лігво Зшитих Сестер', 'Каплиця ненависті', 'Ебонова купіль']],
];

const COLS = 4;
const COL_W = 340;
const ROW_H = 320;

/** Replace the board with the demo layout. Does not render. */
export function buildDemoBoard(){
  setBoard(blank());
  setSel(null);

  layoutScenes();
  placeRegistryItems();
  addTreasureRooms();
  connectScenes();
  addCrossSceneExamples();
  addTokens();

  setSel(null);
  return S;
}

function layoutScenes(){
  PLAN.forEach(([name, rooms], i) => {
    const col = i % COLS, row = Math.floor(i / COLS);
    const s = newScene(80 + col * COL_W, 80 + row * ROW_H, {
      name, dm: DMS[i % DMS.length], color: SCENE_COLORS[i % SCENE_COLORS.length],
    });
    rooms.forEach(nm => locs(s).push(mkLoc({ nm })));
  });
}

/** Nine tombs and five keys, spread so no scene holds too much. */
function placeRegistryItems(){
  GODS.forEach((g, i) => place('gods', g.id, S.scenes[i % S.scenes.length].id));
  KEYS.forEach((k, i) => place('keys', k.id, S.scenes[(i * 2 + 1) % S.scenes.length].id));
}

function addTreasureRooms(){
  TPL_TREASURE.forEach((t, i) => {
    const s = S.scenes[(i * 2) % S.scenes.length];
    locs(s).push(mkLoc({ nm: t.nm, hasTre: true, tre: t.what, guard: t.guard }));
  });
}

function link(a, b, name, fromSide, toSide){
  const made = newConn(S.scenes[a].id, S.scenes[b].id);
  if (!made) return null;
  Object.assign(made.conn, { name, fromSide: fromSide || '', toSide: toSide || '', minutes: 1 });
  return made.conn;
}

/** A four-by-three grid wired along the rows and down the columns. */
function connectScenes(){
  for (let r = 0; r < 3; r++){
    for (let c = 0; c < COLS - 1; c++) link(r * COLS + c, r * COLS + c + 1, 'Коридор', 'E', 'W');
  }
  for (let c = 0; c < COLS; c++){
    for (let r = 0; r < 2; r++) link(r * COLS + c, (r + 1) * COLS + c, 'Сходи вниз', 'S', 'N');
  }
  link(0, 5, 'Повільний портал', 'SE', 'NW');
  const slit = link(1, 2, 'Вузька щілина', 'SE', 'SW');
  if (slit) slit.desc = TPL_CONN[1].desc;
}

/** The point of the board: things in one scene that only another can solve. */
function addCrossSceneExamples(){
  const [s0, , s2, s3] = S.scenes;
  const s6 = S.scenes[6];

  s0.dangers.push({ id: uid('d'), ...TPL_DANGER[0], active: true,
                    src: s3.id, srcLoc: locs(s3)[1].id });
  s0.counters.push({ id: uid('n'), label: 'хвиля', value: 1 });

  const gold = locs(s6).find(isTreasure) || locs(s6)[0];
  s6.blocks.push({ id: uid('b'), ...TPL_BLOCK[0], tgtKind: 'loc', tgt: gold.id, tgtText: '',
                   src: s2.id, srcLoc: locs(s2)[0].id, done: false });

  s2.events.push({ id: uid('e'), ...TPL_EVENT[0], conn: '', act: 'open', fired: false });
}

function addTokens(){
  mkToken('party', 'Експедиція А', { kind: 'scene', id: S.scenes[0].id });
  mkToken('scouts', 'Розвідка союзників', { kind: 'scene', id: S.scenes[2].id });
  mkToken('boss', 'Wight (прорвався)', { kind: 'scene', id: S.scenes[4].id });
}
