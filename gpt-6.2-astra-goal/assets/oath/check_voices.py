"""Score stress from the stored MP3 and plain subtitles. Usage: check_voices.py METER_DIR REPORT.json."""
import json
from pathlib import Path
import re
import subprocess
import sys
import numpy as np

from render import HERE, engine, lexicon, lines


def check(meter, report):
    sys.path.insert(0, str(meter.resolve()))
    import meter2
    result = []
    for key, _, marked in lines():
        decoded = subprocess.check_output(['ffmpeg','-v','error','-i',str(HERE/(key+'.mp3')),'-ar','16000','-ac','1','-f','f32le','-'])
        text = marked.lower().replace('+','')
        observed = meter2.judge(np.frombuffer(decoded,dtype='<f4'),16000,text,head=str(meter/'head.pt'))
        words = re.findall(r'[а-яё]+',text)
        if len(words) != len(observed):
            raise ValueError('Word alignment: '+key)
        accents = lexicon(marked)
        for word, data in zip(words, observed):
            if word not in accents:
                continue
            result.append({'clip':key,'word':word,'target':meter2.marked_index(accents[word]),'observed':data['best'],'alignment':data['align']})
    report.write_text(json.dumps(result,ensure_ascii=False,indent=2))
    print(sum(w['target']==w['observed'] for w in result),'/',len(result))


if __name__ == '__main__':
    check(Path(sys.argv[1]),Path(sys.argv[2]))
