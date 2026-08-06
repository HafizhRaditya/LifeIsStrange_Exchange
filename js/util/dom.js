export const $ = (sel, root = document) => root.querySelector(sel);

export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

export const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Commits the element's current styles so a class added immediately after
 * still animates from the right starting state.
 *
 * Use this instead of requestAnimationFrame for reveals. rAF does not fire in a
 * backgrounded tab, which would leave a thought or a portrait sitting in the DOM
 * at opacity 0 — invisible and unclickable — until the tab is looked at again.
 */
export function flush(node) {
  void node.offsetWidth;
}
