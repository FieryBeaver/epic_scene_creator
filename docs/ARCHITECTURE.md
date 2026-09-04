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
| `sync/` | The shared board: `protocol.js` (what travels and how it is versioned), `merge.js` (the merge rule, pure), `github.js` (Contents API client), `engine.js` (the loop), `config.js` (per-device settings). |
| `autosave.js` | Debounced write of the board to `localStorage`, restored on load. |
| `i18n/` | `index.js` (lookup, detection, the change hook) and one dictionary per language. |

### `ui/` — rendering

Everything renders from state; nothing here decides what the state should be.

| Module | Paints |
|---|---|
| `render.js` | `renderAll()` / `renderLive()` and `select()` — the only entry points other layers use. |
| `board.js` | The scene cards. |
| `edges.js` | The SVG wires, their fat invisible click targets, and the HTML labels riding on them. |
| `nodes.js` | Node height cache (see *Measurement*, below). |
| `camera.js` | Pan, zoom, the grid canvas, `fitAll`, `focusScene`. Publishes viewport changes so the minimap can follow without a cycle. |
| `minimap.js` | Whole-board overview with a viewport marker; click or drag to travel. |
| `selbar.js` | Bulk actions, shown only while several scenes are picked. |
| `shortcuts.js` | The keyboard reference behind `?`. |
| `dirty.js` | The dot on Export saying the file on disk is behind. |
| `inspector/folds.js` | Which sections are open, per device. |
| `rail.js` | The left tab strip and its panes, including one per registry. |
| `inspector/` | The right panel: `scene.js`, `rooms.js`, `connection.js`, `token.js` for editing, `readonly.js` for view mode, `shared.js` for the fragments both use, `folds.js` for what is open. |
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

## Interface conventions

- **The board names itself.** The heading is `S.title`, edited in place; the
  app name beside it is fixed. One tool, many campaigns.
- **Grouped toolbar with an overflow.** Nine flat buttons read as nine
  decisions; three groups and a `⋯` read as three. What is rare (import, demo,
  clear) lives in the menu, what is constant does not.
- **Bulk actions appear with a selection** and next to it, rather than sitting
  disabled the rest of the time.
- **Rooms are accordions too**, in both modes and sharing one open state, so
  switching mode does not fold up what you just opened. A scene can hold half
  a dozen rooms, each with a description, treasure, links and
  cross-references; unrolled at once they push the dangers and passages off
  the screen, which at the table is the wrong half to lose. The header carries
  the name and one badge per thing worth knowing. In view mode a room with
  nothing recorded is a plain line rather than an accordion opening onto
  emptiness. Open state is session-only — room ids are per board and there can
  be hundreds, so persisting every one ever opened would grow without bound.
