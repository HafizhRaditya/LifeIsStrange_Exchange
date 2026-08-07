import { $, el, clear } from "./util/dom.js";
import { state } from "./engine/state.js";
import { loadCharacters, loadBeacon, loadEpisode } from "./engine/loader.js";
import { buildIndex } from "./engine/cast.js";
import { SceneRunner } from "./engine/scene-runner.js";
import { Viewport } from "./ui/viewport.js";
import { Dialogue } from "./ui/dialogue.js";
import { Choices } from "./ui/choices.js";
import { Beacon } from "./ui/beacon.js";
import { Anomaly } from "./ui/anomaly.js";
import { Journal } from "./ui/journal.js";

const SEASON = [
  { id: "ep1", num: "01", title: "Blast For The Future" },
  { id: "ep2", num: "02", title: "Good Times" },
  { id: "ep3", num: "03", title: "The Place Beyond Us" },
  { id: "ep4", num: "04", title: "Rendered" },
  { id: "ep5", num: "05", title: "Lost and Found" }
];

const DIR_KEY = "lis_exchange_dir";

const menu = $("#menu");
const note = $("#menu-note");
const stage = $("#stage");

let ui;
let runner;
let episode;

boot();

async function boot() {
  restoreDirection();

  // Opened straight off the filesystem: modules and fetch are both blocked by
  // the browser here, so nothing would happen. Say so plainly.
  if (location.protocol === "file:") {
    return fail(
      "This page was opened directly from a folder.",
      "The game loads its script from JSON, which browsers block over file://. " +
      "Run start.bat instead — it serves the game locally and opens it for you."
    );
  }

  let characters, beaconData;
  try {
    [characters, beaconData] = await Promise.all([loadCharacters(), loadBeacon()]);
  } catch (err) {
    console.error(err);
    return fail("The story files didn't load.",
      `Serving from ${location.origin}, but data/characters.json could not be read.`);
  }

  buildIndex(characters);

  ui = {
    viewport: new Viewport(characters.cast),
    dialogue: new Dialogue(),
    choices: new Choices(),
    beacon: new Beacon(beaconData, characters.cast),
    anomaly: new Anomaly(),
    journal: new Journal(characters.cast)
  };
  ui.onStateChange = () => ui.beacon.refreshBadge();
  ui.onSceneComplete = (scene) => advanceScene(scene);

  wireInput();
  renderEpisodes();
}

/* ===== Title ===== */

function renderEpisodes() {
  const list = $("#episode-list");
  clear(list);

  const saved = state.hasSave() && state.load() ? state.data.position : null;

  for (const ep of SEASON) {
    const built = ep.id === "ep1" || ep.id === "ep2";
    const progress = state.episodeState(ep.id);
    const isResume = saved?.episode === ep.id && progress;

    const label = !built ? "Not yet written"
      : isResume ? "Continue"
      : progress ? "Replay"
      : "Begin";

    const cls = !built ? "episode episode--locked"
      : isResume ? "episode episode--resume"
      : "episode episode--ready";

    const row = el("button", cls);
    row.type = "button";
    row.disabled = !built;

    const body = el("span", "episode__body");
    body.append(el("span", "episode__title", ep.title), el("span", "episode__state", label));
    row.append(el("span", "episode__num", ep.num), body);

    if (built) {
      row.addEventListener("click", () => {
        if (!isResume) {
          state.reset();
          state.setPosition(ep.id, null, 0);
        }
        start({ resume: Boolean(isResume) });
      });
    }
    list.append(row);
  }

  $("#title-save").textContent = state.hasSave()
    ? `Save · Local · ${state.data.choices.length} choices`
    : "Save · Local · new";
}

async function start({ resume }) {
  menu.classList.add("is-gone");

  const pos = state.data.position;
  episode = await loadEpisode(pos.episode);

  const scene = episode.scenes.find((s) => s.scene_id === pos.scene) ?? episode.scenes[0];
  await playScene(scene, resume ? pos.node : 0, !resume);
}

