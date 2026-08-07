#!/usr/bin/env python3
"""
Checks episode data against the rules in CLAUDE.md.

Not part of the game — the game ships zero dependencies and no build step. This
catches the authoring mistakes that are easy to make at volume and invisible
until a playtester hits one branch in four.

    python tools/validate.py
"""

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
problems, notes = [], []

err = lambda where, msg: problems.append(f"{where}: {msg}")
note = lambda where, msg: notes.append(f"{where}: {msg}")

chars = json.loads((ROOT / "data" / "characters.json").read_text(encoding="utf-8"))
cast, player = chars["cast"], chars["player"]

TITLE = re.compile(r"^(mr|ms|mrs|dr|chief|officer|principal|nurse)\.?\s+", re.I)
norm = lambda s: TITLE.sub("", str(s)).strip().lower()

known = {}
for cid, p in cast.items():
    for key in [cid, p["name"], p["fullName"], *p.get("aliases", [])]:
        known[norm(key)] = cid
    known.setdefault(norm(p["fullName"]).split(" ")[0], cid)

PLAYER = {norm(player["name"]), norm(player["fullName"])}
NARRATOR = {"narration", "narrator"}


def sequences(scene):
    """Every dialogue sequence in a scene, including the post-exploration one."""
    for key in ("dialogue_sequence", "post_exploration_sequence"):
        if scene.get(key):
            yield key, scene[key]


def entries(seq):
    for e in seq:
        yield e
        for branch in (e.get("responses") or {}).values():
            yield from entries(branch)


all_flags_set, all_flags_read = set(), set()
episodes = sorted((ROOT / "data" / "episodes").glob("ep*.json"))

# ── pass one: collect every flag anything sets ──
for path in episodes:
    ep = json.loads(path.read_text(encoding="utf-8"))
    for scene in ep["scenes"]:
        for item in (scene.get("exploration") or {}).get("interactables", []):
            for key in ("sets_flag", "unlocks_scene_branch"):
                if item.get(key):
                    all_flags_set.add(item[key])
        for _, seq in sequences(scene):
            for e in entries(seq):
                if e.get("sets_flag"):
                    all_flags_set.add(e["sets_flag"])
                for c in e.get("choices", []):
                    for key in ("consequence_id", "sets_flag"):
                        if c.get(key):
                            all_flags_set.add(c[key])

# ── pass two: check ──
for path in episodes:
    ep = json.loads(path.read_text(encoding="utf-8"))
    tag = path.name

    for scene in ep["scenes"]:
        sid = scene.get("scene_id", "?")
        where = f"{tag} / {sid}"

        if not scene.get("background"):
            err(where, "no background — re-run tools/import_episodes.py")

        if scene.get("scene_condition"):
            note(where, "scene_condition is prose, not machine-readable — the engine "
                        "cannot gate on it. Needs an explicit flag to be enforced.")

        # a scene must never leave the player on a choice with nothing after it
        seqs = list(sequences(scene))
        if seqs:
            last_key, last_seq = seqs[-1]
            if last_seq and last_seq[-1].get("is_choice"):
                err(where, f"{last_key} ends on a choice block — dead branch")

        # exploration hubs
        hub = scene.get("exploration")
        if scene.get("is_exploration"):
            if not hub:
                err(where, "is_exploration but no exploration block")
            else:
                spots = hub.get("interactables", [])
                if not spots:
                    err(where, "exploration hub has no interactables")
                need = hub.get("min_required", 0)
                gated = sum(1 for s in spots if s.get("requires_flag") or s.get("presence_condition"))
                if need > len(spots):
                    err(where, f"min_required {need} exceeds {len(spots)} hotspots")
                elif need > len(spots) - gated:
                    note(where, f"min_required {need} but only {len(spots) - gated} "
                                f"hotspots are ungated — could soft-lock on a cold save")
                for s in spots:
                    if not s.get("internal_thought"):
                        err(where, f"hotspot '{s.get('id')}' has no internal_thought")
                    for key in ("requires_flag", "presence_condition"):
                        v = s.get(key)
                        if v and not re.search(r"[<>=]", str(v)) and v not in all_flags_set:
                            note(where, f"hotspot '{s.get('id')}' gates on '{v}', which nothing sets")
                if not scene.get("post_exploration_sequence"):
                    note(where, "exploration hub with no post_exploration_sequence")

        for _, seq in sequences(scene):
            for e in entries(seq):
                if e.get("is_choice"):
                    for c in e["choices"]:
                        text = str(c.get("choice_text", "")).strip()
                        if not (text.startswith('"') or text.startswith("[") or text.startswith("“")):
                            err(where, f'choice is neither "spoken" nor [silent]: {text[:46]}')
                        if not c.get("consequence_id"):
                            err(where, f"choice has no consequence_id: {text[:46]}")
                        rc = c.get("relationship_change")
                        if isinstance(rc, dict) and rc.get("character") and norm(rc["character"]) not in known:
                            err(where, f"relationship_change names unknown character: {rc['character']}")
                        if c.get("requires_flag"):
                            all_flags_read.add(c["requires_flag"])
                    if e.get("timed") and not e.get("timer_seconds"):
                        err(where, "timed choice with no timer_seconds")
                    continue

                for key in ("requires", "unless", "requires_flag"):
                    v = e.get(key)
                    if v:
                        all_flags_read.update(v if isinstance(v, list) else [v])

                if any(e.get(k) for k in ("is_hold", "is_submerge", "is_anomaly")):
                    continue

                speaker = e.get("speaker")
                if speaker is None:
                    err(where, f"entry with no speaker: {str(e)[:56]}")
                    continue

                n = norm(speaker)
                if n in NARRATOR:
                    if not e.get("is_stage_direction"):
                        err(where, "NARRATION speaker without is_stage_direction")
                    continue

                if n not in known and n not in PLAYER:
                    err(where, f"unknown speaker '{speaker}' — not in characters.json")

                if e.get("is_internal_thought"):
                    t = str(e.get("text", "")).strip()
                    if not (t.startswith("(") and t.endswith(")")):
                        note(where, f"internal thought not parenthesised: {t[:44]}")

for flag in sorted(all_flags_read - all_flags_set):
    if not re.search(r"[<>=]", flag):
        note("flags", f"'{flag}' is gated on but nothing sets it")

print()
for n in notes:
    print(f"  note   {n}")
if notes:
    print(f"  ({len(notes)} notes)\n")

if problems:
    for p in problems:
        print(f"  FAIL   {p}")
    print(f"\n{len(problems)} problem(s)\n")
    sys.exit(1)

print("  All episode data passes the CLAUDE.md rules.\n")
