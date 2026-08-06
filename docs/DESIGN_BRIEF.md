# Design brief — Life Is Strange: Exchange

Handoff document. Everything a designer or art pass needs to replace the current
placeholders without touching the engine.

**Companion pages** (run `start.bat`, then open):
- `http://localhost:5173` — the game
- `http://localhost:5173/tools/cast-sheet.html` — all 37 characters, hair / build /
  skin / accent hue on one page

---

## 1. The feeling

Arcadia Bay, November 2023. Ten years after a storm that erased the town, in a
version of it that was rebuilt too neatly. Late autumn, trees stripped, rain
since Friday.

The player is a seventeen-year-old exchange student who watches everything and
says almost nothing. **The design has to feel like observation.** Not adventure,
not horror. The camera is always slightly too far away, the frame is always a
little too still, and the interface is reticent — it offers, it doesn't demand.

Three words if you need them: **quiet, weathered, watched.**

### Anti-goals — the ways this gets it wrong

- **Do not make it spooky.** There is no supernatural in this game. Fog and
  lighthouses are geography, not atmosphere-as-threat. No glitch effects, no
  horror typography, no red.
- **Do not make it a visual novel.** No anime portraits, no bouncing name plates,
  no sparkles on choices, no emoji.
- **Do not make it a slick app.** No drop shadows on everything, no rounded
  friendly cards, no gradient buttons. This town is not a product.
- **Do not brighten it.** Every instinct to "add pop" is wrong here. The single
  most common failure mode will be making it look cheerful.

---

## 2. Visual language

### Palette

Already implemented in `css/theme.css` as CSS custom properties — change them
there and the whole game follows.

| Token | Value | Use |
|---|---|---|
| `--ink` | `#0b0c0e` | page ground |
| `--bone` | `#e8e4dc` | primary text |
| `--bone-dim` | `#b9b3a8` | secondary text, narration |
| `--fog` | `#8c9199` | metadata, timestamps |
| `--fog-dim` | `#5d636c` | disabled, hints |
| `--rust` | `#b4623a` | the single accent — used sparingly |
| `--moss` | `#6d7a5c` | secondary accent |
| `--amber-warm` | `#d9a441` | interior light, timecode |
| `--cold` / `--cold-deep` | `#4d7a97` / `#24384a` | night, water — **reserved** |

**The one rule:** cold blue belongs to night and water only. If it shows up in a
daytime scene it stops meaning anything, and Episode 2's pool scene loses its
entire visual payoff.

Each character also carries an accent `hue` (0–360) in `data/characters.json`,
used for their name plate, their portrait rim light, and the hairline above the
dialogue box. These are deliberately desaturated in use — they identify a
speaker, they don't decorate.

### Type

Currently system stacks. If you introduce real faces, keep the three roles:

- **Display (serif)** — titles, Fiz's internal monologue, silent choices. Wants
  to feel handwritten-adjacent, literary, slightly old. *Italic is load-bearing:
  it's how the player knows they're inside Fiz's head.*
- **Body (sans)** — spoken NPC dialogue and spoken choices. Neutral, quiet, high
  legibility at small sizes.
- **Mono** — timestamps, location slates, app chrome, the timecode. Feels like
  equipment: cameras, security logs, edit suites.

Self-host any webfont in `/assets`. No CDN links — there's no build step and the
game must run offline.

### Texture

Film grain and a vignette sit over everything (CSS, already built). Keep them.
They are doing most of the work of making flat colour read as photographed.

---

## 3. Asset manifest

This is the actual blocker. Everything below is currently a CSS gradient or a
generated silhouette.

### 3.1 Backgrounds — 14 built, ~26 for the full season

**Format:** 1920×1080 minimum, WebP preferred (JPEG fallback), under 400 KB each.
**Drop into:** `/assets/bg/<name>.webp`
**Wire up:** one line per background in `css/theme.css` — replace the gradient in
`.bg--<name>` with `background-image: url(...)`. No JS changes.

Composition rules for all of them:
- **Empty of people.** Characters are composited on top as portraits.
- **Shot from standing eye height**, slightly back. Never a dramatic angle.
- **Keep the lower third quiet** — the dialogue box covers it.
- **Keep the middle clear** — portraits stand there.
- Overcast, diffuse light. Almost no hard shadows anywhere in this game.

