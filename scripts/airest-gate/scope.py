"""يقارن فرق الطلب كله بقائمة ملفات المنسق الموثوقة."""
import hashlib
import json
from pathlib import PurePosixPath
import re
import subprocess


def load_scope(path, expected_sha256):
    raw = path.read_bytes()
    if hashlib.sha256(raw).hexdigest() != expected_sha256:
        raise ValueError('بصمة قائمة المنسق غير مطابقة')
    policy = json.loads(raw)
    paths = policy.get('paths')
    if (policy.get('schema') != 'airest.scope.v1'
            or policy.get('repository') != 'AIREST-ai/studio-admin'
            or policy.get('task') != 'CMP-315'
            or policy.get('revision') != 'd72100b1-cb6e-435d-bb45-14a6defb1c37'
            or not isinstance(paths, list) or len(paths) != 3
            or len(set(paths)) != 3 or any(not isinstance(p, str) for p in paths)):
        raise ValueError('قائمة المنسق ناقصة أو غير صالحة')
    for path in paths:
        prefix = path[:-3] if path.endswith('/**') else path
        if (not prefix or '*' in prefix or '?' in prefix or prefix.startswith('/')
                or '..' in PurePosixPath(prefix).parts):
            raise ValueError('مسار غير صالح في قائمة المنسق')
    return policy


def parse_diff(raw):
    if not raw:
        return []
    if not raw.endswith(b'\0'):
        raise ValueError('فرق الملفات ناقص')
    fields = raw.decode('utf-8', errors='strict').split('\0')[:-1]
    result = []
    index = 0
    while index < len(fields):
        status = fields[index]
        index += 1
        if not re.fullmatch(r'[AMDTU]|[RC][0-9]{1,3}', status):
            raise ValueError('حالة ملف غير صالحة')
        count = 2 if status[0] in 'RC' else 1
        paths = fields[index:index + count]
        if len(paths) != count or any(not p for p in paths):
            raise ValueError('فرق الملفات ناقص')
        result.append({'status': status, 'paths': paths})
        index += count
    return result


def full_diff(root, base_sha, candidate_sha):
    raw = subprocess.check_output(['git', '-C', str(root), 'diff', '--no-ext-diff',
        '--no-textconv', '--name-status', '-z', '--find-renames', base_sha, candidate_sha])
    return parse_diff(raw)


def outside_scope(changes, policy):
    def allowed(name):
        return any(name.startswith(path[:-2]) if path.endswith('/**') else name == path
                   for path in policy['paths'])
    return sorted({name for change in changes for name in change['paths'] if not allowed(name)})
