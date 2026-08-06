/**
 * Save state. One localStorage key, versioned from day one.
 *
 * The version field is not ceremony: the moment we add a flag in a later
 * episode, unversioned saves would silently half-load. Bump SCHEMA_VERSION
 * and add a migration instead of wiping the Creative Director's playtest.
 */

const KEY = "lis_exchange_save";
const SCHEMA_VERSION = 1;

const migrations = {
  // 1: (save) => { ...; return save; }
};

function blank() {
  return {
    schemaVersion: SCHEMA_VERSION,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    position: { episode: "ep1", scene: "ep1_dorm_morning_01", node: 0 },
    relationships: {},
    flags: {},
    choices: [],
    seen: [],
    beacon: { read: [], opened: false }
  };
}

class GameState {
  constructor() {
    this.data = blank();
  }

  /* ---- persistence ---- */

  load() {
    let raw;
    try {
      raw = localStorage.getItem(KEY);
    } catch {
      return false; // private mode / storage disabled
    }
    if (!raw) return false;

    let save;
    try {
      save = JSON.parse(raw);
    } catch {
      console.warn("[state] corrupt save, starting fresh");
      return false;
    }

    while (save.schemaVersion < SCHEMA_VERSION) {
      const migrate = migrations[save.schemaVersion];
      if (!migrate) {
        console.warn("[state] no migration path, starting fresh");
        return false;
      }
      save = migrate(save);
      save.schemaVersion += 1;
    }

    this.data = { ...blank(), ...save };
    return true;
  }

  save() {
    this.data.updatedAt = Date.now();
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch (err) {
      console.warn("[state] could not persist:", err);
    }
  }

  reset() {
    this.data = blank();
    this.save();
  }

  hasSave() {
    try {
      return localStorage.getItem(KEY) !== null;
    } catch {
      return false;
    }
  }

  /* ---- flags ---- */

  flag(name) {
    return Boolean(this.data.flags[name]);
  }

  setFlags(map = {}) {
    Object.assign(this.data.flags, map);
    this.save();
  }

  /** Beacon items and dialogue can gate on a flag name, or on nothing. */
  meets(requirement) {
    return !requirement || this.flag(requirement);
  }

  /** Ordered log of consequence ids, for the Episode 5 epilogue and a future
      choice-review screen. Flags answer "did this happen"; this answers "in what order". */
  recordChoice(sceneId, consequenceId) {
    this.data.choices.push({ scene: sceneId, id: consequenceId, at: Date.now() });
    this.save();
  }

  /* ---- relationships (track-and-converge model) ---- */

  rel(id) {
    return this.data.relationships[id] ?? 0;
  }

  /** Unbounded by design — Episode 5's epilogue reads absolute values to decide
      who shows up at Departures, so clamping would flatten the ending. */
  adjustRel(map = {}) {
    for (const [id, delta] of Object.entries(map)) {
      this.data.relationships[id] = this.rel(id) + delta;
    }
    this.save();
  }

  /* ---- position ---- */

  setPosition(episode, scene, node) {
    this.data.position = { episode, scene, node };
    this.save();
  }

  markSeen(nodeId) {
    if (!this.data.seen.includes(nodeId)) this.data.seen.push(nodeId);
  }

  /* ---- beacon ---- */

  markRead(ids = []) {
    for (const id of ids) {
      if (!this.data.beacon.read.includes(id)) this.data.beacon.read.push(id);
    }
    this.save();
  }

  isRead(id) {
    return this.data.beacon.read.includes(id);
  }
}

export const state = new GameState();
