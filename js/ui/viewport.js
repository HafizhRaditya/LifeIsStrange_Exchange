import { $, el, clear, wait, flush } from "../util/dom.js";
import { portraitSVG } from "./portrait.js";

const MAX_ON_STAGE = 3;

export class Viewport {
  constructor(cast) {
    this.cast = cast;
    this.stage = $("#stage");
    this.backdrop = $("#backdrop");
    this.portraits = $("#portraits");
    this.slate = $("#slate");
    this.onStage = [];
  }

  setBackground(name) {
    this.backdrop.className = `backdrop bg--${name || "void"}`;
  }

  /**
   * The [ ] banner. Place and time belong to the Creative Director — the engine
   * only ever renders what the scene data says, and never invents a stamp.
   */
  async showSlate(scene = {}) {
    $("#slate-location").textContent = scene.location ?? "";
    $("#slate-time").textContent = scene.meta?.time ?? "";
    $("#slate-weather").textContent = scene.meta?.weather ?? "";
    this.slate.hidden = false;
    this.slate.classList.remove("is-fading");

    await wait(3200);
    this.slate.classList.add("is-fading");
  }

  clearStage() {
    this.onStage = [];
    clear(this.portraits);
  }

  /**
   * Riley's two seconds under.
   *
   * Fiz loves being underwater; Riley is terrified of it. The player spends her
   * two seconds, not his — so the viewport goes under and there is nothing to
   * click. Duration comes from the script, not from the animation.
   */
  async submerge(seconds) {
    this.stage.classList.add("is-submerged");
    await wait(seconds * 1000);
    this.stage.classList.remove("is-submerged");
    await wait(700); // let the surface settle before the next line
  }

  /** Brings a speaker forward; everyone else dims. */
  async focus(speakerId) {
    if (!speakerId) return;

    if (!this.onStage.includes(speakerId)) {
      this.onStage.push(speakerId);
      if (this.onStage.length > MAX_ON_STAGE) {
        const dropped = this.onStage.shift();
        this.remove(dropped);
      }
      this.add(speakerId);
      await wait(180);
    }

    for (const node of this.portraits.children) {
      node.classList.toggle("is-speaking", node.dataset.id === speakerId);
    }
  }

  add(id) {
    const person = this.cast[id];
    if (!person) return;

    const node = el("figure", "portrait");
    node.dataset.id = id;
    node.style.setProperty("--hue", person.hue ?? 30);

    const art = el("div", "portrait__art");
    art.innerHTML = portraitSVG(person);   // generated locally, no user input
    node.append(art, el("figcaption", "portrait__name", person.name));

    this.portraits.append(node);
    flush(node);
    node.classList.add("is-visible");
  }

  remove(id) {
    const node = [...this.portraits.children].find((n) => n.dataset.id === id);
    if (!node) return;
    node.classList.remove("is-visible");
    setTimeout(() => node.remove(), 400);
  }
}
