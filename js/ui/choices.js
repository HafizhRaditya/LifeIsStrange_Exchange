import { $, el, clear, wait, flush } from "../util/dom.js";

/**
 * Silent Empathy.
 *
 * The script bible writes two kinds of choice and marks them in the text
 * itself: "quoted" is something Fiz says out loud, [bracketed] is something he
 * does, or pointedly doesn't. The mechanic is the contrast between them, so the
 * two kinds must never look alike — spoken options sit up and wait to be said,
 * silent ones drift like the thoughts they are.
 *
 * Neither should read as a button.
 */

const SPOKEN = /^\s*["“]/;

export class Choices {
  constructor() {
    this.root = $("#thoughts");
    this.stage = $("#stage");
  }

  present(options) {
    return new Promise((resolve) => {
      clear(this.root);
      this.root.hidden = false;
      this.root.classList.add("is-open");
      this.stage.classList.add("is-thinking");

      const nodes = options.map((option) => {
        const spoken = SPOKEN.test(option.choice_text);
        const node = el("button", `thought ${spoken ? "thought--spoken" : "thought--silent"}`);
        node.type = "button";
        node.textContent = spoken
          ? option.choice_text.replace(/^\s*["“]|["”]\s*$/g, "")
          : option.choice_text.replace(/^\s*\[|\]\s*$/g, "");

        node.addEventListener("click", (event) => {
          event.stopPropagation();
          this.choose(nodes, node, option, resolve);
        });

        this.root.append(node);
        return node;
      });

      // surfaced with a stagger from transition-delay, not dealt like a hand
      for (const node of nodes) {
        flush(node);
        node.classList.add("is-surfaced");
      }
    });
  }

  async choose(nodes, chosen, option, resolve) {
    for (const node of nodes) {
      node.disabled = true;
      node.classList.remove("is-surfaced");
      node.classList.add(node === chosen ? "is-chosen" : "is-dismissed");
    }

    // the taken option holds for a beat before the world comes back
    await wait(620);
    chosen.classList.add("is-dismissed");
    await wait(280);

    this.close();
    resolve(option);
  }

  close() {
    this.root.classList.remove("is-open");
    this.root.hidden = true;
    this.stage.classList.remove("is-thinking");
    clear(this.root);
  }

  get isOpen() {
    return !this.root.hidden;
  }
}
