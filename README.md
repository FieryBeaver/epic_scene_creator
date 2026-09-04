# Epic Scene Creator

A scene board for running a **multi-table D&D epic**. One pannable map holds
every scene of the dungeon, who is running it, what is dangerous in it, what
is locked, and which other table holds the answer.

Built for *Tomb of Annihilation — Tomb of the Nine Gods*, but nothing in the
tool is specific to it beyond the starting lists, which are editable.

**[Open the board →](https://fierybeaver.github.io/epic_scene_creator/)**
· [User guide (українською)](docs/USAGE.md)
· [Architecture](docs/ARCHITECTURE.md)
· [Board file format](docs/DATA_FORMAT.md)

The interface is in Ukrainian.

---

## What it does

A large epic is run by several DMs at several tables in the same dungeon at
the same time. The hard part is not the map — it is the cross-references: the
undead horde at table 1 never stops until table 4 kills the necromancers, and
the door at table 3 opens only with a code found at table 2. This board keeps
those threads visible.

| | |
|---|---|
| **Scenes** | A card per scene: DM, colour, notes, and a live summary of dangers, treasure, blocks and events. |
| **Passages** | Directed or two-way, pinnable to a compass side, timed in minutes, openable and closable. |
| **Rooms** | Halls, corridors, treasure vaults. A room can hold a god's tomb, a skeleton key, links to a battlemap. |
| **Dangers** | Something the scene keeps doing. Each names the scene — and the room — that switches it off. |
| **Blocks** | A closed door in the broad sense, with the key kept somewhere else on the board. |
| **Events** | The players pull a trigger and the map changes: an event can open or close a passage. |
| **Counters** | Waves, rounds, ally HP — on a scene or on a passage, bumped with +/− during play. |
| **Tokens** | Parties, scouts, allies, bosses that broke through. Drag them between scenes and passages. |
| **Registries** | Lists of unique things (the nine tombs, the five keys, anything you add). Each item lives in exactly one room, board-wide. |
| **View mode** | Read-only briefing for the table: every reference becomes a jump button. Counters and tokens still work. |

There is no server and no account. The board lives in the page; **Export JSON**
saves it, **Import JSON** brings it back.

## Using it

Three ways, all equivalent:

1. **Hosted** — <https://fierybeaver.github.io/epic_scene_creator/>, deployed
   from `main` by GitHub Actions.
2. **Offline, one file** — download `index.html` from the
   [latest CI run's artifacts](../../actions/workflows/ci.yml) (or build it
   yourself, below) and open it. Everything is inlined; no network needed
   beyond the webfont, which falls back to Georgia.
3. **From source** — `npm run dev`, then open <http://127.0.0.1:5173>.

Press `v` to flip between edit and view mode, `f` to fit the board, `n` for a
new scene. Full key list in the [user guide](docs/USAGE.md).

## Developing

The app is plain ES modules and plain CSS. **There is no build step for
development** — `src/index.html` is the app, served over http:// (module
imports do not work from `file://`).

```bash
npm install       # only esbuild, only for the standalone build
npm run dev       # static server on http://127.0.0.1:5173
npm test          # unit tests for the board file format
npm run build     # dist/index.html — the standalone single file
npm run check     # test + build, what CI runs
```

Layout:

```
src/
  index.html          markup shell
  styles/             tokens · layout · board · rail · inspector
  js/
    core/             the board and the rules about it — no DOM
    util/             escaping, geometry, small DOM helpers
    ui/               rendering: board, edges, inspector, rail, camera
    input/            pointer, keyboard, forms, toolbar, demo layout
build.mjs             inlines everything into one file
test/                 node:test, no browser needed
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for how the pieces fit and
which rules keep them from tangling.

## Automation

| Workflow | Trigger | What it does |
|---|---|---|
| [`ci.yml`](.github/workflows/ci.yml) | every push and PR | runs the tests, builds `dist/index.html`, uploads it as an artifact |
| [`deploy.yml`](.github/workflows/deploy.yml) | push to `main` | the same, then publishes `dist/` to GitHub Pages |

First deploy: `actions/configure-pages` turns Pages on automatically, but the
repository must allow it — **Settings → Pages → Source: GitHub Actions**.

## License

MIT. See [LICENSE](LICENSE).
