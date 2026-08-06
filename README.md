# Life Is Strange: Exchange

An interactive narrative game set in Arcadia Bay, Oregon — November 2023, ten years
after the storm. No powers, no supernatural. Just a quiet exchange student with a
camera and a town that would rather not be asked.

Front-end only: HTML, CSS, vanilla JavaScript. No framework, no build step, no
dependencies, no backend. Save state lives entirely in `localStorage`.

## Running it

**Double-click `start.bat`.** That's it — it serves the game locally and opens
your browser at it. Leave the black window open while you play.

**Do not open `index.html` directly.** Nothing will happen when you click New
Game. The game loads its script from JSON, and every browser blocks that over
`file://` for security. It needs a real local server, which is all `start.bat`
does. (If you do open it directly, the title screen now tells you so instead of
failing silently.)

Prefer to do it yourself:

```bash
python -m http.server 5173
```

In VS Code, the Live Server extension works too. Deploys to GitHub Pages as-is.

## Checking the writing

```bash
python tools/validate.py
```

Enforces the rules in `CLAUDE.md` across every episode: no scene ending on a
choice block, no Fiz line outside a choice, every speaker and relationship target
resolving to a real character, internal thoughts parenthesised, every branch
having written follow-up. Run it after editing any episode JSON.

## Controls

| Input | Action |
|---|---|
| Click / `Space` / `Enter` | Advance dialogue (once to finish the line, again to continue) |
| `B` | Open or close the Beacon |
| `Esc` | Close the Beacon |

## Layout

```
index.html
css/     reset · theme · layout · dialogue · thoughts · beacon
js/
  engine/  state · loader · scene-runner
  ui/      viewport · dialogue · thoughts · beacon
  util/    dom
data/    characters.json · beacon.json · episodes/*.json
assets/  bg · portraits · audio
```

**`/data` holds no logic. `/js` holds no prose.** Dialogue is editable without
touching code, and story diffs stay readable.

## The four pillars

- **Viewport** — background layer, portrait layer, film grain, vignette, and the
  `[ ]` place-and-time slate.
- **Dialogue engine** — dark box, typewriter reveal, per-speaker accent hue.
  Narration renders in a distinct serif italic voice.
- **Silent Empathy** — choices are Fiz's internal thoughts, rendered as drifting
  low-opacity text that resolves as you approach it. Deliberately not buttons.
- **Beacon** — the slide-out phone, carrying the in-world apps: Nexus, Echo,
  Prism, ViewGrid, Glimpse, Flicker, DeepThread, Aura.

## Writing rules

These are engine constraints, not style preferences.

1. **Fiz never speaks.** He has no authored dialogue anywhere, ever. He is the
   player. Choices are thoughts; they resolve into narrated action or silence.
2. **Narration is the `()` register** — action and situation only. Location, time
   and weather belong to `scene.meta`, the Creative Director's `[ ]` field.
3. **No real-world brands.** The in-world apps exist for exactly this reason.
   Real pop culture (The Strokes, Taxi Driver) is canon, as in the original game.
4. **Rated M.** NPCs swear. Fiz, having no lines, does not.
5. **No supernatural.** Anomalies stay unexplained. They are atmosphere and
   residue, never mechanics.

## Choice model

Track-and-converge. Choices set flags and move relationship scores (clamped
−10..10); scenes reconverge. Consequences surface as changed dialogue, altered
reactions, and Beacon content gated behind flags — a hallway choice becomes a
post on Echo one scene later.

## Save format

One key, `lis_exchange_save`, carrying a `schemaVersion`. Add a migration in
`js/engine/state.js` when the shape changes; never silently wipe a playtest.

## Status

- **Episode 1 — Blast For The Future.** Complete. Nine scenes, fifteen choice
  blocks, every branch written. Ends on the frame-stepper set piece.
- **Episode 2 — Good Times.** Complete. Six scenes, seventeen choice blocks. The
  pool scene's silences are real enforced pauses and Riley's two seconds under
  are two seconds the player spends.
- **Episodes 3–5.** Scene maps in `docs/`, awaiting expansion to dialogue.
