#!/usr/bin/env python3
"""
Checks episode data against the rules in CLAUDE.md.

Not part of the game — the game ships zero dependencies and no build step. This
is a dev tool for catching the authoring mistakes that are easy to make at
volume and invisible until a playtester hits one branch in four.

    python tools/validate.py
"""

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
problems = []
notes = []


def err(where, msg):
    problems.append(f"{where}: {msg}")


def load(p):
    return json.loads(p.read_text(encoding="utf-8"))


characters = load(ROOT / "data" / "characters.json")
cast = characters["cast"]
player_names = {characters["player"]["name"].lower(),
                characters["player"]["fullName"].lower()}

TITLE = re.compile(r"^(mr|ms|mrs|dr|chief|officer|principal|nurse)\.?\s+", re.I)


def norm(s):
    return TITLE.sub("", str(s)).strip().lower()


known = set()
for cid, person in cast.items():
    known |= {cid.lower(), norm(person["name"]), norm(person["fullName"])}
    known |= {norm(a) for a in person.get("aliases", [])}
    known.add(norm(person["fullName"]).split(" ")[0])


def entries(seq):
    """Every dialogue entry, including those nested in choice responses."""
    for e in seq:
        yield e
        for branch in (e.get("responses") or {}).values():
            yield from entries(branch)


for path in sorted((ROOT / "data" / "episodes").glob("*.json")):
    ep = load(path)
    tag = path.name
    flags_set, flags_read = set(), set()

    for scene in ep["scenes"]:
        sid = scene["scene_id"]
        seq = scene["dialogue_sequence"]
        where = f"{tag} / {sid}"

        # A scene must never end on a choice block.
        if seq and seq[-1].get("is_choice"):
            err(where, "ends on a choice block — the player is left on a dead branch")

        if not scene.get("background"):
            err(where, "no background set")

        for e in entries(seq):
            if e.get("is_choice"):
                for c in e["choices"]:
                    text = c["choice_text"].strip()
                    if not (text.startswith('"') or text.startswith("[")):
                        err(where, f'choice is neither "spoken" nor [silent]: {text[:50]}')
                    if not c.get("consequence_id"):
                        err(where, f"choice has no consequence_id: {text[:50]}")
                    else:
                        flags_set.add(c["consequence_id"])
                    rc = c.get("relationship_change")
                    if rc and norm(rc["character"]) not in known:
                        err(where, f"relationship_change names unknown character: {rc['character']}")
                # every branch should have written follow-up
                for c in e["choices"]:
                    cid = c.get("consequence_id")
                    if cid and cid not in (e.get("responses") or {}):
                        notes.append(f"{where}: '{cid}' has no branch response — falls straight through")
                continue

            for key in ("requires", "unless"):
                v = e.get(key)
                if v:
                    flags_read.update(v if isinstance(v, list) else [v])

            if e.get("is_hold") or e.get("is_submerge") or e.get("is_anomaly"):
                continue

            speaker = e.get("speaker")
            if speaker is None:
                err(where, f"entry with no speaker: {str(e)[:60]}")
                continue

            # THE rule: Fiz never speaks outside a choice.
            if norm(speaker) in player_names and not e.get("is_internal_thought"):
                err(where, f"Fiz has a spoken line outside a choice: {e.get('text','')[:50]}")

            if norm(speaker) not in known and norm(speaker) not in player_names:
                err(where, f"unknown speaker '{speaker}' — not in characters.json")

            if e.get("is_internal_thought"):
                t = e.get("text", "").strip()
                if not (t.startswith("(") and t.endswith(")")):
                    err(where, f"internal thought not wrapped in parentheses: {t[:50]}")

    # flags read but never set anywhere in the season
    all_set = set()
    for p2 in sorted((ROOT / "data" / "episodes").glob("*.json")):
        for sc in load(p2)["scenes"]:
            for e in entries(sc["dialogue_sequence"]):
                if e.get("is_choice"):
                    for c in e["choices"]:
                        if c.get("consequence_id"):
                            all_set.add(c["consequence_id"])
    for f in flags_read - all_set:
        notes.append(f"{tag}: gates on '{f}', which no choice sets (engine flag?)")

# Beacon gates
beacon = load(ROOT / "data" / "beacon.json")
for app, bucket in beacon["content"].items():
    for lst in bucket.values():
        if isinstance(lst, list):
            for item in lst:
                if isinstance(item, dict) and item.get("from"):
                    if norm(item["from"]) not in known:
                        err(f"beacon/{app}", f"message from unknown character: {item['from']}")

print()
for n in notes:
    print(f"  note   {n}")
if notes:
    print()

if problems:
    for p in problems:
        print(f"  FAIL   {p}")
    print(f"\n{len(problems)} problem(s)\n")
    sys.exit(1)

print("  All episode data passes the CLAUDE.md rules.\n")
