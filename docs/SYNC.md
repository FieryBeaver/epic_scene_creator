# Shared board — setup

Several DMs, several tables, one dungeon. The board lives as a JSON file in a
private GitHub repository; every device polls it, merges what changed and
pushes its own edits back. Each save is a commit, so the repo doubles as the
session log.

No new service, no account beyond GitHub, and the board keeps working when
the wifi does not.

---

## 1. Make a repository for the board

One private repo, any name — `epic-boards` will do. It needs no README and no
licence; the app creates the file on the first save.

Everything is stored in one file, `board.json` by default. A group running two
campaigns can keep `tomb.json` and `whatever-else.json` side by side in the
same repo and point each board at its own path.

## 2. Add the other DMs

**Settings → Collaborators → Add people.** Each DM needs **Write** access.

This is the reason the board lives in a repo rather than a gist: a gist has
exactly one owner, so sharing one would mean sharing one token between
everybody. Here each DM keeps their own credentials, and the commit history
says who changed what.

## 3. Each DM makes a token

Once per person, on **github.com → Settings → Developer settings → Personal
access tokens → Fine-grained tokens → Generate new token**:

| Field | Value |
|---|---|
| Resource owner | whoever owns the board repo |
| Repository access | *Only select repositories* → the board repo |
| Permissions → Repository → **Contents** | **Read and write** |
| Expiration | as short as the campaign needs |

Nothing else. A token this narrow can touch that one repository and nothing
else on the account.

## 4. Connect each device

Open the board, click the status pill in the top bar, fill in owner,
repository, file and token, then **Під'єднати**. **Перевірити доступ** checks
the token first and says plainly what is wrong if something is.

To save the others some typing, use **Скопіювати посилання** — it produces a
link with the repo coordinates in the fragment:

```
https://fierybeaver.github.io/epic_scene_creator/#sync=owner/repo/board.json
```

Opening it fills everything in except the token, which each DM still supplies.
The link carries no credentials and is safe to paste in a group chat.

---

## What the status pill means

| | |
|---|---|
| **Синхронізація вимкнена** | Not connected. The board is local to this browser. |
| **Під'єднання…** / **Синхронізація…** | A request is in flight. |
| **Злиття змін…** | Someone saved first; their version is being folded in. |
| **Синхронізовано HH:MM** | Everything is on the server, as of that time. |
| **Немає мережі** | Offline. Edits are kept and go out when the network returns. |
| **Помилка** | Hover for the reason — usually an expired token. |

Hovering also shows how many GitHub requests the hour has left.

## How conflicts are resolved

Each **scene, passage, token and list** is versioned on its own.

- Two DMs working on **different scenes** both keep their work. This is the
  normal case at a multi-table game and it needs no thought from anybody.
- Two DMs editing **the same scene** resolve to whoever saved later — for that
  scene only. The rest of the board is untouched. The DM whose version was
  replaced gets a message saying so, rather than silently losing it.
- A **deletion** propagates even to a device that was offline when it
  happened, unless that device edited the same thing afterwards, in which case
  the edit wins and the scene stays.

Granularity is the scene, not the field: if two DMs edit the same scene at the
same moment, the later save takes the whole scene. Splitting the dungeon so
each table owns its scenes avoids this entirely.

## Timing and cost

- Polls every 5 s with the tab in front, every 30 s behind. Polls are
  conditional, and GitHub does not charge an unchanged poll against the rate
  limit, so a whole session costs very little of the 5 000/hour a token gets.
- A save goes out about 1.5 s after you stop typing.
- Errors back off, doubling up to a minute, and recover on their own.

## Working offline

Everything keeps working. Edits are stamped locally and pushed when the
connection returns. Separately from sync, the board is written to this
browser's storage a moment after every change and offered back next time the
page opens — closing the tab mid-session costs nothing.

## Security

The token is kept in this browser's `localStorage`. It is never written into
the board file, an export, or the share link.

- Use a fine-grained token limited to the one repository, as above.
- On a shared or borrowed machine, press **Забути на цьому пристрої** when
  you are done. It removes the token and the settings.
- Anyone who can open the browser profile can read the token — treat a laptop
  left logged in the way you would treat the repo itself.
- Keep the repo **private**. The connection check warns if it is not: a public
  repo means the board, and every note in it, is readable by anyone.

## If something goes wrong

**«Репозиторій або файл не знайдено»** — the owner or repo name is off, or the
token was not granted access to that particular repository.

**«Токен не має доступу»** — the token is missing *Contents: Read and write*,
or the person is not a collaborator yet.

**«Токен недійсний або протермінований»** — fine-grained tokens expire. Make
a new one and reconnect.

**The board looks out of date** — click the pill, then **Синхронізувати
зараз**. If that does not help, the repo's commit history has every previous
version; download an old `board.json` and use **Імпорт JSON**.

**Starting over** — delete `board.json` from the repo and the next save from
any device recreates it.
