"""يرفض تغيير البوابة والاختبارات، ويتحقق من أداة التركيب الأولى."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess

ACCEPTED = {
    'check.py': 'fa467281b7c0d085e8901d541a07f5eaeb8d78c99b8f202eac5ef477acf7f65f',
    'test_gate.py': '9d1a7f3b30d6eb0b62c0a380fe5a109c9a012f0ddd078f4cc1f19b94fb9c9f8c',
    'requirements.txt': '138ad111e5e3dd2172b9ec90096935f1db369c673e09ba89ab20fa557fbc2db1',
}


def git(root, *args):
    return subprocess.check_output(['git', '-C', str(root), *args])


def protected(name):
    return (name == '.github/workflows/airest-gate.yml'
            or name.startswith('scripts/airest-gate/')
            or bool(re.search(r'(^|/)(__tests__|tests?|specs?)(/|\.)|\.(test|spec)\.'
                              r'|(^|/)test_[^/]*\.py$|_test\.py$', name)))


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--candidate', type=Path, required=True)
    ap.add_argument('--base', type=Path, required=True)
    ap.add_argument('--out', type=Path, required=True)
    args = ap.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    base_sha = git(args.base, 'rev-parse', 'HEAD').decode().strip()
    candidate_sha = git(args.candidate, 'rev-parse', 'HEAD').decode().strip()
    names = git(args.candidate, 'diff', '--name-only', '--no-renames', '-z',
                base_sha, candidate_sha).decode().split('\0')
    names = [name for name in names if name]
    bootstrap = not (args.base / 'scripts/airest-gate/check.py').is_file()
    errors = []
    if bootstrap:
        for name in names:
            if not (name == '.github/workflows/airest-gate.yml'
                    or name.startswith('scripts/airest-gate/') or name == 'docs/airest-gate.md'):
                errors.append(name)
    else:
        errors.extend(name for name in names if protected(name))
    suite = (args.candidate if bootstrap else args.base) / 'scripts/airest-gate'
    hashes = {}
    for name, expected in ACCEPTED.items():
        path = suite / name
        hashes[name] = hashlib.sha256(path.read_bytes()).hexdigest() if path.is_file() else None
        if hashes[name] != expected:
            errors.append('بصمة الأداة: ' + name)
    result = {'base_sha': base_sha, 'candidate_sha': candidate_sha, 'bootstrap': bootstrap,
              'changed_files': names, 'tool_sha256': hashes, 'rejected': errors,
              'exit_code': 1 if errors else 0}
    (args.out / 'integrity.json').write_text(json.dumps(result, ensure_ascii=False, indent=2))
    print(json.dumps(result, ensure_ascii=False))
    return result['exit_code']


if __name__ == '__main__':
    raise SystemExit(main())
