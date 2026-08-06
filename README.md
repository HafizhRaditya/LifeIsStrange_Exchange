# Life Is Strange: Exchange

An interactive narrative game set in Arcadia Bay, Oregon — November 2023, ten years
after the storm. No powers, no supernatural. Just a quiet exchange student with a
camera and a town that would rather not be asked.

Front-end only: HTML, CSS, vanilla JavaScript. No framework, no build step, no
dependencies, no backend. Save state lives entirely in `localStorage`.

## Running it

The game loads its narrative from JSON via `fetch`, and uses ES modules. Both
require a real HTTP origin — **opening `index.html` from the filesystem will fail
with CORS errors.** That's the browser, not a bug.

Any static server works:

```bash
python -m http.server 5173
```

Then open `http://localhost:5173`. In VS Code, the Live Server extension does the
same thing with a click. Deploys to GitHub Pages as-is.

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

Vertical slice: Episode 1, Scene 1 — all four pillars live, both thought choices
wired end to end with visible social fallout.
