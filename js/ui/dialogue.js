import { $ } from "../util/dom.js";
import { getCast } from "../engine/cast.js";

const SPEED = 18;         // ms per character
const THOUGHT_SPEED = 26; // the inner voice runs slower — it's thinking, not talking
const PUNCT_PAUSE = 150;

export class Dialogue {
  constructor() {
    this.root = $("#dialogue");
    this.speakerEl = $("#speaker");
    this.actionEl = $("#action");
    this.lineEl = $("#line");

    this.typing = false;
    this.token = 0;
    this.resolveAdvance = null;
  }

  /**
   * An NPC line. Fiz never routes through here — his spoken lines exist only
   * inside choices, chosen by the player.
   */
  say(speakerId, text, emotion) {
    const person = getCast()[speakerId] ?? { name: speakerId, hue: 20 };

    this.root.classList.remove("is-thought");
    this.root.style.setProperty("--speaker-hue", person.hue ?? 20);
    this.root.dataset.emotion = emotion ?? "";

    this.speakerEl.textContent = person.name;
    this.speakerEl.hidden = false;
    this.actionEl.hidden = true;

    return this.render(text, SPEED);
  }

  /**
   * Fiz's internal monologue. Carries most of the characterisation and all of
   * the unreliable narration, so it gets its own voice — no speaker plate, no
   * accent rule, slower reveal.
   */
  think(text) {
    this.root.classList.add("is-thought");
    this.root.dataset.emotion = "";
    this.speakerEl.hidden = true;
    this.actionEl.hidden = true;
    return this.render(text, THOUGHT_SPEED);
  }

  async render(text, speed) {
    this.root.hidden = false;
    this.root.classList.remove("is-ready");
    this.text = text;

    const run = ++this.token;
    this.typing = true;
    this.lineEl.textContent = "";

    for (let i = 0; i < text.length; i++) {
      if (run !== this.token) return this.waitForAdvance(); // player skipped ahead
      this.lineEl.textContent = text.slice(0, i + 1);
      await sleep(speed + (".?!…".includes(text[i]) ? PUNCT_PAUSE : 0));
    }

    this.finish();
    return this.waitForAdvance();
  }

  finish() {
    this.token++;
    this.typing = false;
    this.lineEl.textContent = this.text;
    this.root.classList.add("is-ready");
  }

  waitForAdvance() {
    return new Promise((resolve) => {
      this.resolveAdvance = resolve;
    });
  }

  /** One input completes the line; the next advances. */
  handleInput() {
    if (this.typing) {
      this.finish();
      return;
    }
    const resolve = this.resolveAdvance;
    this.resolveAdvance = null;
    resolve?.();
  }

  /**
   * An enforced silence. The box clears and the player cannot click through it.
   * Used where the script asks for a long pause to actually be long — a beat the
   * player waits out is not the same as a beat they read about.
   */
  async hold(seconds) {
    this.token++;              // cancel any in-flight typing
    this.typing = false;
    this.resolveAdvance = null;
    this.root.classList.remove("is-ready");
    this.root.classList.add("is-holding");
    this.lineEl.textContent = "";
    this.speakerEl.hidden = true;
    this.actionEl.hidden = true;

    await sleep(seconds * 1000);
    this.root.classList.remove("is-holding");
  }

  hide() {
    this.root.hidden = true;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
