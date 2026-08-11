import { state } from "./state.js";
import { idFor } from "./cast.js";
import { evaluate } from "./conditions.js";

/**
 * Walks a scene in the Script Bible's authoring format.
 *
 * Entry shapes:
 *   { speaker, text, emotion }                     — an NPC line
 *   { speaker: "Fiz", text, is_internal_thought }  — his inner voice
 *   { speaker: "???", speaker_id: "dark_side" }    — the other voice
 *   { speaker: "NARRATION", is_stage_direction }   — a held shot, no dialogue
 *   { is_choice, choices, timed?, timer_seconds? } — a choice block
 *   { is_anomaly } { is_hold } { is_submerge }     — set pieces
 *
 * Any entry may carry `requires` / `unless` / `sets_flag`, and `branch_variant`
 * to swap its text for whichever ending flag is set.
 *
 * Exploration scenes run their hub first, then `post_exploration_sequence`.
 */
export class SceneRunner {
  constructor(scene, ui) {
    this.scene = scene;
    this.ui = ui;
    this.phase = scene.is_exploration && !scene.dialogue_sequence?.length ? "hub" : "intro";
    this.seq = scene.dialogue_sequence ?? [];
    this.cursor = 0;
    this.stopped = false;
  }

  seekTo(i) {
    this.cursor = Number.isInteger(i) && i < this.seq.length ? i : 0;
  }

  stop() { this.stopped = true; }

  async run() {
    if (this.phase === "intro") {
      await this.walk(this.seq);
      if (this.stopped) return;
      this.phase = "hub";
    }

    if (this.scene.is_exploration && this.scene.exploration) {
      await this.ui.exploration.run(this.scene.exploration, this.ui.dialogue);
      if (this.stopped) return;
      this.seq = this.scene.post_exploration_sequence ?? [];
      this.cursor = 0;
      await this.walk(this.seq);
    }

    if (!this.stopped) await this.ui.onSceneComplete?.(this.scene);
  }

  async walk(seq) {
    while (!this.stopped && this.cursor < seq.length) {
      state.setPosition(state.data.position.episode, this.scene.scene_id, this.cursor);
      const entry = seq[this.cursor];
      if (this.shouldPlay(entry)) await this.perform(entry);
      if (this.stopped) return;
      this.cursor += 1;
    }
  }

  /**
   * Conditional lines. `requires` plays only if the flag is set, `unless` only
   * if it isn't — both accept arrays. This is where track-and-converge pays off:
   * an Episode 1 choice changes an Episode 4 line without forking the graph.
   */
  shouldPlay(entry) {
    const all = (v) => (Array.isArray(v) ? v : [v]);
    if (entry.requires && !all(entry.requires).every((f) => state.flag(f))) return false;
    if (entry.unless && all(entry.unless).some((f) => state.flag(f))) return false;
    if (entry.requires_flag && !evaluate(entry.requires_flag)) return false;
    return true;
  }

  /** `branch_variant` maps an ending flag to replacement text for this line. */
  textFor(entry) {
    const variants = entry.branch_variant;
    if (variants) {
      for (const [flag, text] of Object.entries(variants)) {
        if (state.flag(flag)) return text;
      }
    }
    return entry.text;
  }

  async perform(entry) {
    if (entry.sets_flag) state.setFlags({ [entry.sets_flag]: true });

    if (entry.is_anomaly)  return this.ui.anomaly.play(entry.anomaly);
    if (entry.is_hold)     return this.ui.dialogue.hold(entry.seconds ?? 3, entry.label);
    if (entry.is_submerge) return this.ui.viewport.submerge(entry.seconds ?? 2, this.ui.ambience);
    if (entry.is_choice)   return this.runChoice(entry);

    const text = this.textFor(entry);

    // A held shot with no dialogue in it — the script's [ bracketed ] direction.
    if (entry.is_stage_direction) {
      return this.ui.dialogue.direct(String(text).replace(/^\s*\[|\]\s*$/g, ""));
    }

    if (entry.is_internal_thought) return this.ui.dialogue.think(text);

    // The other voice gets no portrait and no name plate of its own.
    if (entry.speaker_id === "dark_side") return this.ui.dialogue.other(text);

    const speakerId = idFor(entry.speaker);
    state.meetCast(speakerId);
    await this.ui.viewport.focus(speakerId);
    return this.ui.dialogue.say(speakerId, text, entry.emotion);
  }

  async runChoice(entry) {
    // the choice screen holds the beat that put Fiz here, so the player can
    // still see what they're answering
    const options = entry.choices.filter((c) => !c.requires_flag || evaluate(c.requires_flag));

    const chosen = await this.ui.choices.present(options, {
      location: this.scene.location,
      beat: this.ui.dialogue.lastBeat(),
      timer: entry.timed ? entry.timer_seconds : null,
      weight: entry.is_final_choice ? "final" : entry.is_episode_defining ? "defining"
            : entry.is_key_choice ? "key" : null
    });

    const change = chosen.relationship_change;
    const who = change?.character ? idFor(change.character) : null;

    // consequence ids are unique across the season and safe as flag keys
    if (chosen.consequence_id) {
      state.setFlags({ [chosen.consequence_id]: true });
      state.recordChoice({
        scene: this.scene.scene_id,
        episode: this.scene.episode,
        chapter: this.scene.chapter,
        id: chosen.consequence_id,
        text: chosen.choice_text,
        who
      });
    }
    if (chosen.sets_flag) state.setFlags({ [chosen.sets_flag]: true });
    if (who) state.adjustRel({ [who]: change.value });

    this.ui.onStateChange?.();

    for (const line of entry.responses?.[chosen.consequence_id] ?? []) {
      if (this.stopped) return;
      if (this.shouldPlay(line)) await this.perform(line);
    }
  }
}
