import { $, el, clear } from "../util/dom.js";
import { state } from "../engine/state.js";

/**
 * Beacon — Fiz's phone.
 *
 * Content is gated on story flags, so a choice made in the hallway shows up
 * here as social fallout a scene later. That loop is the point of the sidebar.
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

    $("#beacon-carrier").textContent = data.device.carrier;
    $("#beacon-home").addEventListener("click", () => this.renderHome());
    this.toggle.addEventListener("click", (e) => {
      e.stopPropagation();
      this.setOpen(!this.open);
    });
    this.panel.addEventListener("click", (e) => e.stopPropagation());

    this.renderHome();
  }

  setOpen(open) {
    this.open = open;
    this.panel.classList.toggle("is-open", open);
    this.panel.setAttribute("aria-hidden", String(!open));
    this.toggle.classList.toggle("is-open", open);
    this.toggle.setAttribute("aria-expanded", String(open));
    if (open) this.renderHome();
  }

  setClock(time) {
    $("#beacon-clock").textContent = (time ?? "").replace(/^[^\d]*/, "").replace(/\s?[AP]M$/i, "");
  }

  /* ---- content ---- */

  itemsFor(appId) {
    const bucket = this.data.content[appId] ?? {};
    const list =
      bucket.messages ?? bucket.posts ?? bucket.streams ??
      bucket.stories ?? bucket.clips ?? bucket.threads ?? bucket.recent ?? [];
    return list.filter((item) => state.meets(item.requires));
  }

  unreadCount(appId) {
    return this.itemsFor(appId).filter((item) => !state.isRead(item.id)).length;
  }

  /** Badge always updates; the home grid only re-renders if it's what's on screen,
      so a story flag firing can't yank the player out of an open app. */
  refreshBadge() {
    const total = this.data.apps.reduce((sum, app) => sum + this.unreadCount(app.id), 0);
    this.badge.textContent = total;
    this.badge.hidden = total === 0;
    if (this.open && this.view === "home") this.renderHome();
  }

  /* ---- views ---- */

  renderHome() {
    this.view = "home";
    clear(this.screen);
    const grid = el("div", "appgrid");

    for (const app of this.data.apps) {
      const button = el("button", "app");
      button.type = "button";
      button.style.setProperty("--hue", app.hue);

      const icon = el("span", "app__icon", app.glyph);
      const unread = this.unreadCount(app.id);
      if (unread) icon.append(el("span", "app__badge", String(unread)));

      button.append(icon, el("span", "app__name", app.name));
      button.addEventListener("click", () => this.renderApp(app));
      grid.append(button);
    }

    this.screen.append(grid);
  }

  renderApp(app) {
    this.view = app.id;
    clear(this.screen);
    this.screen.style.setProperty("--hue", app.hue);

    const items = this.itemsFor(app.id);
    const bucket = this.data.content[app.id] ?? {};

    const head = el("div", "appview__head");
    head.append(
      el("h2", "appview__title", app.name),
      el("span", "appview__meta", this.subtitleFor(app, bucket, items))
    );
    this.screen.append(head);

    const body = el("div");
    const render = RENDERERS[app.kind];
    if (render) render.call(this, body, items, bucket);
    if (!body.children.length) body.append(el("p", "beacon__empty", "Nothing new."));
    this.screen.append(body);

    state.markRead(items.map((i) => i.id));
    this.refreshBadge();
  }

  subtitleFor(app, bucket, items) {
    if (app.kind === "chat") return `${bucket.server} · ${bucket.channel}`;
    if (app.kind === "music") return "now playing";
    return `${items.length} item${items.length === 1 ? "" : "s"}`;
  }

  hueOf(id) {
    return this.cast[id]?.hue ?? 200;
  }

  nameOf(id) {
    return this.cast[id]?.name ?? id;
  }
}

/* ---- per-app-kind renderers ---- */

const RENDERERS = {
  chat(body, items) {
    for (const msg of items) {
      const row = el("div", "msg");
      const hue = this.hueOf(msg.from);

      const avatar = el("span", "msg__avatar", this.cast[msg.from]?.initials ?? "??");
      avatar.style.setProperty("--hue", hue);

      const content = el("div");
      content.style.setProperty("--hue", hue);
      content.append(
        el("p", "msg__from", this.nameOf(msg.from)),
        el("p", "msg__text", msg.text)
      );

      row.append(avatar, content);
      body.append(row);
    }
  },

  feed(body, items) {
    for (const post of items) {
      const card = el("article", "card");
      const top = el("div", "card__top");
      top.append(
        el("span", "card__author", post.author),
        el("span", "card__handle", post.handle)
      );
      card.append(top, el("p", "card__body", post.text));
      body.append(card);
    }
  },

  photos(body, items) {
    const tiles = el("div", "tiles");
    for (const post of items) {
      const tile = el("div", "tile");
      tile.style.setProperty("--hue", post.hue ?? 300);
      tile.append(el("p", "tile__caption", `${post.author} — ${post.caption}`));
      tiles.append(tile);
    }
    body.append(tiles);
  },

  streams(body, items) {
    for (const s of items) {
      const row = el("div", "stream");
      const thumb = el("div", "stream__thumb");
      thumb.style.setProperty("--hue", s.hue ?? 186);

      const meta = el("div");
      const title = el("p", "card__author");
      if (s.live) title.append(el("span", "stream__live", "LIVE"));
      title.append(document.createTextNode(s.channel));
      meta.append(title, el("p", "card__sub", `${s.title} · ${s.viewers} watching`));

      row.append(thumb, meta);
      body.append(row);
    }
  },

  stories(body, items) {
    for (const story of items) {
      const card = el("article", "card");
      const top = el("div", "card__top");
      top.append(
        el("span", "card__author", story.author),
        el("span", "card__handle", `expires in ${story.expires}`)
      );
      card.append(top, el("p", "card__body", "Tap to view. It won't be there tomorrow."));
      body.append(card);
    }
  },

  clips(body, items) {
    for (const clip of items) {
      const card = el("article", "card");
      const top = el("div", "card__top");
      top.append(
        el("span", "card__author", clip.author),
        el("span", "card__handle", `${clip.plays} plays`)
      );
      card.append(top, el("p", "card__body", clip.caption));
      body.append(card);
    }
  },

  forum(body, items) {
    for (const thread of items) {
      const card = el("article", "card");
      const top = el("div", "card__top");
      top.append(
        el("span", "card__handle", thread.board),
        el("span", "card__handle", `${thread.replies} replies`)
      );
      card.append(top, el("p", "card__body", thread.title));
      body.append(card);
    }
  },

  music(body, items, bucket) {
    const np = bucket.nowPlaying;
    if (np) {
      const panel = el("div", "nowplaying");
      panel.append(
        el("p", "nowplaying__title", np.title),
        el("p", "nowplaying__artist", np.artist),
        el("p", "nowplaying__album", np.album)
      );
      body.append(panel);
    }
    for (const track of items) {
      const card = el("article", "card");
      card.append(el("p", "card__body", `${track.title} — ${track.artist}`));
      body.append(card);
    }
  }
};
