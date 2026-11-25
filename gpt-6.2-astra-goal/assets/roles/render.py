"""Build the three homecoming sequences with the same local Russian voices as the campaign."""
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import numpy as np

HERE = Path(__file__).resolve().parent
shared = HERE.parent / 'oath' / 'render.py'
spec = importlib.util.spec_from_file_location('marked_voice', shared)
marked_voice = importlib.util.module_from_spec(spec)
spec.loader.exec_module(marked_voice)
engine = marked_voice.engine


def lines():
    for line in (HERE/'lines.txt').read_text().splitlines():
        if line and not line.startswith('#'):
            yield line.split('|')


def render(path, selected):
    import torch
    if hashlib.sha256(path.read_bytes()).hexdigest() != engine.MODEL_SHA256:
        raise ValueError('Unexpected Silero weights')
    torch.set_num_threads(4)
    model=torch.package.PackageImporter(str(path)).load_pickle('tts_models','model')
    model.to(torch.device('cpu'))
    engine.CAST['lord']=('ru_sibday',1.01,.20)
    rows={}
    mouths={}
    with tempfile.TemporaryDirectory() as tmp:
        for key,speaker,marked in lines():
            lexicon=marked_voice.lexicon(marked)
            plain=marked.replace('+','')
            mp3=HERE/(key+'.mp3')
            if not selected or key in selected:
                audio,pace=engine.synthesize(model,plain,key,lexicon)
                engine.encode(audio,pace,Path(tmp)/'take.wav',mp3)
                print(key,flush=True)
            duration=float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',str(mp3)],text=True))
            rows[key]=[speaker,plain,'./assets/roles/'+key+'.mp3',round(duration,3)]
            pcm=np.frombuffer(subprocess.check_output(['ffmpeg','-v','error','-i',str(mp3),'-ac','1','-ar','16000','-f','f32le','-']),dtype='<f4')
            windows=np.pad(pcm,(0,(-len(pcm))%640)).reshape(-1,640)
            power=np.sqrt(np.mean(windows**2,axis=1))
            levels=np.clip((np.sqrt(power)-.055)/(np.sqrt(np.percentile(power,94))-.055),0,1)
            mouths[key]=''.join(chr(65+round(float(v)*25)) for v in levels)
    (HERE/'voice-clips.js').write_text("'use strict';\nconst roleSpeech = "+json.dumps(rows,ensure_ascii=False,indent=2)+";\nrealmVoice.register(Object.values(roleSpeech));\nconst roleMouth = "+json.dumps(mouths,indent=2)+";\n")


if __name__=='__main__':
    render(Path(sys.argv[1]),sys.argv[2:])
