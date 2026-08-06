/**
 * Narrative data loader.
 *
 * NOTE: fetch() of local JSON requires a real HTTP origin. Opening index.html
 * straight off the filesystem will fail here with a CORS error — that's the
 * browser, not the code. See README for the one-line dev server.
 */

const cache = new Map();

async function getJSON(path) {
  if (cache.has(path)) return cache.get(path);

  const res = await fetch(path);
  if (!res.ok) throw new Error(`Could not load ${path} (${res.status})`);

  const data = await res.json();
  cache.set(path, data);
  return data;
}

export const loadCharacters = () => getJSON("data/characters.json");
export const loadBeacon = () => getJSON("data/beacon.json");
export const loadEpisode = (id) => getJSON(`data/episodes/${id}.json`);
