# Architecture

The app is a single page with no server, no framework and no state library.
It is about 2 500 lines of ES modules and CSS. This document explains how they
are arranged and, more usefully, the four rules that keep the arrangement from
collapsing back into one file.

## The shape

```
                    input/          "a person did something"
                       │
                       ▼
                    core/           the board, and the rules about it
                       │
                       ▼
                     ui/            paint the board as it now is
```

Data flows one way. `input/` mutates through `core/` and then asks `ui/` to
repaint; `core/` never renders and never touches the DOM; `ui/` never mutates
the board.

## Layers

### `core/` — the board

No DOM, no rendering. Importable in Node, which is why the file format has
real tests.

| Module | Holds |
|---|---|
| `state.js` | The board object `S`, the selection, the mode, the dirty flag, id generation, and the trivial lookups (`scene()`, `conn()`, `token()`, `reg()`). |
| `constants.js` | The nine gods, five keys, token types, node palette, danger ramp. The seed for the two default registries. |
| `templates.js` | Ready-made dangers, blocks, treasure rooms, passages, events, bosses. |
| `model.js` | Creating and deleting entities, and the queries that relate them (`owedBy`, `neighborsOf`, `blockTargets`, `tokensAt`). |
| `locations.js` | Rooms inside a scene: naming, icons, colour, registry slots. |
| `registries.js` | The one-item-one-room rule and the placement that enforces it. |
| `paths.js` | `data-path` addressing (see below). |
| `serialize.js` | Reading and writing board files, including migration from pre-v3 layouts. Pure. |

### `ui/` — rendering

Everything renders from state; nothing here decides what the state should be.

| Module | Paints |
|---|---|
| `render.js` | `renderAll()` / `renderLive()` and `select()` — the only entry points other layers use. |
| `board.js` | The scene cards. |
| `edges.js` | The SVG wires, their fat invisible click targets, and the HTML labels riding on them. |
| `nodes.js` | Node height cache (see *Measurement*, below). |
| `camera.js` | Pan, zoom, the grid canvas, `fitAll`, `focusScene`. |
| `rail.js` | The left tab strip and its panes, including one per registry. |
| `inspector/` | The right panel: `scene.js`, `connection.js`, `token.js` for editing, `readonly.js` for view mode, `shared.js` for the fragments both use. |
| `panels.js` | Side panel widths and collapse, stored on the board. |

### `input/` — reacting

| Module | Handles |
|---|---|
| `actions.js` | One delegated `click` listener for the whole app. |
| `forms.js` | Delegated `input` and `change`. |
| `pointer.js` | Pan, zoom, dragging cards, dragging tokens, completing a link. |
| `keyboard.js` | Hotkeys. |
| `toolbar.js` | The top bar, import/export, mode switch, the unload guard. |
| `linkmode.js` | The two-click "connect these scenes" state. |
| `scenes.js` | Creating a scene, from wherever the request came. |
| `demo.js` | The twelve-scene demo layout. |

## Four rules

### 1. Markup is declarative; there is one listener per event type

Nothing binds a handler to a rendered element. Every interactive element
carries a `data-*` attribute saying what it is for, and a single delegated
listener on `document` reads it. Rebuilding the inspector therefore costs
nothing in bookkeeping — there is nothing to unbind.

The vocabulary: `data-path` (edit a field), `data-goto` / `data-selconn` /
`data-seltoken` / `data-conn` (navigate), `data-add` / `data-del` (list
items), `data-ctr` (bump a counter), `data-tpl` (fill from a template),
`data-slot` / `data-place` / `data-setitem` (registry placement),
`data-fire` (apply an event), `data-swap`, `data-lvl`.

### 2. Fields address themselves by path

`data-path="s:s3ab:dangers:d7cd:what"` means *the `what` field of danger
`d7cd` in scene `s3ab`*. `core/paths.js` resolves it; `input/forms.js` writes
it. That is why the scene form is a few hundred lines of template literal
rather than a few thousand lines of wiring, and why a form for a new kind of
field needs no new JavaScript.

Paths are resolved fresh on every write, so a path that no longer exists is
ignored rather than throwing.

### 3. Typing does not rebuild the inspector

`renderAll()` replaces the inspector's innerHTML, which would take the caret
with it. So text inputs fire `renderLive()` — board and scene list only,
debounced 200 ms — while selects and checkboxes, which can change *which*
fields exist, fire the full `renderAll()`.

### 4. Dragging a card does not rebuild the board

A node drag would otherwise re-render 12 cards and 19 edges per frame. Instead
the card is moved with a `transform`, and `moveEdgesOf()` updates only the
wires touching it, straight through the DOM. The real `left`/`top` are written
once on pointerup.

## Measurement

Cards are a fixed 236 px wide, but their height depends on content, and edges
need that height to find where to attach. Asking the DOM mid-drag would force
a layout every frame, so `ui/nodes.js` measures every card once after each
board render and serves the cache. Anything that changes card content goes
through `renderBoard()`, which re-measures.

## Escaping

A board file is hand-editable and arrives from disk, so it is untrusted input.

- `esc()` — for text and for quoted attributes.
- `safeColor()` — for anything landing inside `style="…"`. `esc()` is not
  enough there: a value with a `;` or `(` could add declarations of its own.
  Non-colour values fall back to a neutral grey.
- `safeUrl()` — http(s) and mailto pass, scheme-less strings get `https://`,
  everything else (`javascript:` included) is dropped.

Colours reach `style` attributes from four places — scene, registry, room and
token — and all four go through `safeColor()`.

## What is deliberately absent

- **No persistence.** The board lives in the page; Export JSON is the save
  button, and `beforeunload` warns when there are unsaved changes. Adding
  autosave to `localStorage` would be a small change to `toolbar.js`.
- **No undo.** Deletions confirm instead.
- **No framework.** The render functions build HTML strings and assign
  `innerHTML`. At this size that is faster to read than a component tree, and
  it is why the whole app fits in one 97 kB file.
