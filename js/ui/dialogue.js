import { $, el } from "../util/dom.js";
import { getCast } from "../engine/cast.js";

const SPEED = 18;         // ms per character
const THOUGHT_SPEED = 26; // the inner voice runs slower — it's thinking, not talking
const PUNCT_PAUSE = 150;

export class Dialogue {
  constructor() {
    this.root = $("#dialogue");
    this.speakerEl = $("#speaker");
    this.lineEl = $("#line");
    this.holdEl = $("#hold");
    this.stage = $("#stage");

    this.caret = el("span", "dialogue__caret", "▌");
    this.typing = false;
    this.token = 0;
    this.resolveAdvance = null;

    $("#advance").addEventListener("click", (e) => {
      e.stopPropagation();
      this.handleInput();
    });
  }

  /** An NPC line. Fiz never routes through here — his lines live inside choices. */
  say(speakerId, text, emotion) {
    const person = getCast()[speakerId] ?? { name: speakerId, hue: 20 };

    this.root.className = "dialogue";
    this.root.style.setProperty("--speaker-hue", person.hue ?? 20);
    this.root.dataset.emotion = emotion ?? "";
    this.speakerEl.textContent = person.name;

    this.last = { speakerId, text, emotion, thought: false };
    return this.render(text, SPEED);
  }

  /** Fiz's internal monologue — its own voice, no speaker plate. */
  think(text) {
    this.root.className = "dialogue is-thought";
    this.root.dataset.emotion = "";
    this.last = { speakerId: null, text, thought: true };
    return this.render(text, THOUGHT_SPEED);
  }

  /**
   * The other voice. Not a person in the room and never given one — no portrait,
   * no name, no accent hue. It reads like Fiz's own thoughts wearing someone
   * else's grammar, which is exactly what it is.
   */
  other(text) {
    this.root.className = "dialogue is-other";
    this.root.dataset.emotion = "";
    this.speakerEl.textContent = "???";
    this.last = { speakerId: null, text, thought: true };
    return this.render(text, THOUGHT_SPEED);
  }

  /** A held shot with no dialogue — the script's [ bracketed ] direction. */
  direct(text) {
    this.root.className = "dialogue is-direction";
    this.root.dataset.emotion = "";
    this.last = { speakerId: null, text, thought: false };
    return this.render(text, SPEED);
  }

  /** What the player was just looking at — the choice screen holds it on the left. */
  lastBeat() {
    return this.last ?? null;
  }

  async render(text, speed) {
    this.root.hidden = false;
    this.root.classList.remove("is-ready");

    const run = ++this.token;
    this.typing = true;
    this.text = text;
    this.lineEl.textContent = "";
    this.lineEl.append(this.caret);

    for (let i = 0; i < text.length; i++) {
      if (run !== this.token) return this.waitForAdvance();
      this.lineEl.textContent = text.slice(0, i + 1);
      this.lineEl.append(this.caret);
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
    return new Promise((resolve) => { this.resolveAdvance = resolve; });
  }

  /** One input completes the line; the next advances. */
  handleInput() {
    if (this.holding) return;
    if (this.typing) { this.finish(); return; }
    const resolve = this.resolveAdvance;
    this.resolveAdvance = null;
    resolve?.();
  }

  /**
   * An enforced silence. The plate recedes, a mono label sits in the middle of
   * the frame, and the player cannot click through it. A beat you wait out is
   * not the same as a beat you read about.
   */
  async hold(seconds, label = "holding") {
    this.token++;
    this.typing = false;
    this.holding = true;
    this.resolveAdvance = null;

    this.root.classList.remove("is-ready");
    this.root.classList.add("is-holding");
    this.stage.classList.add("is-holding");
    this.lineEl.textContent = "";
    $("#hold-label").textContent = label;
    this.holdEl.hidden = false;

    await sleep(seconds * 1000);

    this.holdEl.hidden = true;
    this.root.classList.remove("is-holding");
    this.stage.classList.remove("is-holding");
    this.holding = false;
  }

  hide() { this.root.hidden = true; }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
