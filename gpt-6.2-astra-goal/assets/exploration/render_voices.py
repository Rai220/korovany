"""Rebuild the optional field quest dialogue with the same licensed Silero weights as the campaign."""
import importlib.util
import json
from pathlib import Path
import sys
import tempfile

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('campaign_voice', HERE.parent.parent / 'tools/voice/render.py')
voice = importlib.util.module_from_spec(spec)
spec.loader.exec_module(voice)

TAKES = [
    ('Рада', 'ru_vika', 'rada-1', 'П+осле п+аводка колокол+а замолч+али. Найд+и водом+ерную р+ейку у изл+учины. Там от+ец зап+исывал сигн+алы.'),
    ('Рада', 'ru_vika', 'rada-2', 'Вот теп+ерь сл+ышно с друг+ого б+ерега. Ком+у ост+авить ключ от колок+ольни, реш+ать теб+е.'),
    ('Рада', 'ru_vika', 'rada-3', 'В тум+ане греб+ец не в+идит флаг+ов. Он счит+ает уд+ары, пок+а ведёт л+одку вдоль б+ерега.'),
    ('Лист', 'ru_alfia', 'list-1', 'Я ищ+у +имя челов+ека, кот+орого похорон+или у с+осен. У ст+арой +угольной печ+и нашл+и ег+о жет+он.'),
    ('Лист', 'ru_alfia', 'list-2', 'На лицев+ой сторон+е знак всей арт+ели. Гравир+овку на обор+оте сверь с зар+убками на помин+альном к+амне.'),
    ('Лист', 'ru_alfia', 'list-3', 'Теп+ерь +имя м+ожно верн+уть семь+е. +Или ост+авить здесь, чт+обы п+утники ег+о зап+омнили.'),
    ('Эсма', 'ru_zara', 'esma-1', 'Труб+а уцел+ела, но л+инза тр+еснула. Найд+и стекл+о на м+есте уд+ара, над лесн+ой дор+огой.'),
    ('Эсма', 'ru_zara', 'esma-2', 'Кор+откий край оск+олка обращён к зак+ату. +Угол подъёма ищ+и на опр+аве.'),
    ('Эсма', 'ru_zara', 'esma-3', 'В седлов+ине Сарг+ат. Ид+и по с+еверной троп+е до сигн+альной в+ехи. Н+иже спуск+аться не н+адо.'),
]


def build(model_file):
    import torch
    import hashlib
    if hashlib.sha256(model_file.read_bytes()).hexdigest() != voice.MODEL_SHA256:
        raise ValueError('Wrong model checksum')
    torch.set_num_threads(4)
    model = torch.package.PackageImporter(str(model_file)).load_pickle('tts_models', 'model')
    model.to(torch.device('cpu'))
    manifest = {}
    with tempfile.TemporaryDirectory() as tmp:
        for speaker, preset, clip, marked in TAKES:
            import re
            tokens = re.findall(r'[а-яё+]+',marked.lower()); lexicon = {}
            for token in tokens:
                word = token.replace('+',''); count = sum(c in voice.VOWELS for c in word)
                if count>1:
                    if '+' not in token and 'ё' in token: token = token.replace('ё','+ё')
                    if token.count('+') != 1: raise ValueError(token)
                    lexicon[word]=token
            text=marked.replace('+',''); voice.CAST[clip.split('-')[0]]=(preset,1.01,.23)
            sound, pace=voice.synthesize(model,text,clip,lexicon)
            seconds=voice.encode(sound,pace,Path(tmp)/'take.wav',HERE/(clip+'.mp3'))
            manifest[clip] = [speaker,text,'./assets/exploration/'+clip+'.mp3',seconds]
    path = HERE/'scenery.js'; s=path.read_text(); begin='/* FIELD_SPEECH_BEGIN */'; end='/* FIELD_SPEECH_END */'; left=s.index(begin)+len(begin); right=s.index(end)
    s=s[:left]+'\nconst fieldSpeech = '+json.dumps(manifest,ensure_ascii=False,indent=2)+';\n'+s[right:];path.write_text(s)
if __name__=='__main__': build(Path(sys.argv[1]))
