/**
 * Node measurement.
 *
 * Scene cards have a fixed width but their height depends on content. Edges
 * need that height to find their attachment points, and asking the DOM for it
 * mid-drag would force a layout on every frame — so heights are measured once
 * after each board render and served from a cache.
 */

import { NODE_W } from '../core/constants.js';

export { NODE_W };

const heights = new Map();   // sceneId -> px

export function nodeEl(id){
  return document.querySelector(`.node[data-scene="${CSS.escape(id)}"]`);
}

/** Re-read every node height. Called right after the board is rebuilt. */
export function measureNodes(root){
  heights.clear();
  root.querySelectorAll('.node').forEach(e => heights.set(e.dataset.scene, e.offsetHeight));
}

/** Cached size of a scene card, measuring on demand if it is not cached yet. */
export function nodeSize(id){
  let h = heights.get(id);
  if (h == null){
    const e = nodeEl(id);
    h = e ? e.offsetHeight : 110;
    if (e) heights.set(id, h);
  }
  return { w: NODE_W, h };
}
