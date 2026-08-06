/**
 * Resolves the display names the script bible uses ("Gina Ortiz", "Mr. Owen Rhys")
 * to the stable ids the save file keys on ("gina", "rhys").
 *
 * Scripts are written by a human in human names; relationship deltas must never
 * be keyed on a spelling. If a name doesn't resolve we fail loudly rather than
 * silently opening a second relationship track under a typo.
 */

let index = new Map();
let cast = {};

const norm = (s) => String(s).toLowerCase().replace(/^(mr|ms|mrs|dr|chief|officer|principal|nurse)\.?\s+/i, "").trim();

export function buildIndex(characters) {
  cast = characters.cast;
  index = new Map();

  for (const [id, person] of Object.entries(cast)) {
    index.set(id, id);
    index.set(norm(person.name), id);
    index.set(norm(person.fullName), id);

    // Scripts don't always use the canonical full name — Maddie Hale is
    // "Madison Hale" in the ledger but nobody writes that in dialogue.
    for (const alias of person.aliases ?? []) index.set(norm(alias), id);

    // first name alone, when unambiguous
    const first = norm(person.fullName).split(" ")[0];
    if (!index.has(first)) index.set(first, id);
  }

  const player = characters.player;
  index.set(norm(player.name), player.id);
  index.set(norm(player.fullName), player.id);

  return index;
}

export function idFor(name) {
  if (!name) return null;
  const id = index.get(norm(name));
  if (!id) console.warn(`[cast] unresolved name: "${name}" — check characters.json`);
  return id ?? null;
}

export const personFor = (name) => cast[idFor(name)] ?? null;
export const getCast = () => cast;
