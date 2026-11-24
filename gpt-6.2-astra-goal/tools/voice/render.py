"""Build the game's Russian voice bank from its subtitles and pronunciation dictionary."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess
import tempfile
import wave
import zlib

import numpy as np
import torch


GAME = Path(__file__).resolve().parents[2]
SCRIPT = GAME / "voice.js"
ASSETS = GAME / "assets/voice"
LEXICON = Path(__file__).with_name("stress-ru.txt")
MODEL_SHA256 = "0405777e332906f0644e08a680f7cfdc2137ea864090079c1fdd30a43c1b8761"
SAMPLE_RATE = 48000
VOWELS = "аеёиоуыэюя"
WORD = re.compile(r"[а-яё]+", re.I)
TAKES = re.compile(r"^  const takes = (\[.*?^  \]);", re.M | re.S)

# Voice, pace, pause between complete sentences in seconds.
CAST = {
    "scout": ("ru_ekaterina", 0.98, 0.20),
    "captain": ("ru_albina", 1.05, 0.17),
    "centurion": ("ru_alexandr", 0.97, 0.24),
    "miller": ("ru_oksana", 1.04, 0.22),
    "herbalist": ("ru_zinaida", 0.97, 0.22),
    "wheelwright": ("ru_marat", 0.98, 0.19),
    "sentry": ("ru_roman", 0.96, 0.18),
    "chronicler": ("ru_dmitriy", 1.04, 0.23),
    "scribe": ("ru_bogdan", 0.94, 0.21),
    "regent": ("ru_sibday", 1.00, 0.21),
    "registrar": ("ru_eduard", 0.98, 0.20),
    "driver": ("ru_igor", 1.04, 0.17),
    "inspector": ("ru_gamat", 1.00, 0.20),
    "interpreter": ("ru_safarhuja", 0.98, 0.19),
}


def dictionary():
    entries = {}
    for form in LEXICON.read_text().splitlines():
        if not form or form.startswith("#"):
            continue
        if not re.fullmatch(r"[а-яё]*\+[аеёиоуыэюя][а-яё]*", form):
            raise ValueError(f"Invalid stress in {form}")
        plain = form.replace("+", "")
        if plain in entries:
            raise ValueError(f"Duplicate dictionary entry for {plain}")
        entries[plain] = form
    return entries


def mark_sentence(text, lexicon):
    def mark(match):
        word = match[0].lower()
        if sum(letter in VOWELS for letter in word) < 2:
            return word
        if word not in lexicon:
            raise ValueError(f"Add an explicit stress for {word!r} in {text!r}")
        return lexicon[word]

    text = WORD.sub(mark, text)
    # In these compounds the enclitic particle shares the preceding lexical stress.
    return text.replace("кто-ниб+удь", "кт+онибудь").replace("когд+а-то", "когд+ато")


def clip_edges(audio):
    frame_size = SAMPLE_RATE // 100
    frames = audio[:len(audio) // frame_size * frame_size].reshape(-1, frame_size)
    rms = np.sqrt(np.mean(frames ** 2, axis=1))
    speech = np.flatnonzero(rms > max(.0009, rms.max() * .006))
    if not len(speech):
        raise ValueError("Synthesizer returned silence")
    start = max(0, (speech[0] - 5) * frame_size)
    end = min(len(audio), (speech[-1] + 11) * frame_size)
    return audio[start:end]


def synthesize(model, text, clip_id, lexicon):
    role = "driver" if clip_id == "cow-01" else clip_id.split("-")[0]
    voice, pace, pause = CAST[role]
    sentences = re.split(r"(?<=[.!?])\s+", text)
    blocks = []
    for index, sentence in enumerate(sentences):
        torch.manual_seed(zlib.crc32(f"{clip_id}/{index}".encode()))
        spoken = mark_sentence(sentence, lexicon)
        if clip_id == "wheelwright-02" and "в сыр+ую +иву" in spoken:
            # The wheelwright slows down on the materials his apprentice must distinguish.
            spoken = spoken.replace("в сыр+ую +иву", '<prosody rate="slow">в сыр+ую +иву</prosody>')
        if role == "registrar" and spoken.startswith("печ+ать «"):
            # The clerk announces each stamp like a name, with a short pause before it.
            spoken = re.sub(r"«([^»]+)»", r'<break time="170ms"/> \1', spoken)
            spoken = spoken.replace("ветвь", "в+етвь")
        if "<" in spoken:
            audio = model.apply_tts(ssml_text="<speak>" + spoken + "</speak>", speaker=voice, sample_rate=SAMPLE_RATE)
        else:
            audio = model.apply_tts(text=spoken, speaker=voice, sample_rate=SAMPLE_RATE)
        if blocks:
            blocks.append(np.zeros(round(SAMPLE_RATE * pause), np.float32))
        blocks.append(clip_edges(audio.detach().cpu().numpy()))
    return np.concatenate(blocks), pace


def encode(audio, pace, wav, mp3):
    with wave.open(str(wav), "wb") as writer:
        writer.setparams((1, 2, SAMPLE_RATE, len(audio), "NONE", "not compressed"))
        writer.writeframes(np.int16(np.clip(audio, -1, 1) * 32767).tobytes())
    filters = f"highpass=f=58,atempo={pace}"
    measure = subprocess.run([
        "ffmpeg", "-hide_banner", "-nostats", "-i", str(wav), "-af",
        filters + ",loudnorm=I=-18:TP=-2:LRA=9:print_format=json", "-f", "null", "-",
    ], capture_output=True, text=True, check=True)
    levels = json.loads(measure.stderr[measure.stderr.rindex("{"):measure.stderr.rindex("}") + 1])
    gain = min(12, -18 - float(levels["input_i"]))
    subprocess.run([
        "ffmpeg", "-v", "error", "-y", "-i", str(wav), "-af",
        filters + f",volume={gain}dB,alimiter=limit=0.77:level=0:latency=1",
        "-ar", str(SAMPLE_RATE), "-ac", "1", "-c:a", "libmp3lame", "-b:a", "96k",
        "-map_metadata", "-1", str(mp3),
    ], check=True)
    info = subprocess.check_output([
        "ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(mp3),
    ], text=True)
    return round(float(info.strip()), 3)


def main():
    parser = argparse.ArgumentParser(__doc__)
    parser.add_argument("model", type=Path, help="Path to v5_cis_base_nostress.pt")
    parser.add_argument("ids", nargs="*", help="Optionally render only matching clip IDs")
    args = parser.parse_args()
    if hashlib.sha256(args.model.read_bytes()).hexdigest() != MODEL_SHA256:
        parser.error("Unexpected SHA-256 of the Silero checkpoint")
    script = SCRIPT.read_text()
    bank = TAKES.search(script)
    takes = json.loads(re.sub(r",\s*\]$", "]", bank[1]))
    selected = set(args.ids) or {row[2] for row in takes}
    if selected - {row[2] for row in takes}:
        parser.error("A requested clip ID is absent from voice.js")
    lexicon = dictionary()
    for _, text, _, _ in takes:
        mark_sentence(text, lexicon)
    torch.set_num_threads(4)
    model = torch.package.PackageImporter(str(args.model)).load_pickle("tts_models", "model")
    model.to(torch.device("cpu"))
    with tempfile.TemporaryDirectory(dir=ASSETS.parent, prefix=".voice-build-") as tmp:
        stage = Path(tmp)
        for row in takes:
            _, text, clip_id, _ = row
            if clip_id in selected:
                audio, pace = synthesize(model, text, clip_id, lexicon)
                row[3] = encode(audio, pace, stage / "current.wav", stage / (clip_id + ".mp3"))
        for clip in stage.glob("*.mp3"):
            clip.replace(ASSETS / clip.name)
        manifest = "[\n" + "".join("    " + json.dumps(row, ensure_ascii=False) + ",\n" for row in takes) + "  ]"
        new_script = stage / "voice.js"
        new_script.write_text(script[:bank.start(1)] + manifest + script[bank.end(1):])
        new_script.replace(SCRIPT)


if __name__ == "__main__":
    main()
