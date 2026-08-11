import { $, el } from "../util/dom.js";
import { getCast } from "../engine/cast.js";

const DEFAULT_SPEED = 18;  // ms per character
const PUNCT_PAUSE = 150;
const SPEED_KEY = "lis_exchange_speed";

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

    this.speed = DEFAULT_SPEED;
    try {
      const saved = Number(localStorage.getItem(SPEED_KEY));
      if (Number.isFinite(saved) && saved >= 0) this.speed = saved;
    } catch { /* storage off — default is fine */ }

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
    return this.render(text, this.speed);
  }

  /** Fiz's internal monologue — its own voice, no speaker plate. */
  think(text) {
    this.root.className = "dialogue is-thought";
    this.root.dataset.emotion = "";
    this.last = { speakerId: null, text, thought: true };
    return this.render(text, this.thoughtSpeed);
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
    return this.render(text, this.thoughtSpeed);
  }

  /** A held shot with no dialogue — the script's [ bracketed ] direction. */
  direct(text) {
    this.root.className = "dialogue is-direction";
    this.root.dataset.emotion = "";
    this.last = { speakerId: null, text, thought: false };
    return this.render(text, this.speed);
  }

  /** What the player was just looking at — the choice screen holds it on the left. */
  lastBeat() {
    return this.last ?? null;
  }

  /** 0 means no typewriter at all; the inner voice always runs a touch slower. */
  setSpeed(ms) {
    this.speed = Math.max(0, ms);
    try { localStorage.setItem(SPEED_KEY, String(this.speed)); } catch { /* storage off */ }
  }

  get thoughtSpeed() {
    return this.speed === 0 ? 0 : Math.round(this.speed * 1.45);
  }

  async render(text, speed) {
    this.root.hidden = false;
    this.root.classList.remove("is-ready");

    const run = ++this.token;
    this.typing = true;
    this.text = text;

    // Speed 0 means instant, and it has to be genuinely instant: even a 0ms
    // sleep yields a macrotask per character, and the punctuation beat would
    // still fire, so a long line took most of a second. Skip the loop entirely.
    if (speed === 0) {
      this.finish();
      return this.waitForAdvance();
    }

    // the beat after a full stop scales with the speed, so fast text isn't
    // dominated by pauses
    const beat = Math.round(PUNCT_PAUSE * (speed / DEFAULT_SPEED));

    // When each character is due, in ms from the start of the line. Precomputing
    // the schedule lets the reveal be driven by elapsed time rather than by a
    // sleep per character — which matters because background tabs clamp timers
    // to ~1s. Tab away mid-line and come back and it catches up to where it
    // should be, instead of making you sit through the backlog.
    const due = new Array(text.length);
    let at = 0;
    for (let i = 0; i < text.length; i++) {
      at += speed + (".?!…".includes(text[i]) ? beat : 0);
      due[i] = at;
    }

    this.lineEl.textContent = "";
    this.lineEl.append(this.caret);

    const started = performance.now();
    let shown = 0;

    while (shown < text.length) {
      if (run !== this.token) return this.waitForAdvance();

      const elapsed = performance.now() - started;
      let next = shown;
      while (next < text.length && due[next] <= elapsed) next++;

      if (next !== shown) {
        shown = next;
        this.lineEl.textContent = text.slice(0, shown);
        this.lineEl.append(this.caret);
      }

      if (shown < text.length) await sleep(Math.min(due[shown] - elapsed, 60));
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