async function playScene(scene, from, showSlate) {
  const index = episode.scenes.findIndex((s) => s.scene_id === scene.scene_id);

  ui.viewport.clearStage();
  ui.viewport.setBackground(scene.background);
  ui.viewport.setScene(scene, episode.episode, Math.max(0, index));
  ui.beacon.setClock(scene.meta?.time);
  ui.beacon.refreshBadge();

  state.reachEpisode(`ep${episode.episode}`, scene.scene_id);

  runner?.stop();
  runner = new SceneRunner(scene, ui);
  runner.seekTo(from);

  if (showSlate) await ui.viewport.showSlate(scene);
  await runner.run();
}

/** Scenes are linear within an episode; branching lives inside choice blocks. */
async function advanceScene(finished) {
  const i = episode.scenes.findIndex((s) => s.scene_id === finished.scene_id);
  const next = episode.scenes[i + 1];

  if (next) {
    state.setPosition(state.data.position.episode, next.scene_id, 0);
    await playScene(next, 0, true);
    return;
  }

  await ui.dialogue.think(`(End of Episode ${episode.episode} — ${episode.episode_title})`);

  if (!episode.next_episode) {
    await ui.dialogue.think("(That's everything written so far.)");
    backToTitle();
    return;
  }

  const nextId = episode.next_episode;
  episode = await loadEpisode(nextId);
  const opening = episode.scenes[0];
  state.setPosition(nextId, opening.scene_id, 0);
  await playScene(opening, 0, true);
}

function backToTitle() {
  runner?.stop();
  ui.dialogue.hide();
  renderEpisodes();
  menu.classList.remove("is-gone");
}

/* ===== Direction switcher ===== */

function restoreDirection() {
  let dir = "C";
  try { dir = localStorage.getItem(DIR_KEY) || "C"; } catch { /* storage off */ }
  setDirection(dir);

  for (const btn of document.querySelectorAll(".title__dir")) {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      setDirection(btn.dataset.dir);
    });
  }
}

function setDirection(dir) {
  stage.dataset.dir = dir;
  try { localStorage.setItem(DIR_KEY, dir); } catch { /* storage off */ }
  for (const btn of document.querySelectorAll(".title__dir")) {
    btn.classList.toggle("is-on", btn.dataset.dir === dir);
  }
}

/* ===== Input ===== */

function wireInput() {
  stage.addEventListener("click", () => {
    if (ui.anomaly.isOpen || ui.choices.isOpen || ui.journal.isOpen) return;
    if (ui.beacon.open) { ui.beacon.setOpen(false); return; }
    ui.dialogue.handleInput();
  });

  $("#journal-toggle").addEventListener("click", (e) => {
    e.stopPropagation();
    ui.journal.isOpen ? ui.journal.close() : ui.journal.open();
  });

  document.addEventListener("keydown", (event) => {
    if (!menu.classList.contains("is-gone")) return;

    if (ui.anomaly.isOpen) {
      if (ui.anomaly.handleKey(event.key)) event.preventDefault();
      return;
    }

    if (event.key === "Escape") {
      ui.journal.close();
      ui.beacon.setOpen(false);
      return;
    }

    if (event.key === "b" || event.key === "B") { ui.beacon.setOpen(!ui.beacon.open); return; }
    if (event.key === "j" || event.key === "J") {
      ui.journal.isOpen ? ui.journal.close() : ui.journal.open();
      return;
    }

    if (event.key === " " || event.key === "Enter") {
      if (ui.choices.isOpen || ui.beacon.open || ui.journal.isOpen) return;
      event.preventDefault();
      ui.dialogue.handleInput();
    }
  });
}

/** Replaces the episode list with something the player can act on. */
function fail(headline, detail) {
  clear($("#episode-list"));
  note.textContent = "";
  note.append(
    Object.assign(document.createElement("strong"), { textContent: headline }),
    document.createTextNode(detail)
  );
}
