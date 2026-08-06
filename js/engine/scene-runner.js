import { state } from "./state.js";
import { idFor } from "./cast.js";

/**
 * Walks a scene's `dialogue_sequence`, in the Script Bible's authoring format.
 *
 * Entry shapes:
 *   { speaker, text, emotion }                  — an NPC line
 *   { speaker: "Fiz", text, is_internal_thought } — Fiz's inner voice
 *   { is_choice: true, choices: [...] }          — a choice block
 *   { is_anomaly: true, anomaly: "<id>" }        — hands the viewport to a set piece
 *
 * A choice may carry a `responses` map keyed by consequence_id. Those branch
 * lines play immediately after the choice, then the sequence reconverges — that
 * is the whole track-and-converge model.
 */
export class SceneRunner {
  constructor(scene, ui) {
    this.scene = scene;
    this.ui = ui;
    this.seq = scene.dialogue_sequence;
    this.cursor = 0;
    this.stopped = false;
  }

  seekTo(i) {
    this.cursor = Number.isInteger(i) && i < this.seq.length ? i : 0;
  }

  stop() {
    this.stopped = true;
  }

  async run() {
    while (!this.stopped && this.cursor < this.seq.length) {
      state.setPosition(state.data.position.episode, this.scene.scene_id, this.cursor);
      await this.perform(this.seq[this.cursor]);
      if (this.stopped) return;
      this.cursor += 1;
    }
    if (!this.stopped) await this.ui.onSceneComplete?.(this.scene);
  }

  async perform(entry) {
    if (entry.is_anomaly) {
      await this.ui.anomaly.play(entry.anomaly);
      return;
    }

    if (entry.is_choice) {
      await this.runChoice(entry);
      return;
    }

    const speakerId = idFor(entry.speaker);

    if (entry.is_internal_thought) {
      await this.ui.dialogue.think(entry.text);
      return;
    }

    await this.ui.viewport.focus(speakerId);
    await this.ui.dialogue.say(speakerId, entry.text, entry.emotion);
  }

  async runChoice(entry) {
    const chosen = await this.ui.choices.present(entry.choices);

    // consequence ids are unique across the season and safe as flag keys
    if (chosen.consequence_id) {
      state.setFlags({ [chosen.consequence_id]: true });
      state.recordChoice(this.scene.scene_id, chosen.consequence_id);
    }

    const change = chosen.relationship_change;
    if (change?.character) {
      const id = idFor(change.character);
      if (id) state.adjustRel({ [id]: change.value });
    }

    this.ui.onStateChange?.();

    for (const line of entry.responses?.[chosen.consequence_id] ?? []) {
      if (this.stopped) return;
      await this.perform(line);
    }
  }
}
