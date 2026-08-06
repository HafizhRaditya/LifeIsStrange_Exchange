# Life Is Strange: Exchange — working agreement

Interactive narrative game. Arcadia Bay, Oregon, November 2023 — ten years after
the storm. **No powers, no supernatural.** Hafizh is Creative Director; Claude is
Lead Front-End Developer and Narrative Scripter.

This file is loaded automatically at the start of every Claude Code session in
this repo. It is the consistency mechanism — if a ruling isn't written down here
or in `docs/`, the next session will not know it.

## Stack — non-negotiable

- Front-end only. HTML + CSS + **vanilla JS**. No framework, no build step, no
  npm, no bundler, no backend, no database.
- Save state **only** in `localStorage`, one key, versioned.
- `/data` holds no logic. `/js` holds no prose. Never inline dialogue into JS.
- ES modules + `fetch` need an HTTP origin. `file://` will not work.

```bash
python -m http.server 5173 --directory "E:/My Project/Code Project/Life Is Strange Exchange"
```

## The five writing rules

1. **Fiz never speaks in a `dialogue_sequence`.** His spoken lines exist *only*
   inside choices, where the player selects them. He is the player. If you find
   yourself authoring a Fiz line outside a choice block, stop.
2. **Internal monologue is authored**, flagged `is_internal_thought`, wrapped in
   parentheses, and renders in its own voice. It carries most of the
   characterisation and all of the unreliable narration.
3. **Place and time belong to the Creative Director.** `scene.location` and
   `scene.meta` are the `[ ]` field. The engine renders them and never invents one.
4. **No real-world brands.** In-universe platforms only: Prism, Glimpse, Flicker,
   Echo, Nexus, DeepThread, Aura, ViewGrid. Real pop culture (The Strokes, Taxi
   Driver) is canon, as in the original game.
5. **Rated M.** Swearing is natural to character, never decorative.

## The two standing creative rulings

**The Anomaly is ambiguous.** Nothing in the season is ever stated to be
impossible — only Fiz's *reading* of it is. Every anomalous beat has a mundane
explanation held in reserve in the Anomaly Register (`docs/`). The Episode 1
eleven frames are a **forgery**, not a phenomenon.

**Olivia Calder is played straight.** Zero tells. No coded lines, no lingering
beats, no double meanings. Everything she says in Episodes 1–3 is sincere. The
Episode 4 reveal has to hurt on a first pass and hold up on a second precisely
because she was not performing. Do not foreshadow her.

## Canon ledger

Renames: Ethan → **Jake Cross**. Logan → **Luke Pierce**. Nolan Pierce → **Nolan
Burgh**. Marcus Hale → **Marcus Islah**. Dax Rowe → **Dax Patrickson**. Kieran
Holt → **Kieran Ness**. Sandra Brooks → **Sandra Johnson**. Lena Ortiz → **Gina
Ortiz**. "Ethan" now belongs to exactly one character: Mr. Ethan Rowe.

Elena Ward is **29** (puts her in Max Caulfield's cohort — load-bearing). Barry
Deskowsky is **56**. Amber Clarke uses the **loud** build only. Jake captains
football, Nolan captains basketball.

`data/characters.json` is the machine-readable source of truth. Update it there,
not here, and never key a relationship delta on a spelling — `js/engine/cast.js`
resolves display names to ids and warns loudly on a miss.

## Data format

Episodes follow the Script Bible's authoring shape so the Creative Director's
files drop in unchanged:

```jsonc
{ "speaker": "Riley Jones", "text": "...", "emotion": "soft" }        // NPC line
{ "speaker": "Fiz", "text": "(...)", "is_internal_thought": true }    // inner voice
{ "is_choice": true, "choices": [...], "responses": { ... } }         // choice block
{ "is_anomaly": true, "anomaly": "ep1_eleven_frames" }                // set piece
{ "is_hold": true, "seconds": 3 }                                     // enforced silence
{ "is_submerge": true, "seconds": 2 }                                 // underwater
```

Any entry may carry `requires` / `unless` (a flag name or array of them) to play
conditionally. That is how an Episode 1 choice changes an Episode 2 line without
forking the scene graph — prefer it over writing a whole branch.

`is_hold` is a real pause the player cannot click through. Use it where the
script asks for a long silence; a beat the player waits out is not the same as a
beat they read about. Don't scatter them — they cost patience.

- Choice kind is detected from the text: `"quoted"` is spoken aloud,
  `[bracketed]` is an action or a pointed silence. No extra field.
- `consequence_id` values are unique across the season and are used directly as
  flag keys.
- `responses` is keyed by `consequence_id` and plays right after the choice, then
  the scene reconverges. **Any line that only makes sense after one specific
  option must live in `responses`, never in the shared trunk.** This is the most
  common authoring bug — watch for it.
- **A scene never ends on a choice block.** Always at least one line after.

## Choice model

Track-and-converge. Choices set flags and move relationship integers.
Relationship values are **unbounded and never clamped** — Episode 5's epilogue
reads absolute values to decide who shows up at Departures.

Beacon content gates on flags, so a hallway choice becomes a post on Echo one
scene later. When adding a choice, consider whether it deserves social fallout.

## Save format

One key, `lis_exchange_save`, carrying `schemaVersion`. When the shape changes,
add a migration in `js/engine/state.js`. Never silently wipe a playtest.

## Before you call an episode done

```bash
python tools/validate.py
```

It enforces every rule above across all episode data. It has already caught a
live bug: `"Maddie Hale"` resolving to nothing, because her ledger name is
Madison — which would have broken her speaker plate and silently dropped her
relationship deltas. If a script uses a name the ledger doesn't have, add it to
that character's `aliases` array rather than editing the script.

## Art

Nothing in `/assets` yet. Backgrounds are CSS gradient placeholders
(`.bg--<name>` in `css/theme.css`); portraits are generated rim-lit silhouettes
(`js/ui/portrait.js`) built from each character's `look` in `characters.json`.

**`docs/DESIGN_BRIEF.md` is the handoff document** — palette, type roles, the full
asset manifest with dimensions, the six-expression system, and the interaction
spec. `tools/cast-sheet.html` renders the whole cast on one page as the artist's
reference.

Real art must drop in without JS changes: one CSS line per background, files into
`/assets/portraits` for characters. Keep it that way.

## Conventions

- Reveal animations use `flush()` from `js/util/dom.js`, **not**
  `requestAnimationFrame` — rAF does not fire in a backgrounded tab and would
  leave a choice on screen invisible and unclickable.
- Commit in English, imperative mood. Don't commit or push unless asked.
- Background art is CSS-only placeholder classes in `css/theme.css`
  (`.bg--<name>`). Swapping in real art means editing that file only.

## Status

Episodes 1 and 2 complete, all branches written. Episodes 3–5 exist as scene maps
in `docs/Season1_Script_Bible.txt` and need expanding to dialogue.

Run the game with `start.bat`. Opening `index.html` directly will not work.
