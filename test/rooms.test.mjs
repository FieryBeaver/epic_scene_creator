/**
 * Room nesting: the tree operations, which are pure and therefore worth
 * testing directly rather than through the DOM.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { deserialize } from '../src/js/core/serialize.js';
import { childrenOf, rootRooms, subtree, roomDepth, canNest, setParent, removeRoom }
  from '../src/js/core/locations.js';

/**  a ─ b ─ c
 *   d          */
function board(){
  return deserialize({
    scenes: [{ id: 's1', name: 'S', locations: [
      { id: 'a', nm: 'A' },
      { id: 'b', nm: 'B', parent: 'a' },
      { id: 'c', nm: 'C', parent: 'b' },
      { id: 'd', nm: 'D' },
    ] }],
  }).scenes[0];
}

const ids = list => list.map(l => l.id);

test('roots are the rooms with no parent', () => {
  assert.deepEqual(ids(rootRooms(board())), ['a', 'd']);
});

test('children are direct only', () => {
  const s = board();
  assert.deepEqual(ids(childrenOf(s, 'a')), ['b']);
  assert.deepEqual(ids(childrenOf(s, 'b')), ['c']);
  assert.deepEqual(ids(childrenOf(s, 'c')), []);
});

test('a subtree is everything below, depth first', () => {
  assert.deepEqual(ids(subtree(board(), 'a')), ['b', 'c']);
});

test('depth counts the steps up to a root', () => {
  const s = board();
  const at = id => roomDepth(s, s.locations.find(l => l.id === id));
  assert.deepEqual([at('a'), at('b'), at('c'), at('d')], [0, 1, 2, 0]);
});

test('a room cannot be moved into itself or its own descendant', () => {
  const s = board();
  assert.equal(canNest(s, 'a', 'a'), false, 'into itself');
  assert.equal(canNest(s, 'a', 'b'), false, 'into its child');
  assert.equal(canNest(s, 'a', 'c'), false, 'into its grandchild');
  assert.equal(canNest(s, 'a', 'd'), true);
  assert.equal(canNest(s, 'd', 'c'), true);
  assert.equal(canNest(s, 'a', ''), true, 'back to the top level');
});

test('setParent refuses the moves that would make a loop', () => {
  const s = board();
  assert.equal(setParent(s, 'a', 'c'), false);
  assert.equal(s.locations.find(l => l.id === 'a').parent, '');
  assert.equal(setParent(s, 'd', 'c'), true);
  assert.equal(s.locations.find(l => l.id === 'd').parent, 'c');
});

test('removing a room lifts its children instead of deleting them', () => {
  const s = board();
  removeRoom(s, 'b');
  assert.deepEqual(s.locations.map(l => l.id), ['a', 'c', 'd']);
  assert.equal(s.locations.find(l => l.id === 'c').parent, 'a', 'C moved up to where B was');
});

test('removing a root lifts its children to the top', () => {
  const s = board();
  removeRoom(s, 'a');
  assert.deepEqual(ids(rootRooms(s)), ['b', 'd']);
  assert.equal(s.locations.find(l => l.id === 'b').parent, '');
});

test('removing something that is not there changes nothing', () => {
  const s = board();
  removeRoom(s, 'nope');
  assert.equal(s.locations.length, 4);
});
