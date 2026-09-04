# Contributing

## Getting set up

```bash
npm install
npm run dev      # http://127.0.0.1:5173
```

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
| Styling | the matching `src/styles/*.css`; colours belong in `tokens.css` |

[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) has the full module map and the
four rules the code follows. Two of them are easy to break by accident:

- **Text inputs must not trigger `renderAll()`** — it rebuilds the inspector
  and the caret goes with it. Use `renderLive()`.
- **Anything reaching a `style="…"` attribute goes through `safeColor()`**,
  not `esc()`. Board files come from disk and are untrusted.

## Changing the board file format

Bump `BOARD_VERSION` in `core/state.js`, teach `deserialize()` to read the old
shape, and add a test for it. Old files must keep opening — a campaign's board
is worth more than the code.

## Style

Two-space indent, semicolons, single quotes. Comments explain *why*, not
*what*; the UI strings are Ukrainian and the code is English. `.editorconfig`
covers the rest.
