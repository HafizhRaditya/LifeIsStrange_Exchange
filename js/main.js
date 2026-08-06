import { $ } from "./util/dom.js";
import { state } from "./engine/state.js";
import { loadCharacters, loadBeacon, loadEpisode } from "./engine/loader.js";
import { buildIndex } from "./engine/cast.js";
import { SceneRunner } from "./engine/scene-runner.js";
import { Viewport } from "./ui/viewport.js";
import { Dialogue } from "./ui/dialogue.js";
import { Choices } from "./ui/choices.js";
import { Beacon } from "./ui/beacon.js";
import { Anomaly } from "./ui/anomaly.js";

const menu = $("#menu");
const note = $("#menu-note");

let ui;
let runner;
let episode;

boot();

async function boot() {
  // Opened straight off the filesystem: modules and fetch are both blocked by
  // the browser here, so nothing would happen when New Game is clicked. Say so
  // plainly instead of failing silently.
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
    return fail(
      "The story files didn't load.",
      `Serving from ${location.origin}, but data/characters.json could not be read. ` +
      "Check the console for the failing path."
    );
  }

  buildIndex(characters);

  ui = {
    viewport: new Viewport(characters.cast),
    dialogue: new Dialogue(),
    choices: new Choices(),
    beacon: new Beacon(beaconData, characters.cast),
    anomaly: new Anomaly()
  };
  ui.onStateChange = () => ui.beacon.refreshBadge();
  ui.onSceneComplete = (scene) => advanceScene(scene);

  wireInput();

  if (state.hasSave()) {
    $("#btn-continue").hidden = false;
    $("#btn-continue").addEventListener("click", () => {
      state.load();
      start({ resume: true });
    });
  }

  $("#btn-new").addEventListener("click", () => {
    state.reset();
    start({ resume: false });
  });
}

async function start({ resume }) {
  menu.classList.add("is-gone");

  const pos = state.data.position;
  episode = await loadEpisode(pos.episode);

  const scene = episode.scenes.find((s) => s.scene_id === pos.scene) ?? episode.scenes[0];
  await playScene(scene, resume ? pos.node : 0, !resume);
}

async function playScene(scene, from, showSlate) {
  ui.viewport.clearStage();
  ui.viewport.setBackground(scene.background);
  ui.beacon.setClock(scene.meta?.time);
  ui.beacon.refreshBadge();

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
    await ui.dialogue.think("(End of Season 1.)");
    return;
  }

  const nextId = episode.next_episode;
  episode = await loadEpisode(nextId);

  const opening = episode.scenes[0];
  state.setPosition(nextId, opening.scene_id, 0);
  await playScene(opening, 0, true);
}

/** Replaces the menu buttons with an explanation the player can act on. */
function fail(headline, detail) {
  $("#btn-new").hidden = true;
  $("#btn-continue").hidden = true;
  note.classList.add("menu__note--error");
  note.textContent = "";
  note.append(
    Object.assign(document.createElement("strong"), { textContent: headline }),
    document.createElement("br"),
    document.createTextNode(detail)
  );
}

function wireInput() {
  $("#stage").addEventListener("click", () => {
    if (ui.anomaly.isOpen || ui.choices.isOpen) return;
    if (ui.beacon.open) {
      ui.beacon.setOpen(false);
      return;
    }
    ui.dialogue.handleInput();
  });

  document.addEventListener("keydown", (event) => {
    if (!menu.classList.contains("is-gone")) return;

    if (ui.anomaly.isOpen) {
      if (ui.anomaly.handleKey(event.key)) event.preventDefault();
      return;
    }

    if (event.key === "Escape") {
      ui.beacon.setOpen(false);
      return;
    }

    if (event.key === "b" || event.key === "B") {
      ui.beacon.setOpen(!ui.beacon.open);
      return;
    }

    if (event.key === " " || event.key === "Enter") {
      if (ui.choices.isOpen || ui.beacon.open) return;
      event.preventDefault();
      ui.dialogue.handleInput();
    }
  });
}