| Name | Scene | Notes |
|---|---|---|
| `dorm-morning` | Ep1 s1, Room 214 | Unmade bed, open laptop, water stain on ceiling shaped like an island |
| `diner` | Ep1 s2, Ep2 s3 | Jacquelin Diner. Window booth. **A half-burned photo behind the counter** — plot-critical, must be visible but not centred |
| `hallway` | Ep1 s3 | Blackwell main hall, lockers, too clean |
| `studio` | Ep1 s4 | Photography studio, prints on a line |
| `quad` | Ep1 s5 | Outdoor tables, bare trees |
| `lighthouse-dusk` | Ep1 s6 | **Hero shot.** Ruins on the cliff, fog off the water, 4:41 PM light dying |
| `rear-steps` | Ep1 s7 | Concrete back steps, one sodium lamp |
| `media-lab` | Ep1 s8, Ep4 | Edit suite, monitors, dark |
| `dorm-night` | Ep1 s9 | Same room as `dorm-morning`, 2 AM, screen-lit |
| `cafeteria` | Ep2 s1 | Long tables, high windows |
| `nexus-voice` | Ep2 s2 | **The warm one.** A dark bedroom lit only by a monitor. The one image in the season that should feel safe |
| `pool-night` | Ep2 s4 | **Hero shot.** Blackwell pool, lights off, water lit from below |
| `jones-house` | Ep2 s5 | Expensive, cold, nothing out of place. No clutter anywhere |
| `jones-landing` | Ep2 s6 | Upstairs landing looking down into a hall. Overheard-from-above framing |

Still to come from Episodes 3–5: Taki's room (clipping wall), records room,
science lab, Gazette office, APD, rear parking lot at night, second-floor
bathroom, Cross Industries office, Olivia's house on the cliffs, Theo's room,
airport departures.

### 3.2 Portraits — 37 characters

**Format:** transparent PNG or WebP, 900×1200, head-and-shoulders, under 250 KB.
**Drop into:** `/assets/portraits/<id>-<expression>.webp` using the ids in
`data/characters.json`.
**Framing:** bust, centred, looking slightly off-camera — never straight at the
player. Bottom edge fades out (the engine masks it, but design for it).
**Lighting:** single soft key, rim light in the character's accent hue on the
left. The current silhouettes already establish this — match it.

Appearance canon for every character is in `characters.json` under `look`, and
rendered on the cast sheet. Full descriptions in `docs/Lore_Bible.pdf`.

**Expressions: collapse to six.** The scripts use free-text `emotion` strings
(Riley alone has 41 distinct ones — `cracking`, `fond_tired`, `abrupt_fear`…).
Those are direction for the writer, not 41 drawings. Map them to six:

| Expression | Covers |
|---|---|
| `neutral` | flat, level, plain, matter_of_fact |
| `warm` | soft, fond, amused, small_smile, gentle |
| `guarded` | careful, closing_off, deflecting, closing, quiet |
| `hurt` | cracking, hollow, shaking, embarrassed, small |
| `sharp` | cold_amused, sneering, dangerous, irritated, performative_cruel |
| `lit` | delighted, ecstatic, screaming, lit_up |

**Priority tiers** (by actual line count across Episodes 1–2):

- **Tier 1 — all six.** Riley Jones (65 lines). She carries the season.
- **Tier 2 — four** (`neutral`, `warm`, `guarded`, plus their signature): Maddie,
  Olivia, Pete, Mason, Linda, Cheryl, Jamie, Marcus, Gerald.
- **Tier 3 — two** (`neutral` + signature): Gina, Brandon, Amber, Elise, Ezra,
  Theo, Richard, Sienna, Kieran, Chase, Zoey, Jake, Rhys, Lila, Luke.
- **Tier 4 — one.** Everyone else, including all of Episodes 3–5's walk-ons.

**Fiz needs no portrait, ever.** He is the player and he is never on screen.

### 3.3 UI and audio

- **Beacon app icons** — 8 apps (Prism, Glimpse, Flicker, Echo, Nexus,
  DeepThread, Aura, ViewGrid), currently single glyphs. 128×128, flat, each in
  its own hue. They should look like a real phone's home screen, not like game
  icons.
- **The eleven frames** — Episode 1's set piece is currently a procedural canvas
  fog render. If real footage exists it should be a **PNG image sequence**
  (`/assets/anomaly/f000.png`…`f119.png`, 640×360), not a video file: HTML5 video
  is not reliably frame-accurate and the whole scene depends on exact stepping.
  The transport, gating and timecode maths don't change.
- **Audio** — none yet. Ambience per scene, no score. **The pool scene plays with
  no music at all** — that's a bible ruling, not an omission.

---

