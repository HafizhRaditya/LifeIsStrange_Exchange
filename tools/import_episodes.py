#!/usr/bin/env python3
"""
Imports the Creative Director's episode JSON into the repo.

The scripts arrive without a `background`, because backgrounds are an engine
concern. This maps each scene's location to a `.bg--<name>` class by keyword and
reports anything it could not place, so nothing silently falls back to void.

    python tools/import_episodes.py <src_dir>

Idempotent. Re-run whenever a new revision lands.
"""

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "episodes"

NEXT = {"ep1": "ep2", "ep2": "ep3", "ep3": "ep4", "ep4": "ep5", "ep5": None}

# First match wins, so order matters: more specific patterns sit above general ones.
RULES = [
    (r"dream|nowhere.*stitched|badly stitched",      "dream"),
    # Must sit above the room-214 rules: the Nexus scene's location reads
    # "Blackwell Dormitory, Room 214 — Nexus voice channel", and it is the one
    # image in the season that should feel safe. It is not an ordinary morning.
    (r"nexus voice|voice channel",                   "nexus-voice"),
    (r"room 214.*(2:00|2:16|night)|room 214.*am",    "dorm-night"),
    (r"dormitory.*room 214|room 214",                "dorm-morning"),
    (r"east corridor|stairwell landing|stairwell",   "stairwell"),
    (r"media lab",                                   "media-lab"),
    (r"darkroom",                                    "darkroom"),
    (r"photography studio",                          "studio"),
    (r"library",                                     "library"),
    (r"principal",                                   "principal-office"),
    (r"archive|restricted wing",                     "archive"),
    (r"science lab",                                 "science-lab"),
    (r"cafeteria",                                   "cafeteria"),
    (r"bathroom",                                    "bathroom"),
    (r"taki kimura|taki's room",                     "taki-room"),
    (r"pool",                                        "pool-night"),
    (r"gym|sports block",                            "gym"),
    (r"quad",                                        "quad"),
    (r"rear steps",                                  "rear-steps"),
    (r"rear parking|car park|parking lot|visitor bay", "parking-lot"),
    (r"art corridor|theatre block",                  "art-corridor"),
    (r"main hallway|hallway",                        "hallway"),
    (r"jacquelin diner|diner",                       "diner"),
    (r"theo's room",                                 "theo-room"),
    (r"riley's room",                                "riley-room"),
    (r"jones house.*landing|upstairs landing",       "jones-landing"),
    (r"jones house",                                 "jones-house"),
    (r"calder house|calder",                         "calder-house"),
    (r"cross industries",                            "cross-office"),
    (r"gazette",                                     "gazette"),
    (r"police department|arcadia bay pd|chief's office", "police"),
    (r"hospital|county general",                     "hospital"),
    (r"lighthouse|water line",                       "lighthouse-dusk"),
    (r"cliff",                                       "cliff-path"),
    (r"beach|driftwood",                             "beach"),
    (r"harbour|north channel|survey vessel|dock",    "harbour"),
    # `car` is the inside of Mason's Corolla only. "Coast Road" on its own is
    # Fiz walking to school, which is a coastal exterior, not a car interior.
    (r"corolla|route 101",                           "car"),
    (r"coast road|front lawn",                       "cliff-path"),
    (r"cascade lanes|bowl",                          "bowling"),
    (r"airport|departures",                          "airport"),
    (r"over the following weeks|late may|late june", "beach"),
]


def background_for(location: str, scene_id: str = "") -> str | None:
    # scene_id is the reliable signal for dreams: the prologue is set in a
    # *wrong* version of the diner, which the location text alone reads as
    # "Jacquelin Diner" and would plate as an ordinary morning.
    if "dream" in scene_id.lower():
        return "dream"

    text = location.lower()
    for pattern, name in RULES:
        if re.search(pattern, text):
            return name
    return None


def main(src: Path) -> int:
    files = sorted(src.rglob("episode_0*.json"))
    # de-dup identical copies across the zips, keep one per episode number
    chosen: dict[str, Path] = {}
    for f in files:
        num = re.search(r"episode_0(\d)", f.name).group(1)
        chosen.setdefault(num, f)

    if not chosen:
        print(f"No episode_0*.json found under {src}")
        return 1

    unmapped: set[str] = set()
    used: set[str] = set()

    # Every flag the season actually sets, so we can spot gates that can never open.
    live_flags: set[str] = set()
    for path in chosen.values():
        data = json.loads(path.read_text(encoding="utf-8"))
        for scene in data["scenes"]:
            for item in (scene.get("exploration") or {}).get("interactables", []):
                for key in ("sets_flag", "unlocks_scene_branch"):
                    if item.get(key):
                        live_flags.add(item[key])
            for key in ("dialogue_sequence", "post_exploration_sequence"):
                for entry in scene.get(key, []):
                    if entry.get("sets_flag"):
                        live_flags.add(entry["sets_flag"])
                    for choice in entry.get("choices", []):
                        for k in ("consequence_id", "sets_flag"):
                            if choice.get(k):
                                live_flags.add(choice[k])

    dropped: list[str] = []

    for num, path in sorted(chosen.items()):
        data = json.loads(path.read_text(encoding="utf-8"))
        ep_id = f"ep{num}"

        for scene in data["scenes"]:
            # A hotspot carrying BOTH a presence_condition and a requires_flag that
            # nothing ever sets can never appear. The Episode 5 airport epilogue is
            # written this way for all eight guests — every one gated on a live
            # relationship threshold AND a dead `<name>_present` flag — which would
            # empty the season's final scene. The threshold is the real gate.
            for item in (scene.get("exploration") or {}).get("interactables", []):
                flag = item.get("requires_flag")
                if flag and item.get("presence_condition") and flag not in live_flags:
                    dropped.append(f"{scene['scene_id']}/{item['id']}: requires_flag '{flag}'")
                    del item["requires_flag"]

        for scene in data["scenes"]:
            bg = background_for(scene["location"], scene.get("scene_id", ""))
            if bg is None:
                unmapped.add(scene["location"])
                bg = "void"
            used.add(bg)
            scene["background"] = bg

        data["next_episode"] = NEXT.get(ep_id)
        data["_source"] = path.name
        data["_imported_by"] = "tools/import_episodes.py — do not hand-edit backgrounds here"

        target = OUT / f"{ep_id}.json"
        target.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

        scenes = len(data["scenes"])
        expl = sum(1 for s in data["scenes"] if s.get("is_exploration"))
        print(f"  {ep_id}.json  scenes={scenes:3}  exploration={expl}  <- {path.name}")

    if dropped:
        print(f"\n  DROPPED {len(dropped)} unreachable gate(s) — flag never set, "
              f"presence_condition kept as the real gate:")
        for d in dropped:
            print(f"    {d}")

    print(f"\n  backgrounds used ({len(used)}): {', '.join(sorted(used))}")
    if unmapped:
        print("\n  UNMAPPED LOCATIONS (fell back to void):")
        for loc in sorted(unmapped):
            print(f"    {loc}")
        return 1

    print("\n  Every location mapped.")
    return 0


if __name__ == "__main__":
    src = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "docs" / "incoming"
    raise SystemExit(main(src))
