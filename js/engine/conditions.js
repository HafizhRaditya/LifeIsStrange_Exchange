import { state } from "./state.js";
import { idFor } from "./cast.js";

/**
 * Evaluates the small condition language the scripts use on exploration hotspots:
 *
 *   "Riley Jones >= 8"
 *   "Olivia Calder >= 6 AND NOT ending_published"
 *
 * Deliberately tiny. If a condition doesn't parse we return true and warn —
 * hiding content because the engine didn't understand a string is worse than
 * showing it, and the warning tells us to go fix the script.
 */

const CLAUSE = /^\s*(.+?)\s*(>=|<=|>|<|==)\s*(-?\d+)\s*$/;

function clause(text) {
  const negated = /^\s*NOT\s+/i.test(text);
  const body = text.replace(/^\s*NOT\s+/i, "").trim();

  const cmp = CLAUSE.exec(body);
  if (cmp) {
    const [, name, op, rawValue] = cmp;
    const id = idFor(name);
    if (!id) {
      console.warn(`[conditions] unknown character in "${text}"`);
      return true;
    }
    const value = state.rel(id);
    const target = Number(rawValue);
    const result =
      op === ">=" ? value >= target :
      op === "<=" ? value <= target :
      op === ">"  ? value >  target :
      op === "<"  ? value <  target :
                    value === target;
    return negated ? !result : result;
  }

  // otherwise it's a bare flag name
  const result = state.flag(body);
  return negated ? !result : result;
}

export function evaluate(expression) {
  if (!expression) return true;
  if (typeof expression !== "string") return Boolean(expression);

  try {
    return expression
      .split(/\s+AND\s+/i)
      .every((part) => part.split(/\s+OR\s+/i).some(clause));
  } catch (err) {
    console.warn(`[conditions] could not evaluate "${expression}":`, err);
    return true;
  }
}