## 4. Screen specs

### Viewport
Background, then portraits (max 3 on stage), then grain, then vignette. The
location slate — `[ Blackwell Academy — Dormitory, Room 214 ]` — sits top-left
behind a thin rust rule, holds 3.2s, fades. It is the Creative Director's field;
never invent one.

### Dialogue box
Bottom-centred, max 900px, near-black at 86% with a blur behind. A 3.5rem
hairline sits on the top edge in the speaker's hue. Speaker name is mono,
uppercase, tracked wide, in that same hue. Text types at 18ms/char with a beat on
punctuation; one click completes the line, the next advances.

**Internal monologue overrides all of it**: no name plate, no hairline, serif
italic, dimmer, slower (26ms/char). The player must never be in doubt about
whether they're hearing Fiz think or someone speak.

### Choices — the important one
This is the game's central mechanic and the easiest thing to ruin.

Choices are Fiz's thoughts before he acts. **They must not look like buttons.**
No borders, no fills, no hover cards, no icons. They sit above the dialogue box,
the world dims behind them, and they surface staggered rather than appearing as a
list.

Two kinds, and the difference between them *is* the mechanic:

- **Spoken** (`"quoted"` in script) — upright sans, quote marks in rust, brighter
  at rest (0.46). It sits still, waiting to be said.
- **Silent** (`[bracketed]`) — serif italic, dimmer at rest (0.32), drifting on a
  slow 7s breathing loop. It behaves like a thought.

Both resolve as you approach — opacity to 1, letter-spacing tightening, a
hairline drawing itself underneath. Unchosen options **sink and blur** rather
than vanish.

Choosing silence has to feel like a decision, not like declining to choose.

### Beacon (the phone)
Slides in from the right, 300–360px. Obsidian body, 22px radius, status bar
showing the scene's in-fiction time. Home is an 8-icon grid with unread badges.
Content gates on story flags — a hallway choice becomes a post on Echo one scene
later. ViewGrid keeps its canon look: **obsidian black and neon cyan**.

### The anomaly viewer
Deliberately looks like an edit suite, not game UI: scrub bar, frame-step
buttons, timecode in amber mono. The player is doing exactly what Fiz is doing.
Do not decorate it. Do not hint at where the anomaly is.

---

## 5. Interaction and motion

**Principle: the interface hesitates.** Nothing snaps. Everything has a moment of
thinking about it first — which is the character.

| Element | Timing | Curve |
|---|---|---|
| Scene / background change | 720ms | `cubic-bezier(.22,.61,.36,1)` |
| Dialogue box, portraits | 340ms | same |
| Hover states | 160ms | same |
| Choice surfacing | 340ms + 220ms stagger per option | same |
| Chosen option holds before resolving | 620ms | — |
| Location slate | 1.1s in, 3.2s hold, 1.4s out | — |

Two motions are **not decoration and must survive any redesign**:

1. **`is_hold`** — enforced silence. The dialogue box recedes to 18% and the
   player cannot click through it. Episode 2's pool scene is built from these.
   A beat you wait out is not a beat you read about.
2. **`is_submerge`** — the viewport goes underwater for exactly the scripted
   duration. Blur, cold shift, caustics, controls disabled. The player spends
   Riley's two seconds, not Fiz's.

Reduced motion: drift, grain and caustics stop; `is_hold` durations stay
(they're narrative, not animation).

---

## 6. Engine constraints

Non-negotiable, from `CLAUDE.md`:

- HTML + CSS + **vanilla JS**. No framework, no build step, no npm, no backend.
- **No external requests of any kind.** Self-host fonts and every asset.
- All state in `localStorage`.
- Backgrounds are swapped by editing one CSS class each. Portraits by dropping
  files into `/assets/portraits`. **Neither requires a JS change** — keep it that
  way.
- Must stay playable on a phone. The Beacon goes full-width under 640px.
- Target under ~6 MB total for a first-episode load; compress accordingly.

---

## 7. Suggested order of work

1. **Portraits, Tier 1 and 2.** Biggest perceived-quality jump per hour. Riley
   first — she's on screen more than everything else combined.
2. **The two hero backgrounds** — `lighthouse-dusk` and `pool-night`. These are
   the season's emotional bookends and they set the palette for everything else.
3. **Remaining Episode 1–2 backgrounds.**
4. **Beacon app icons.**
5. **Type pass** — real display and mono faces.
6. **Ambience.**

Everything before step 6 is replaceable art dropped onto a finished engine. None
of it needs code.
