/**
 * Ready-made content from the epic's notes.
 *
 * Only the structure lives here — ids, and the few non-text fields a template
 * carries. The words are in the dictionaries, so a template inserts in
 * whichever language the DM is working in. Once inserted it is their text and
 * switching language leaves it alone.
 */

import { t } from '../i18n/index.js';

/** Dangers: something the scene keeps doing until it is switched off elsewhere. */
export const TPL_DANGER = [
  { id: 'hordes', lvl: 3 },
  { id: 'slime', lvl: 2 },
  { id: 'heat', lvl: 2 },
  { id: 'ghosts', lvl: 3 },
];

/** Blocks: a closed door in the broad sense — needs a key from somewhere. */
export const TPL_BLOCK = [
  { id: 'dark' },
  { id: 'runes' },
  { id: 'acid' },
];

/** Treasure rooms: what is inside and what makes taking it interesting. */
export const TPL_TREASURE = [
  { id: 'golems' },
  { id: 'coins' },
  { id: 'alchemy' },
  { id: 'warmage' },
  { id: 'archive' },
  { id: 'supply' },
];

/** Connections with a twist. */
export const TPL_CONN = [
  { id: 'wall', dir: 'two' },
  { id: 'slit', dir: 'two' },
  { id: 'portal', dir: 'one' },
  { id: 'chasm', dir: 'two' },
];

/** Events: the players pull the trigger, the map changes. */
export const TPL_EVENT = [
  { id: 'collapse' },
  { id: 'flood' },
  { id: 'gears' },
  { id: 'alarm' },
];

/** Bosses that can break through the Gates and land on the board as a token. */
export const TPL_BOSS = [
  'Wight', 'Flameskull', 'Wraith', 'Ghost', 'Revenant',
  'Boneclaw', 'Undead Golem', 'Deathlock Mastermind', 'Death Knight', 'Undead Dragon',
];

/** The name shown in a template dropdown. */
export function tplName(kind, tpl){
  return t(`tpl.${kind}.${tpl.id}.nm`);
}

/** A template's fields, resolved in the current language. */
export function tplText(kind, tpl, field){
  return t(`tpl.${kind}.${tpl.id}.${field}`);
}
