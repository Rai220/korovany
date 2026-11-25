"""Render marked speech and assemble the offline chapter bank. Usage: render.py MODEL [clip ...]."""
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import subprocess
import sys
import tempfile

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('voice_engine', HERE.parents[1] / 'tools/voice/render.py')
engine = importlib.util.module_from_spec(spec)
spec.loader.exec_module(engine)
CAST = {'Вера': ('ru_karina', 1.015, .26), 'Савва': ('ru_alexandr', .985, .28)}


def lines():
    for line in (HERE / 'lines.txt').read_text().splitlines():
        if line and not line.startswith('#'):
            yield line.split('|')


def lexicon(marked):
    words = {}
    for word in re.findall(r'[а-яё+]+', marked.lower()):
        plain = word.replace('+', '')
        if sum(c in engine.VOWELS for c in plain) < 2:
            continue
        if '+' not in word and 'ё' in word:
            word = word.replace('ё', '+ё')
        if not re.fullmatch(r'[а-яё]*\+[аеёиоуыэюя][а-яё]*', word):
            raise ValueError('Missing stress: ' + word)
        words[plain] = word
    return words


def render(model_path, selected):
    import torch
    if hashlib.sha256(model_path.read_bytes()).hexdigest() != engine.MODEL_SHA256:
        raise ValueError('Unexpected Silero model')
    rows = list(lines())
    for _, _, marked in rows:
        lexicon(marked)
    torch.set_num_threads(4)
    model = torch.package.PackageImporter(str(model_path)).load_pickle('tts_models','model')
    model.to(torch.device('cpu'))
    manifest = {}
    with tempfile.TemporaryDirectory() as tmp:
        for key, speaker, marked in rows:
            mp3 = HERE / (key + '.mp3')
            text = marked.replace('+', '')
            if not selected or key in selected:
                engine.CAST[key.split('-')[0]] = CAST[speaker]
                if key == 'vera-intro':
                    # Vera slows on the stamped metal when recognizing the branding mark.
                    import numpy as np
                    import zlib
                    blocks = []
                    _, pace, pause = CAST[speaker]
                    for i, sentence in enumerate(re.split(r'(?<=[.!?])\s+', marked.lower())):
                        torch.manual_seed(zlib.crc32(f'{key}/{i}'.encode()))
                        if 'клейм+о' in sentence:
                            sentence = sentence.replace('клейм+о','<prosody rate="slow">клейм+о</prosody>')
                            audio = model.apply_tts(ssml_text='<speak>'+sentence+'</speak>', speaker=CAST[speaker][0], sample_rate=48000)
                        else:
                            audio = model.apply_tts(text=sentence, speaker=CAST[speaker][0], sample_rate=48000)
                        if i:
                            blocks.append(np.zeros(round(48000*pause),np.float32))
                        blocks.append(engine.clip_edges(audio.detach().cpu().numpy()))
                    audio = np.concatenate(blocks)
                else:
                    audio, pace = engine.synthesize(model, text, key, lexicon(marked))
                engine.encode(audio, pace, Path(tmp)/'speaker.wav', mp3)
                print(key, flush=True)
            duration = float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',str(mp3)], text=True))
            manifest[key] = [speaker,text,'./assets/oath/'+key+'.mp3',round(duration,3)]
    src = "'use strict';\nconst oathSpeech = " + json.dumps(manifest, ensure_ascii=False, indent=2) + ";\n"
    src += "realmVoice.register(Object.values(oathSpeech));\nconst OATH_INTRO_LINES = "+json.dumps([dict(id=k,speaker=v[0],text=v[1]) for k,v in list(manifest.items())[:4]],ensure_ascii=False,indent=2)+";\n"
    src += "function oathSpeak(id) { const row = oathSpeech[id]; return row ? realmVoice.play(row[0], row[1]) : false; }\n"
    (HERE/'voice-clips.js').write_text(src)


if __name__ == '__main__':
    render(Path(sys.argv[1]), set(sys.argv[2:]))
