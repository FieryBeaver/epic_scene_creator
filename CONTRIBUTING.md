# Contributing

## Getting set up

```bash
npm install
npm run dev      # http://127.0.0.1:5173
```

`npm run dev` goes through `scripts/dev.mjs` rather than esbuild's CLI: the
CLI's serve mode stops the moment stdin closes, so it dies whenever it is
started detached or from a script.

`npm install` pulls exactly one package, esbuild, and only the standalone
build needs it. The app itself is plain ES modules — no transpiling, no
bundling, no framework. Edit a file, reload the page.

You cannot open `src/index.html` from `file://`: module imports need
http://. That is what `npm run dev` is for.

## Before opening a PR

```bash
npm run check    # tests + build, the same thing CI runs
```

## Where things go

| Change | File |
|---|---|
| New field on a scene / connection / token | the relevant `ui/inspector/*.js`, with a `data-path` — no new handler needed |
| New kind of list item | `core/model.js` factory, `input/actions.js` `addItem`, the inspector section |
| New template text | `core/templates.js` |
| New hotkey | `input/keyboard.js` |
| New board-file field | `core/serialize.js` **and** a test in `test/serialize.test.mjs` |
| Anything about syncing | `core/sync/` — the merge rule is `merge.js` and is fully tested; add the case before the code |
| Styling | the matching `src/styles/*.css`; colours belong in `tokens.css` |
| Any user-visible string | a key in **both** `src/js/i18n/uk.js` and `en.js`, then `t('key')` — never a literal |

[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) has the full module map and the
four rules the code follows. Two of them are easy to break by accident:

- **Text inputs must not trigger `renderAll()`** — it rebuilds the inspector
  and the caret goes with it. Use `renderLive()`.
- **Anything reaching a `style="…"` attribute goes through `safeColor()`**,
  not `esc()`. Board files come from disk and are untrusted.

Translation adds a third: **no user-visible string is a literal**. `npm test`
scans every module for Cyrillic outside `i18n/` and fails on a leftover, and
checks that every `t()` key exists in both dictionaries. Interface strings are
looked up on each render; content strings — the name a new scene gets, a
template's text — are read once at creation and then belong to the DM.

Sync adds a fourth: **a new top-level collection has to be listed in
`SYNCED`** (`core/sync/protocol.js`) or it will silently never travel between
devices. Fields that belong to one device — panel widths, the camera — must
stay *out* of it.

## Changing the board file format

Bump `BOARD_VERSION` in `core/state.js`, teach `deserialize()` to read the old
shape, and add a test for it. Old files must keep opening — a campaign's board
is worth more than the code.

## Style

Two-space indent, semicolons, single quotes. Comments explain *why*, not
*what*; the UI strings are Ukrainian and the code is English. `.editorconfig`
covers the rest.
