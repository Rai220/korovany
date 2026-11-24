"""Measure lexical stress in the decoded MP3s with the external meter2 acoustic model."""
import argparse
import json
from pathlib import Path
import re
import subprocess
import sys

import numpy as np
from render import ASSETS, SCRIPT, TAKES, dictionary, mark_sentence


def main():
    parser = argparse.ArgumentParser(__doc__)
    parser.add_argument("meter", type=Path, help="Directory containing meter2.py and head.pt")
    parser.add_argument("report", type=Path, help="Write per-word audio measurements as JSON")
    parser.add_argument("ids", nargs="*", help="Limit the audit to these takes")
    args = parser.parse_args()
    sys.path.insert(0, str(args.meter.resolve()))
    import meter2

    lexicon = dictionary()
    bank = TAKES.search(SCRIPT.read_text())
    takes = json.loads(re.sub(r",\s*\]$", "]", bank[1]))
    rows = []
    for _, subtitle, clip_id, _ in takes:
        if args.ids and clip_id not in args.ids:
            continue
        marked = mark_sentence(subtitle, lexicon)
        plain = marked.replace("+", "")
        expected = re.findall(r"[а-яё+]+(?:-[а-яё+]+)*", marked, re.I)
        decoded = subprocess.check_output([
            "ffmpeg", "-v", "error", "-i", str(ASSETS / (clip_id + ".mp3")),
            "-c:a", "pcm_f32le", "-ac", "1", "-ar", "16000", "-f", "f32le", "-",
        ])
        # Only unmarked words are passed to the acoustic evaluator. The reference enters below.
        readings = meter2.judge(np.frombuffer(decoded, dtype="<f4"), 16000, plain, head=str(args.meter / "head.pt"))
        if len(readings) != len(expected):
            raise ValueError(f"Word alignment failed for {clip_id}")
        for stress, reading in zip(expected, readings):
            if stress.count("+") == 0 or len(meter2.vowel_pos(stress)) < 2:
                continue
            target = meter2.marked_index(stress)
            rows.append({
                "clip": clip_id, "word": stress, "target": target, "observed": reading["best"],
                "margin": reading["margin"], "start": reading["start"], "end": reading["end"],
            })
        print(f"{clip_id}: {len(readings)} words", flush=True)
    covered = [row for row in rows if row["observed"] is not None]
    matched = sum(row["observed"] == row["target"] for row in covered)
    args.report.write_text(json.dumps(rows, ensure_ascii=False, indent=1))
    print(f"{matched}/{len(covered)} matching, {len(rows) - len(covered)} inconclusive")


if __name__ == "__main__":
    main()
