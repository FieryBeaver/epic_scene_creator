/**
 * Campaign vocabulary that does not change at runtime: the nine gods, the
 * five skeleton keys, token types and the node palette.
 *
 * Gods and keys seed the two default registries. A registry is a list of
 * unique things that live in exactly one room somewhere on the board; the DM
 * can add more of them from the rail.
 */

export const GODS = [
  { id: 'obolaka',  nm: "Обо'лака",   form: 'зорбо' },
  { id: 'moa',      nm: 'Моа',        form: 'якулі' },
  { id: 'wongo',    nm: 'Вонґо',      form: 'су-монстр' },
  { id: 'papazotl', nm: 'Папазотль',  form: 'ебліс' },
  { id: 'nangnang', nm: 'Нанґнанґ',   form: 'ґрунґ' },
  { id: 'ijin',     nm: "І'джин",     form: 'альміраж' },
  { id: 'kubazan',  nm: 'Кубазан',    form: 'фрогемот' },
  { id: 'shagambi', nm: 'Шаґамбі',    form: 'камадан' },
  { id: 'unkh',     nm: 'Ункх',       form: 'flail snail' },
];

export const KEYS = [
  { id: 'k3', nm: 'Трикутник',    sym: '▲' },
  { id: 'k4', nm: 'Квадрат',      sym: '■' },
  { id: 'k5', nm: "П'ятикутник",  sym: '⬟' },
  { id: 'k6', nm: 'Шестикутник',  sym: '⬢' },
  { id: 'k8', nm: 'Восьмикутник', sym: '⯃' },
];

/** The registries every new board starts with. */
export function defaultRegistries(){
  return [
    { id: 'gods', nm: 'Гробниці богів', one: 'Гробниця', sym: '⛩', color: '#54BE9B',
      items: GODS.map(g => ({ id: g.id, nm: g.nm, sym: '', note: g.form })) },
    { id: 'keys', nm: 'Скелетні ключі', one: 'Ключ', sym: '🔑', color: '#9B7BC4',
      items: KEYS.map(k => ({ id: k.id, nm: k.nm, sym: k.sym, note: '' })) },
  ];
}

/** Token kinds and their default colour. */
export const TOKTYPE = {
  boss:   { nm: 'Бос',      c: '#C0524A' },
  scouts: { nm: 'Розвідка', c: '#6A9BD1' },
  ally:   { nm: 'Союзник',  c: '#54BE9B' },
  party:  { nm: 'Група',    c: '#D08A34' },
  other:  { nm: 'Інше',     c: '#9B7BC4' },
};

/** Cycled through as scenes are created, so a fresh board is legible. */
export const SCENE_COLORS = [
  '#54685C', '#54BE9B', '#D08A34', '#C0524A', '#6A9BD1', '#9B7BC4', '#C9B458', '#7FA05A',
];

/** Node width in world units. Height is measured from the DOM. */
export const NODE_W = 236;

/** Danger level 1–4 mapped to a colour ramp. */
const DANGER_RAMP = ['#54685C', '#C9B458', '#D08A34', '#C0524A', '#E2564A'];
export function dangerColor(level){
  return DANGER_RAMP[Math.min(4, level || 1)];
}

/** What a block can stand in front of. The target is always in its own scene. */
export const BLOCK_KINDS = [
  ['loc',   'локацію в цій сцені'],
  ['conn',  'прохід із цієї сцени'],
  ['other', 'щось інше (текстом)'],
];
