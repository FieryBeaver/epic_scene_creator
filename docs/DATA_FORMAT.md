# Board file format

**Export JSON** writes one file; **Import JSON** reads it back. The file is
plain JSON, hand-editable, and diffable in git — a campaign's board can live
in a repository alongside its notes.

Current format: `version: 3`. The reader accepts older files and migrates
them; see *Migration* at the end.

## Top level

```jsonc
{
  "app": "toa-scene-board",       // format marker
  "version": 3,
  "title": "Друга фаза — дослідження підземелля",
  "scenes": [ /* … */ ],
  "connections": [ /* … */ ],
  "tokens": [ /* … */ ],
  "registries": [ /* … */ ],
  "ui": { "railW": 288, "inspW": 340, "hideL": false, "hideR": false },
  "camera": { "x": 60, "y": 60, "z": 1 },
  "seq": 87,                      // id counter, kept ahead of every id in use
  "exportedAt": "2026-09-04T11:05:00.000Z"
}
```

Only `scenes` is required. Everything else is defaulted on read: a file
containing `{"scenes": []}` opens as an empty board.

Ids are strings shaped `<prefix><counter><random>` — `s12kq9`, `d3ab1`. The
prefix says what it is (`s` scene, `c` connection, `t` token, `l` room,
`d` danger, `b` block, `e` event, `n` counter, `k` link, `g` registry,
`i` registry item). Nothing depends on the shape except the counter recovery
on import, which parses out the digits so a hand-merged file cannot hand out
an id twice.

## Scene

```jsonc
{
  "id": "s1a2b",
  "name": "Гнилі зали",
  "dm": "Бобер",                  // who runs this table
  "color": "#54BE9B",             // left border of the card
  "x": 80, "y": 80,               // world coordinates, 8 px grid
  "notes": "",
  "dangers":   [ /* … */ ],
  "blocks":    [ /* … */ ],
  "events":    [ /* … */ ],
  "locations": [ /* … */ ],       // rooms
  "counters":  [ { "id": "n1", "label": "хвиля", "value": 3 } ]
}
```

### Danger

Something the scene keeps doing until another scene switches it off.

```jsonc
{
  "id": "d1", "nm": "Орди нежиті",
  "what": "Сцена постійно заповнюється новими хвилями нежиті.",
  "fix":  "Некроманти в іншій сцені підтримують орди.",
  "lvl": 3,                       // 1–4, drives the card's colour
  "active": true,                 // switched off during play
  "src": "s4cd",                  // the scene that holds the answer
  "srcLoc": "l7ef"                // optionally the exact room in it
}
```

`src` is what makes the board worth having: it is why scene `s4cd` shows
"↩ 1" and lists this danger under *Ця сцена розв'язує*.

### Block

A closed door in the broad sense.

```jsonc
{
  "id": "b1", "nm": "Рунічний кодовий замок",
  "what": "Масивні двері з рунами.",
  "key":  "Код записаний в іншій сцені.",
  "tgtKind": "conn",              // "loc" | "conn" | "other"
  "tgt": "c3de",                  // room or connection id, per tgtKind
  "tgtText": "",                  // free text when tgtKind is "other"
  "src": "s2bc", "srcLoc": "l4gh",
  "done": false
}
```

The target is always inside the block's own scene. The key is always
elsewhere.

### Event

The players pull a trigger and the map changes.

```jsonc
{
  "id": "e1", "nm": "Обвал",
  "trig": "Персонажі підривають стіну.",
  "eff":  "Старий прохід засипано, за завалом відкривається інший.",
  "conn": "c3de",                 // the passage it affects, or ""
  "act": "open",                  // "open" | "close"
  "fired": false
}
```

Checking *спрацював* applies the effect immediately: the named connection's
`open` flips. Unchecking puts it back.

### Room (`locations`)

```jsonc
{
  "id": "l1", "nm": "Обеліск Ацерерака",   // "" → derived from registry/treasure
  "notes": "",
  "reg": { "gods": "moa" },       // registryId → itemId
  "hasTre": true,
  "tre": "8 000 gp + код",        // contents
  "guard": "Невидимий бехолдер.", // what makes taking it interesting
  "taken": false,
  "links": [ { "id": "k1", "label": "battlemap", "url": "https://…" } ]
}
```

An empty room — no name, notes, treasure, links or registry slots — is dropped
automatically. Only `http:`, `https:` and `mailto:` links survive a read.

## Connection

```jsonc
{
  "id": "c1", "from": "s1a2b", "to": "s2cd3",
  "name": "Коридор",
  "dir": "two",                   // "two" | "one" (from → to)
  "fromSide": "E", "toSide": "W", // "" = auto; N NE E SE S SW W NW up down
  "desc": "",
  "minutes": 1,                   // crossing time, shown on the label
  "open": true,
  "counters": [ { "id": "n2", "label": "проходів", "value": 0 } ]
}
```

Connections naming a scene that is not in the file are dropped on read.
Several connections between the same pair are fine — they fan out visually.

## Token

```jsonc
{
  "id": "t1", "name": "Експедиція А",
  "type": "party",                // boss | scouts | ally | party | other
  "color": "#D08A34",             // "" → the type's colour
  "hp": "", "notes": "",
  "at": { "kind": "scene", "id": "s1a2b" }   // or kind "conn", or null
}
```

A token pointing at something the file does not contain keeps its identity but
loses its position (`at: null`).

## Registry

A list of unique things where each item sits in exactly one room on the whole
board. Two exist by default; the DM can add more.

```jsonc
{
  "id": "gods",
  "nm": "Гробниці богів",         // list name, and its rail tab
  "one": "Гробниця",              // singular, used to name a room
  "sym": "⛩", "color": "#54BE9B",
  "items": [ { "id": "moa", "nm": "Моа", "sym": "", "note": "якулі" } ]
}
```

Placement lives on the room (`location.reg`), not here. The single-placement
rule is enforced on write: placing an item anywhere clears it from wherever it
was.

## Reading rules

The reader treats the file as untrusted and normalises everything:

- missing arrays become empty arrays; missing strings become `""`;
- `lvl` is clamped to 1–4, numeric fields coerced, non-numbers become `0`;
- connections and token positions referring to absent ids are dropped;
- empty registry slots are removed;
- `seq` is raised past the highest id in the file.

A payload without a `scenes` array is rejected outright.

## Migration

Pre-v3 files are read and converted:

| Old | New |
|---|---|
| `scene.gods: ["moa"]` | a room with `reg: {gods: "moa"}` |
| `scene.keys: ["k3"]` | a room with `reg: {keys: "k3"}` |
| `scene.treasures[]` | rooms with `hasTre: true`, `tre`, `guard`, `taken` |
| `block.tgtKind: "treasure" \| "god" \| "скарб" \| "гробницю" \| …` | `"loc"`, re-pointed at the room the old target became |
| `treasure.block` | sets that block's target to this room |

The migration is covered by tests in `test/serialize.test.mjs`; add a case
there before changing it.
