"""Score the finished field recordings using meter2 and unaccented subtitles."""
import argparse
import json
from pathlib import Path
import re
import subprocess
import sys

import numpy as np

from render_voices import HERE, TAKES, voice


def main():
    parser = argparse.ArgumentParser(__doc__)
    parser.add_argument('meter', type=Path, help='Directory containing meter2.py and head.pt')
    parser.add_argument('report', type=Path)
    args = parser.parse_args()
    sys.path.insert(0, str(args.meter.resolve()))
    import meter2

    all_words = []
    for _, _, clip, marked in TAKES:
        text = marked.lower().replace('+', '')
        audio = subprocess.check_output([
            'ffmpeg', '-v', 'error', '-i', str(HERE / (clip + '.mp3')),
            '-ac', '1', '-ar', '16000', '-f', 'f32le', '-',
        ])
        words = re.findall(r'[а-яё+]+', marked.lower())
        judged = meter2.judge(np.frombuffer(audio, dtype='<f4'), 16000, text, head=str(args.meter / 'head.pt'))
        if len(words) != len(judged):
            raise ValueError(f'Word alignment failed for {clip}')
        for word, result in zip(words, judged):
            if sum(c in voice.VOWELS for c in word) < 2:
                continue
            if '+' not in word:
                word = word.replace('ё', '+ё')
            target = meter2.marked_index(word)
            all_words.append({'clip': clip, 'word': word, 'target': target, 'observed': result['best'],
                              'alignment': result['align'], 'start': result['start'], 'end': result['end']})
    args.report.write_text(json.dumps(all_words, ensure_ascii=False, indent=1))
    matches = sum(row['target'] == row['observed'] for row in all_words)
    print(f'{matches}/{len(all_words)} matching')
    if matches != len(all_words):
        raise SystemExit(1)


if __name__ == '__main__':
    main()
