import { $, el, clear } from "../util/dom.js";
import { state } from "../engine/state.js";

/**
 * The Journal — who Fiz has met, where he stands with them, and what he did.
 *
 * Reads straight out of the save file. It shows the player their own record,
 * which is the only place the track-and-converge model becomes visible: you
 * cannot see a relationship integer while a scene is running, but you can see
 * that you took Riley's wrist in a hallway and never said why.
 */

const SEGMENTS = 11;          // −5 … 0 … +5, centre is neutral
const SCALE = 5;

function standingLabel(v) {
  if (v >= 7) return "She would come looking for you.";
  if (v >= 4) return "Trusted. Actively.";
  if (v >= 2) return "Warm.";
  if (v >= 1) return "Noticed.";
  if (v === 0) return "Nothing either way. Yet.";
  if (v >= -2) return "Cooled off.";
  if (v >= -4) return "Wary of you.";
  return "You cost yourself this one.";
}

export class Journal {
  constructor(cast) {
    this.cast = cast;
    this.root = $("#journal");
    this.listEl = $("#journal-cast");
    this.detailEl = $("#journal-detail");
    this.selected = null;

    $("#journal-close").addEventListener("click", (e) => { e.stopPropagation(); this.close(); });
    this.root.addEventListener("click", (e) => e.stopPropagation());
  }

  /** Only people Fiz has actually shared a scene with. */
  met() {
    const ids = new Set(Object.keys(state.data.relationships));
    for (const c of state.data.choices) if (c.who) ids.add(c.who);
    for (const id of state.data.seenCast ?? []) ids.add(id);
    return [...ids].filter((id) => this.cast[id]);
  }

  open() {
    const ids = this.met();
    this.root.hidden = false;
    $("#journal-count").textContent = `${ids.length} met`;

    if (!ids.length) {
      clear(this.listEl);
      clear(this.detailEl);
      this.detailEl.append(el("p", "journal__empty", "You haven't met anyone yet."));
      return;
    }

    this.selected = ids.includes(this.selected) ? this.selected : ids[0];
    this.renderList(ids);
    this.renderDetail(this.selected);
  }

  close() {
    this.root.hidden = true;
  }

  get isOpen() { return !this.root.hidden; }

  renderList(ids) {
    clear(this.listEl);

    // strongest feelings first, in either direction — those are the story
    ids.sort((a, b) => Math.abs(state.rel(b)) - Math.abs(state.rel(a)));

    for (const id of ids) {
      const person = this.cast[id];
      const row = el("button", `jcast${id === this.selected ? " is-on" : ""}`);
      row.type = "button";
      row.style.setProperty("--hue", person.hue ?? 30);

      const body = el("span");
      body.append(
        el("span", "jcast__name", person.fullName),
        el("span", "jcast__role", person.role ?? "")
      );

      row.append(el("span", "jcast__hue"), body);
      row.addEventListener("click", () => {
        this.selected = id;
        this.renderList(ids);
        this.renderDetail(id);
      });
      this.listEl.append(row);
    }
  }

  renderDetail(id) {
    const person = this.cast[id];
    const value = state.rel(id);

    clear(this.detailEl);
    this.detailEl.style.setProperty("--hue", person.hue ?? 30);

    const head = el("div");
    head.append(
      el("span", "jdetail__role", person.role ?? ""),
      el("h2", "jdetail__name", person.fullName),
      el("span", "jdetail__rule")
    );

    // ── where you stand ──
    const stand = el("div");
    stand.append(el("span", "jdetail__label", "Where you stand"));

    const bar = el("div", "standing");
    const clamped = Math.max(-SCALE, Math.min(SCALE, value));
    const mid = Math.floor(SEGMENTS / 2);
    const lit = mid + clamped;

    for (let i = 0; i < SEGMENTS; i++) {
      const seg = el("span", "standing__seg");
      const dist = Math.abs(i - mid);
      seg.style.height = `${10 + dist * 3}px`;
      if (i === mid) seg.classList.add("is-mid");
      const within = clamped >= 0 ? (i > mid && i <= lit) : (i < mid && i >= lit);
      if (within) seg.classList.add("is-lit");
      bar.append(seg);
    }

    stand.append(bar, el("span", "standing__label", standingLabel(value)));

    // ── what happened ──
    const log = el("div");
    log.append(el("span", "jdetail__label", "What happened"));

    const entries = state.choicesFor(id);
    if (!entries.length) {
      log.append(el("p", "journal__empty", "Nothing yet that turned on you."));
    } else {
      const rows = el("div", "jlog");
      for (const e of entries) {
        const row = el("div", "jlog__row");
        row.append(
          el("span", "jlog__when", `EP ${String(e.episode ?? 1).padStart(2, "0")}`),
          el("span", "jlog__what", e.text ?? e.id)
        );
        rows.append(row);
      }
      log.append(rows);
    }

    this.detailEl.append(head, stand, log);
  }
}
