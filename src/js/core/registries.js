/**
 * Registries — named lists of unique things (tombs of the nine gods, the five
 * skeleton keys, anything the DM adds) where each item sits in exactly one
 * room on the whole board.
 *
 * The single-placement rule is enforced here: placing an item anywhere clears
 * it from wherever it was before.
 */

import { S, mark, scene } from './state.js';
import { locs, slots, mkLoc, locEmpty } from './locations.js';

/** Ids of a registry's items that are placed somewhere in this scene. */
export function itemsIn(s, registryId){
  return locs(s).map(l => slots(l)[registryId]).filter(Boolean);
}

/** The scene currently holding an item, or null. */
export function hostOf(registryId, itemId){
  return S.scenes.find(s => locs(s).some(l => slots(l)[registryId] === itemId)) || null;
}

/**
 * Remove an item from every room except `keepLocId`, then drop rooms that
 * were only there to hold it.
 */
export function clearSlot(registryId, itemId, keepLocId){
  S.scenes.forEach(s => {
    locs(s).forEach(l => {
      if (slots(l)[registryId] === itemId && l.id !== keepLocId) delete l.reg[registryId];
    });
    s.locations = locs(s).filter(l => !locEmpty(l));
  });
}

/**
 * Move an item into a scene as its own new room. Passing an empty `sceneId`
 * takes the item off the board.
 */
export function place(registryId, itemId, sceneId){
  clearSlot(registryId, itemId);
  const target = sceneId && scene(sceneId);
  if (target) locs(target).push(mkLoc({ reg: { [registryId]: itemId } }));
  mark();
}
