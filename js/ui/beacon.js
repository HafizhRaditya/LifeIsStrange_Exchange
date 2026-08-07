import { $, el, clear } from "../util/dom.js";
import { state } from "../engine/state.js";

/**
 * Beacon — Fiz's phone.
 *
 * Content is gated on story flags, so a choice made in the hallway shows up
 * here as social fallout a scene later. That loop is the point of the sidebar.
 *
 * Every app renders the same item shape; the left rule and the hue carry the
 * identity. Eight bespoke layouts would be eight things to keep in sync.
 */
export class Beacon {
  constructor(data, cast) {
    this.data = data;
    this.cast = cast;
    this.panel = $("#beacon");
    this.screen = $("#beacon-screen");
    this.toggle = $("#beacon-toggle");
    this.badge = $("#beacon-badge");
    this.open = false;
    this.view = "home";

    $("#beacon-carrier").textContent = data.device.carrier;
    this.toggle.addEventListener("click", (e) => { e.stopPropagation(); this.setOpen(!this.open); });
    this.panel.addEventListener("click", (e) => e.stopPropagation());

    this.renderHome();
  }

  setOpen(open) {
    this.open = open;
    this.panel.classList.toggle("is-open", open);
    this.panel.setAttribute("aria-hidden", String(!open));
    this.toggle.setAttribute("aria-expanded", String(open));
    if (open) this.renderHome();
  }

  setClock(time) {
    $("#beacon-clock").textContent = (time ?? "").replace(/^[^\d]*/, "").replace(/\s?[AP]M$/i, "");
  }

  /* ---- content ---- */

  itemsFor(appId) {
    const b = this.data.content[appId] ?? {};
    const list = b.messages ?? b.posts ?? b.streams ?? b.stories ?? b.clips ?? b.threads ?? b.recent ?? [];
    return list.filter((item) => state.meets(item.requires));
  }

  unreadCount(appId) {
    return this.itemsFor(appId).filter((i) => !state.isRead(i.id)).length;
  }

  /** Badge always updates; the home grid only re-renders if it's what's on screen,
      so a story flag firing can't yank the player out of an open app. */
  refreshBadge() {
    const total = this.data.apps.reduce((sum, a) => sum + this.unreadCount(a.id), 0);
    this.badge.textContent = total;
    this.badge.hidden = total === 0;
    if (this.open && this.view === "home") this.renderHome();
  }

  /* ---- views ---- */

  renderHome() {
    this.view = "home";
    clear(this.screen);

    const home = el("div", "bhome");
    const grid = el("div", "bgrid");

    for (const app of this.data.apps) {
      const button = el("button", "bapp");
      button.type = "button";

      const icon = el("span", "bapp__icon", app.glyph);
      icon.style.setProperty("--hue", app.hue);
      const unread = this.unreadCount(app.id);
      if (unread) icon.append(el("span", "bapp__badge", String(unread)));

      button.append(icon, el("span", "bapp__name", app.name));
      button.addEventListener("click", () => this.renderApp(app));
      grid.append(button);
    }

    const np = this.data.content.aura?.nowPlaying;
    const now = el("div", "bnow");
    now.append(
      el("span", "bnow__label", "Now playing"),
      el("span", "bnow__track", np ? `${np.title} — ${np.artist}` : "Nothing")
    );

    home.append(grid, now);
    this.screen.append(home);
  }

  renderApp(app) {
    this.view = app.id;
    clear(this.screen);

    const items = this.itemsFor(app.id);
    const bucket = this.data.content[app.id] ?? {};

    const wrap = el("div", "bapp-view");
    wrap.style.setProperty("--hue", app.hue);

    const head = el("div", "bapp-view__head");
    const back = el("button", "bapp-view__back", "←");
    back.type = "button";
    back.addEventListener("click", () => this.renderHome());
    head.append(back, el("span", "bapp-view__name", app.name),
                el("span", "bapp-view__meta", this.subtitle(app, bucket, items)));

    const feed = el("div", "bfeed");
    for (const item of items) feed.append(this.item(app, item));
    if (!items.length) feed.append(el("p", "beacon__empty", "Nothing new."));

    wrap.append(head, feed);
    this.screen.append(wrap);

    state.markRead(items.map((i) => i.id));
    this.refreshBadge();
  }

  /** One shape for every app. Fields differ; the frame does not. */
  item(app, data) {
    const node = el("article", "bitem");
    const hue = data.from ? (this.cast[data.from]?.hue ?? app.hue) : app.hue;
    node.style.setProperty("--hue", hue);

    const top = el("div", "bitem__top");
    const name =
      data.from ? (this.cast[data.from]?.name ?? data.from) :
      data.author ?? data.channel ?? data.board ?? data.title ?? app.name;
    top.append(el("span", "bitem__name", name));

    const meta =
      data.handle ?? data.meta ??
      (data.expires ? `expires in ${data.expires}` : null) ??
      (data.plays ? `${data.plays} plays` : null) ??
      (data.replies != null ? `${data.replies} replies` : null) ??
      (data.viewers != null ? `${data.viewers} watching` : null) ??
      data.artist ?? "";
    if (meta) top.append(el("span", "bitem__meta", meta));
    if (!state.isRead(data.id)) top.append(el("span", "bitem__new", "NEW"));

    node.append(top);

    if (app.kind === "photos") {
      const tile = el("div", "bitem__tile");
      tile.style.setProperty("--hue", data.hue ?? app.hue);
      node.append(tile);
    }

    const body = data.text ?? data.caption ?? data.title ?? "";
    if (body) node.append(el("p", "bitem__text", body));

    return node;
  }

  subtitle(app, bucket, items) {
    if (app.kind === "chat") return `${bucket.server} · ${bucket.channel}`;
    if (app.kind === "music") return "recently played";
    return `${items.length} item${items.length === 1 ? "" : "s"}`;
  }
}
