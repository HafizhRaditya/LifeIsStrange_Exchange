import { $, el, clear, wait, flush } from "../util/dom.js";
import { getCast } from "../engine/cast.js";

/**
 * Silent Empathy.
 *
 * A full-frame takeover: the world stops, the line that put Fiz here is held on
 * the left, and what he could do sits on the right. He is standing there
 * deciding, and so is the player.
 *
 * The script marks the two kinds in the text itself — "quoted" is spoken aloud,
 * [bracketed] is an action or a pointed silence. The contrast between them IS
 * the mechanic, so they must never look alike, and neither may read as a button.
 */

const SPOKEN = /^\s*["“]/;

export class Choices {
  constructor() {
    this.root = $("#choices");
    this.stage = $("#stage");
    this.list = $("#choice-list");
  }

  present(options, context = {}) {
    return new Promise((resolve) => {
      this.paint(context);
      clear(this.list);

      this.root.hidden = false;
      this.root.dataset.weight = context.weight ?? "";
      this.stage.classList.add("is-choosing");
      this.settle(context);

      const nodes = options.map((option) => {
        const spoken = SPOKEN.test(option.choice_text);
        const node = el("button", `choice ${spoken ? "choice--spoken" : "choice--silent"}`);
        node.type = "button";

        const text = el("span", "choice__text", strip(option.choice_text));
        node.append(text, el("span", "choice__rule"));

        node.addEventListener("click", (event) => {
          event.stopPropagation();
          this.choose(nodes, node, option, resolve);
        });

        this.list.append(node);
        return node;
      });

      // surfaced with a stagger, not dealt like a hand of cards
      nodes.forEach((node, i) => {
        node.style.transitionDelay = `${i * 220}ms`;
        flush(node);
        node.classList.add("is-surfaced");
      });

      // Four choices in the season are timed. Running out is a decision too —
      // it picks the last option, which is always the one where Fiz does nothing.
      if (context.timer) {
        this.startTimer(context.timer, () => {
          if (!this.isOpen) return;
          const fallback = nodes[nodes.length - 1];
          this.choose(nodes, fallback, options[options.length - 1], resolve);
        });
      }
    });
  }

  /** Prompt line and weight marker — a key choice should feel heavier. */
  settle({ weight, timer }) {
    const prompt = $(".choices__prompt");
    prompt.textContent =
      weight === "final"    ? "There is no third option" :
      weight === "defining" ? "This one you don't get back" :
      weight === "key"      ? "This one matters" :
      timer                 ? "Now" : "You say nothing yet";
  }

  startTimer(seconds, onExpire) {
    this.clearTimer();
    const bar = el("div", "choices__timer");
    const fill = el("div", "choices__timer-fill");
    bar.append(fill);
    this.root.append(bar);
    this.timerEl = bar;

    fill.style.transition = `transform ${seconds}s linear`;
    flush(fill);
    fill.style.transform = "scaleX(0)";

    this.timer = setTimeout(onExpire, seconds * 1000);
  }

  clearTimer() {
    clearTimeout(this.timer);
    this.timer = null;
    this.timerEl?.remove();
    this.timerEl = null;
  }

  /** The left column: where he is, who just spoke, and what they said. */
  paint({ location, beat }) {
    $("#sit-loc").textContent = location ?? "";

    const speakerEl = $("#sit-speaker");
    const textEl = $("#sit-text");

    if (beat?.speakerId) {
      const person = getCast()[beat.speakerId] ?? { name: beat.speakerId, hue: 20 };
      this.root.style.setProperty("--sit-hue", person.hue ?? 20);
      speakerEl.textContent = person.name;
      speakerEl.hidden = false;
    } else {
      speakerEl.hidden = true;
    }

    textEl.textContent = beat?.text ?? "";
    textEl.classList.toggle("is-thought", Boolean(beat?.thought));
  }

  async choose(nodes, chosen, option, resolve) {
    this.clearTimer();
    for (const node of nodes) {
      node.disabled = true;
      node.style.transitionDelay = "0ms";
      node.classList.remove("is-surfaced");
      node.classList.add(node === chosen ? "is-chosen" : "is-sunk");
    }

    // the taken option holds for a beat before the world comes back
    await wait(720);
    this.close();
    resolve(option);
  }

  close() {
    this.root.hidden = true;
    this.stage.classList.remove("is-choosing");
    clear(this.list);
  }

  get isOpen() { return !this.root.hidden; }
}

const strip = (s) => s.replace(/^\s*["“]|["”]\s*$/g, "").replace(/^\s*\[|\]\s*$/g, "");
