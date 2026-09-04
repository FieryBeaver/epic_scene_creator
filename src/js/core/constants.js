import { t } from '../i18n/index.js';

/**
 * Campaign vocabulary that does not change at runtime: the nine gods, the
 * five skeleton keys, token types and the node palette.
 *
 * Gods and keys seed the two default registries. A registry is a list of
 * unique things that live in exactly one room somewhere on the board; the DM
 * can add more of them from the rail.
 */

export const GODS = ['obolaka', 'moa', 'wongo', 'papazotl', 'nangnang',
                     'ijin', 'kubazan', 'shagambi', 'unkh'];

export const KEYS = [
  { id: 'k3', sym: '▲' },
  { id: 'k4', sym: '■' },
  { id: 'k5', sym: '⬟' },
  { id: 'k6', sym: '⬢' },
  { id: 'k8', sym: '⯃' },
];

/**
 * The registries every new board starts with.
 *
 * Resolved in whatever language is current when the board is made, and then
 * it is the DM's data: switching language later must not rewrite a list
 * somebody has since renamed.
 */
export function defaultRegistries(){
  return [
    { id: 'gods', nm: t('list.gods'), one: t('list.godsOne'), sym: '⛩', color: '#54BE9B',
      items: GODS.map(id => ({ id, nm: t('god.' + id), sym: '', note: t('godform.' + id) })) },
    { id: 'keys', nm: t('list.keys'), one: t('list.keysOne'), sym: '🔑', color: '#9B7BC4',
      items: KEYS.map(k => ({ id: k.id, nm: t('shape.' + k.id), sym: k.sym, note: '' })) },
  ];
}

/** Token kinds and their default colour. The label is looked up live. */
export const TOKTYPE = {
  boss:   { c: '#C0524A' },
  scouts: { c: '#6A9BD1' },
  ally:   { c: '#54BE9B' },
  party:  { c: '#D08A34' },
  other:  { c: '#9B7BC4' },
};

/** Display name of a token kind, in the current language. */
export function tokenTypeName(type){
  return t('toktype.' + (TOKTYPE[type] ? type : 'other'));
}

/** Colour of a token kind. */
export function tokenTypeColor(type){
  return (TOKTYPE[type] || TOKTYPE.other).c;
}

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
export const BLOCK_KINDS = ['loc', 'conn', 'other'];

export function blockKindLabel(kind){
  return t('blockkind.' + kind);
}
