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
      this.stage.classList.add("is-choosing");

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
    });
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
