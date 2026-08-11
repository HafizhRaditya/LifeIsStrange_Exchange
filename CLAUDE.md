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

1. **Fiz's voice.** His spoken lines normally exist only inside choices, where
   the player selects them. **Revised by the Creative Director in the full-season
   scripts:** he also speaks aloud in the dream scenes and in a handful of
   two-hander beats — about 60 lines across the season, authored deliberately.
   Follow the script. Don't invent new Fiz speech outside those.
2. **Internal monologue is authored**, flagged `is_internal_thought`, wrapped in
   parentheses, and renders in its own voice. It carries most of the
   characterisation and all of the unreliable narration.
3. **Place and time belong to the Creative Director.** `scene.location` and
   `scene.meta` are the `[ ]` field. The engine renders them and never invents one.
4. **No real-world brands.** In-universe platforms only: Prism, Glimpse, Flicker,
   Echo, Nexus, DeepThread, Aura, ViewGrid. Real pop culture (The Strokes, Taxi
   Driver) is canon, as in the original game.
5. **Rated M.** Swearing is natural to character, never decorative.

**The other voice.** `???` (`speaker_id: "dark_side"`) is Fiz's intrusive voice,
carrying the dream scenes and the Episode 5 confrontation. It gets no portrait,
no accent hue and no name plate of its own — it is not a person in the room.

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
{ "speaker": "???", "speaker_id": "dark_side", "text": "..." }        // the other voice
{ "speaker": "NARRATION", "text": "[...]", "is_stage_direction": true } // held shot
```

**Exploration scenes** carry `is_exploration`, an `exploration` hub
(`prompt`, `min_required`, `interactables[]`) and a `post_exploration_sequence`.
Each hotspot has an `internal_thought` and optionally a `follow_up` for the
second look — which is the character: he notices, then notices again, and the
second look is the one that costs him. Hotspots gate on `requires_flag` or on a
`presence_condition` like `"Riley Jones >= 8"` (see `js/engine/conditions.js`).

Choice blocks may carry `timed` + `timer_seconds` (running out picks the last
option), and `is_key_choice` / `is_episode_defining` / `is_final_choice`, which
change the prompt and weight of the screen.

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

## Importing scripts

Episode JSON from the Creative Director goes through:

```bash
python tools/import_episodes.py <folder-with-episode_0*.json>
```

It assigns each scene a `background` from its location, fails loudly on anything
it can't map, and drops gates that can never open. **Never hand-edit
`data/episodes/*.json`** — the importer overwrites them. Fix the source or the
importer.

## Before you call an episode done

```bash
python tools/validate.py
```

It enforces every rule above across all episode data. It has already caught a
live bug: `"Maddie Hale"` resolving to nothing, because her ledger name is
Madison — which would have broken her speaker plate and silently dropped her
relationship deltas. If a script uses a name the ledger doesn't have, add it to
that character's `aliases` array rather than editing the script.

## Look

Type is **Newsreader** (display/thought), **IBM Plex Sans** (speech), **IBM Plex
Mono** (chrome). Self-hosted in `/assets/fonts` — never link a CDN, the game must
run offline.

The scene layout has **three directions**, switched by `data-dir` on `#stage` and
picked from the title screen (persisted separately from the save):

- **A · Field Notes** — mono rail down the left edge, dialogue low and unboxed.
- **B · Depth of Field** — blurred foreground plane, plate floats bottom-right.
- **C · The Slate** — screenplay gutter, speaker left, line right. Current default.

Only `css/dialogue.css` differs between them. The engine has no idea which is on
— keep it that way.

## Sound

Ambience is **synthesised in the browser** — filtered noise with slow movement,
no audio files and nothing downloaded (`js/ui/audio.js`, ~6 KB). The bible asks
for ambience per scene and **no score**, and explicitly no music under the pool
scene, so there is no music system to add later. Beds are mapped per background
plate; `tools/ambience.html` plays every scene for tuning.

Browsers refuse audio before a user gesture, so the context stays suspended
until the first click. That is correct, not a bug to route around.

## Art

Two plates are real: `lighthouse-dusk` and `pool-night`, built as procedural SVG
in `/assets/bg` (~7 KB each). The other 36 are still CSS gradient placeholders
(`.bg--<name>` in `css/theme.css`). Portraits are generated rim-lit silhouettes
(`js/ui/portrait.js`) from each character's `look` in `characters.json`.

`tools/plates.html` shows every plate at frame size, with the dialogue and
portrait safe areas overlaid on hover — the lower third and the centre must stay
quiet or the UI stops being readable.

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

Full season imported: **99 scenes, 26 chapters, ~39,400 words, 192 choice blocks,
18 exploration hubs with 127 hotspots.** All five episodes playable end to end.

Open with the Creative Director:

- `scene_condition` on four scenes (`ep1_10_carter_office`, `ep3_04_nolan_gym`,
  `ep3_08_rowe_confirms`, `ep4_07_elise_drive`) is prose, not machine-readable.
  The engine cannot gate on it. Needs explicit flags.
- `ep1_15_media_lab` and `ep5_06_the_dive` set `min_required` above their ungated
  hotspot count. The engine clamps so it can't soft-lock, but a cold save sees a
  lower bar than intended.

Run the game with `start.bat`. Opening `index.html` directly will not work.