- **A room in a list is one thing.** It used to show an identity chip *and* a
  separate name box *and* a description labelled as coming from elsewhere,
  which read as two objects stapled together. Now: one name (which is the
  list entry's name), one description, and a line saying which list it is in.
- **Progressive disclosure in the inspector.** Nine open fieldsets was a wall
  of form; each is now a section with its count in the header — enough
  information scent to decide whether to open it. Empty sections start closed,
  and what a DM opens stays open on that device.
- **Search covers what people remember.** Not just scene names: DM, notes,
  room, danger, block and event names, because the question is usually "which
  table has the alchemy stash".
- **One save indicator, on the thing that saves.** The board autosaves locally
  and, when connected, to the repo; only the file on disk can be behind, so
  that is what the dot on Export means.

## Borrowed from node editors

The board is a node graph, so it follows the conventions people already have
from React Flow, Blender's shader editor and the rest, rather than inventing
its own:

- **Curved wires.** Straight lines are the least readable option once a dozen
  passages cross. Each end leaves along its own direction — the pinned side if
  there is one, otherwise the dominant axis toward the other node — which is
  the rule React Flow's bezier edges and Blender's noodles both use. Control
  handle length scales with the gap and is clamped, so short hops stay
  straight and long ones bow without curling back.
- **Minimap.** The component every one of those editors ships, for the same
  reason: past a dozen nodes the canvas alone stops answering "what else is
  out there".
- **Shift to box-select, plain drag to pan.** React Flow's default split, and
  the one people arrive expecting. Selection is separate from the inspector's
  single selection (`marked` vs `sel`) because the panel edits one thing while
  the board manipulates many.
- **Collapsing a node to its header**, as Blender does, so the shape of a big
  dungeon can be read at one zoom level.
- **Duplicate, nudge with the arrow keys, delete the selection** — table
  stakes in every graph editor.

## Measurement

Cards are a fixed 236 px wide, but their height depends on content, and edges
need that height to find where to attach. Asking the DOM mid-drag would force
a layout every frame, so `ui/nodes.js` measures every card once after each
board render and serves the cache. Anything that changes card content goes
through `renderBoard()`, which re-measures.

## Two habits that keep the markup readable

**`T('key')`, not `esc(t('key'))`.** Nearly every string in the markup is both
translated and escaped; spelling that out at 250 call sites buried the HTML in
punctuation. `esc()` stays for values, `T()` is for keys.

**The two panels share their fragments.** The edit form and the briefing draw
the same room header, the same cross-reference links, the same counter strips.
Those live in `inspector/shared.js`; when they were copied the two had already
drifted on which of them checked `hasTre` versus `isTreasure`.

## Escaping

A board file is hand-editable and arrives from disk, so it is untrusted input.

- `esc()` — for text and for quoted attributes.
- `safeColor()` — for anything landing inside `style="…"`. `esc()` is not
  enough there: a value with a `;` or `(` could add declarations of its own.
  Non-colour values fall back to a neutral grey.
- `safeUrl()` — http(s) and mailto pass, scheme-less strings get `https://`,
  everything else (`javascript:` included) is dropped.

Colours reach `style` attributes from four places — scene, registry, room and
token — and all four go through `safeColor()`. Registry symbols (`item.sym`,
`registry.sym`, and `locIcon()` which concatenates them) are free-text glyphs
that land in element content, so every call site wraps them in `esc()`;
`locIcon()` itself returns raw text because `blockTargets()` feeds it into
labels that are escaped once, further down.

## Two languages

The tool ships Ukrainian and English. Which one is used is a per-device
choice, detected from the browser and overridable from the menu; it is never
written into the board, because DMs sharing a board need not read the same
language.

The distinction that makes this work is **interface versus content**:

- **Interface** — buttons, labels, hints, the shortcut sheet. Looked up on
  every render, so switching is "fill the static markup again, then redraw",
  and nothing else in the app has to know.
- **Content** — the name a new scene gets, the text a template inserts, the
  two default lists. Read once, at the moment of creation, and from then on
  it is the DM's own text. Switching language must never rewrite it — a board
  authored in Ukrainian keeps reading in Ukrainian when an English-speaking
  DM opens it, which is exactly right for a shared board.

Markup in `index.html` cannot re-read anything, so it declares `data-i18n`
(text) and `data-i18n-attr` (`title:key,aria-label:key`) and `ui/language.js`
fills it in.

Three ways this could rot silently, all covered by `test/i18n.test.mjs`: the
dictionaries drifting apart, a `t()` call naming a key nobody wrote, and a
literal Ukrainian string left behind in a module. The last is checked by
scanning every source file for Cyrillic outside `i18n/` — the one exception
is `serialize.js`, where Ukrainian appears as *data*: values written by old
board files that the migration still has to match.

## Syncing

The board can be shared through a JSON file in a private GitHub repository.
[docs/SYNC.md](SYNC.md) is the user-facing setup; this is the shape of it.

**One change hook.** `state.js` keeps a listener set that `mark()` fires.
Autosave and sync both subscribe there instead of being called from thirty
mutation sites, and both debounce, because `mark()` runs on every keystroke.

**Stamping by comparison, not instrumentation.** Every top-level entity —
scene, passage, token, registry — carries a stamp of `[rev, time, device]`.
Rather than asking each mutation to bump its own stamp, which one of them
would eventually forget to do, `stampChanges()` compares the board against the
last stamped snapshot and stamps whatever actually differs.

**The merge rule** lives in `merge.js` and is pure, so the whole of it is
under test. Per entity id, the later stamp wins; a tombstone is just another
stamp, which is what lets a deletion reach a device that was offline when it
happened. Granularity is the entity, so two DMs on different scenes never
collide.

**Two snapshots, easy to confuse.** The engine keeps `stamped` (the board as
of the last stamping) and `remote` (what the server holds). After a merge
those differ, and using one for the other's job means either re-stamping
unchanged entities or never pushing a merged result. They are separate fields
for that reason.

**Conflicts are expected, not exceptional.** A `PUT` carrying a stale blob sha
gets a 409 from GitHub; the engine reads, merges and writes again. That is the
normal path when two tables save at once, not an error worth showing.

**Local-only fields stay local.** `SYNCED` in `protocol.js` lists what
travels. Panel widths and the camera are not on it.

## What is deliberately absent

- **No undo.** Deletions confirm instead.
- **No framework.** The render functions build HTML strings and assign
  `innerHTML`. At this size that is faster to read than a component tree, and
  it is why the whole app fits in one 97 kB file.
