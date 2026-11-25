"""Check the shipped recordings against their marked Russian lines."""
import importlib.util
from pathlib import Path
import sys

HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE.parent/'oath'))
import check_voices as acoustic

spec=importlib.util.spec_from_file_location('roles_source', HERE/'render.py')
roles=importlib.util.module_from_spec(spec)
spec.loader.exec_module(roles)
acoustic.HERE=HERE
acoustic.lines=roles.lines

if __name__=='__main__':
    acoustic.check(Path(sys.argv[1]),Path(sys.argv[2]))
