import { $, el, clear, flush } from "../util/dom.js";
import { state } from "../engine/state.js";
import { evaluate } from "../engine/conditions.js";

/**
 * Exploration hubs.
 *
 * A room Fiz stands in and looks at things. Each hotspot gives an internal
 * thought, and some give a second one if you come back to them — which is the
 * whole character: he notices, then he notices again, and the second look is
 * always the one that costs him something.
 *
 * The scene will not continue until `min_required` hotspots have been examined
 * and every `required` one has been. Hotspots can be gated on a flag or on a
 * relationship threshold ("Riley Jones >= 8"), so who Fiz is close to changes
 * what he is willing to look at.
 */
export class Exploration {
  constructor() {
    this.root = $("#exploration");
    this.stage = $("#stage");
  }

  run(hub, dialogue) {
    return new Promise((resolve) => {
      this.hub = hub;
      this.dialogue = dialogue;
      this.resolve = resolve;
      this.examined = new Set();

      this.available = (hub.interactables ?? []).filter((it) =>
        evaluate(it.requires_flag) && evaluate(it.presence_condition)
      );
      this.needed = Math.min(hub.min_required ?? 1, this.available.length);

      this.build();
      this.root.hidden = false;
      this.stage.classList.add("is-exploring");
    });
  }

  build() {
    clear(this.root);

    const head = el("div", "expl__head");
    head.append(
      el("span", "expl__tick"),
      el("p", "expl__prompt", this.hub.prompt ?? "")
    );

    this.counter = el("span", "expl__count");
    head.append(this.counter);

    this.grid = el("div", "expl__grid");
    for (const item of this.available) this.grid.append(this.spot(item));

    this.done = el("button", "expl__done", "Enough");
    this.done.type = "button";
    this.done.hidden = true;
    this.done.addEventListener("click", (e) => { e.stopPropagation(); this.finish(); });

    this.root.append(head, this.grid, this.done);
    this.root.onclick = (e) => e.stopPropagation();
    this.updateCounter();

    for (const node of this.grid.children) {
      flush(node);
      node.classList.add("is-in");
    }
  }

  spot(item) {
    const node = el("button", "spot");
    node.type = "button";
    node.dataset.id = item.id;
    node.append(el("span", "spot__label", item.label), el("span", "spot__rule"));

    node.addEventListener("click", async (event) => {
      event.stopPropagation();
      if (node.dataset.busy) return;
      node.dataset.busy = "1";

      const seen = this.examined.has(item.id);
      const text = seen ? item.follow_up : item.internal_thought;

      // nothing more to find here
      if (!text) { node.dataset.busy = ""; return; }

      this.examined.add(item.id);
      node.classList.add("is-seen");
      if (seen || !item.follow_up) node.classList.add("is-spent");

      if (item.sets_flag) state.setFlags({ [item.sets_flag]: true });
      if (item.unlocks_scene_branch) state.setFlags({ [item.unlocks_scene_branch]: true });

      this.root.classList.add("is-reading");
      await this.dialogue.think(text);
      this.root.classList.remove("is-reading");

      node.dataset.busy = "";
      this.updateCounter();
    });

    return node;
  }

  updateCounter() {
    const missing = this.available.filter((i) => i.required && !this.examined.has(i.id));
    const ready = this.examined.size >= this.needed && missing.length === 0;

    this.counter.textContent = ready
      ? "Seen enough"
      : `${this.examined.size} / ${this.needed}`;

    this.done.hidden = !ready;
  }

  finish() {
    this.root.hidden = true;
    this.stage.classList.remove("is-exploring");
    clear(this.root);
    const resolve = this.resolve;
    this.resolve = null;
    resolve?.();
  }

  get isOpen() { return !this.root.hidden; }
}
