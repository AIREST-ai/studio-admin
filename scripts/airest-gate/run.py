"""يبني المرشح في نسختين مستقلتين ويشغّل أداة القبول الأصلية."""
import argparse
import base64
import io
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import sys
import tarfile
import time
from urllib.request import urlopen

from check import build_input_manifest, compare_build_inputs
from guard import ACCEPTED
import hashlib


def save(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2))


def build_env():
    env = {k: v for k, v in os.environ.items() if k in
           ['PATH', 'HOME', 'TMPDIR', 'LANG', 'LC_ALL', 'NODE_OPTIONS']}
    env['NEXT_TELEMETRY_DISABLED'] = '1'
    return env


def command(argv, cwd, out, name, timeout=600):
    with (out / (name + '.log')).open('w') as log:
        try:
            proc = subprocess.run(argv, cwd=cwd, env=build_env(), stdout=log,
                                  stderr=subprocess.STDOUT, timeout=timeout)
            result = {'command': argv, 'exit_code': proc.returncode}
        except subprocess.TimeoutExpired:
            result = {'command': argv, 'exit_code': 1, 'timeout': timeout}
    save(out / (name + '.json'), result)
    print(name, result['exit_code'], flush=True)
    if result['exit_code'] != 0:
        raise RuntimeError('فشل ' + name)


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--candidate', type=Path, required=True)
    ap.add_argument('--work', type=Path, required=True)
    ap.add_argument('--hidden', type=Path)
    args = ap.parse_args()
    args.work.mkdir(parents=True, exist_ok=False)
    out = args.work / 'evidence'
    out.mkdir()
    private = args.work / 'private'
    private.mkdir(mode=0o700)
    source = args.work / 'source'
    preview = args.work / 'preview-build'
    build = args.work / 'acceptance-build'
    server = None
    server_log = None
    result = {'exit_code': 1, 'acceptance_exit_code': None, 'preview_ready': False,
              'missing': [], 'error': None}
    if not ((args.hidden and args.hidden.is_file()) or os.environ.get('AIREST_GATE_HIDDEN_CASES_B64')):
        result['missing'].append('الحالات المخفية')
    for key in ['AIREST_TEST_EMAIL', 'AIREST_TEST_PASSWORD']:
        if not os.environ.get(key):
            result['missing'].append(key)
    try:
        for name, expected in ACCEPTED.items():
            if hashlib.sha256((Path(__file__).parent / name).read_bytes()).hexdigest() != expected:
                raise RuntimeError('بصمة أداة القبول غير مطابقة')
        sha = subprocess.check_output(['git', '-C', str(args.candidate), 'rev-parse', 'HEAD'],
                                      text=True).strip()
        result['candidate_sha'] = sha
        archive = subprocess.check_output(['git', '-C', str(args.candidate), 'archive', sha])
        source.mkdir()
        with tarfile.open(fileobj=io.BytesIO(archive)) as bundle:
            bundle.extractall(source, filter='data')
        shutil.copytree(source, preview)
        shutil.copytree(source, build)
        inputs = build_input_manifest(source)
        result['source_inputs_sha256'] = inputs['sha256']
        save(out / 'source-inputs.json', inputs)
        for root, name in [(preview, 'preview'), (build, 'acceptance')]:
            comparison = compare_build_inputs(source, root)
            save(out / (name + '-inputs.json'), comparison)
            if not comparison['matches']:
                raise RuntimeError('مدخلات البناء غير مطابقة')
            command(['npm', 'ci'], root, out, name + '-npm-ci')
            comparison = compare_build_inputs(source, root)
            if not comparison['matches']:
                raise RuntimeError('تغيرت مدخلات البناء أثناء تثبيت الحزم')
        command(['npm', 'run', 'build'], preview, out, 'preview-build')
        # ملف تعريف نكست المولّد مخرج بناء؛ المدخلات الأصلية كلها يجب أن تبقى مطابقة.
        after = build_input_manifest(preview)
        changed = [name for name, digest in inputs['files'].items()
                   if after['files'].get(name) != digest]
        extra = sorted(after['files'].keys() - inputs['files'].keys())
        save(out / 'preview-after-build.json', {'changed_inputs': changed, 'generated': extra})
        if changed or any(name != 'next-env.d.ts' for name in extra):
            raise RuntimeError('تغيرت مدخلات المعاينة أثناء البناء')
        with socket.socket() as probe:
            probe.bind(('127.0.0.1', 0))
            port = probe.getsockname()[1]
        url = 'http://127.0.0.1:' + str(port)
        argv = ['npm', 'run', 'start', '--', '--hostname', '127.0.0.1', '--port', str(port)]
        server_log = (out / 'preview.log').open('w')
        server = subprocess.Popen(argv, cwd=preview, env=build_env(), stdout=server_log,
                                  stderr=subprocess.STDOUT, start_new_session=True)
        deadline = time.monotonic() + 90
        while time.monotonic() < deadline and server.poll() is None:
            try:
                with urlopen(url + '/auth/v2/login', timeout=2) as response:
                    if response.status == 200:
                        result['preview_ready'] = True
                        break
            except Exception:
                time.sleep(0.5)
        save(out / 'preview-service.json', {'candidate_sha': sha, 'command': argv,
             'pid': server.pid, 'url': url, 'ready': result['preview_ready'],
             'inputs_sha256': inputs['sha256']})
        if not result['preview_ready'] or server.poll() is not None:
            raise RuntimeError('خدمة المعاينة لم تبدأ')
        hidden = args.hidden
        encoded = os.environ.get('AIREST_GATE_HIDDEN_CASES_B64')
        if encoded and hidden is None:
            hidden = private / 'cases.py'
            hidden.write_bytes(base64.b64decode(encoded, validate=True))
            hidden.chmod(0o600)
        if hidden is None or not hidden.is_file():
            hidden = private / 'missing-cases.py'
        # البناء لا يرث جلسة الاختبار. لا يمررها إلا للفاحص بعد قيام المعاينة.
        checker_env = build_env()
        for key in ['AIREST_TEST_EMAIL', 'AIREST_TEST_PASSWORD', 'PLAYWRIGHT_BROWSERS_PATH']:
            if key in os.environ:
                checker_env[key] = os.environ[key]
        argv = [sys.executable, str(Path(__file__).with_name('check.py').resolve()),
                '--source', str(source.resolve()), '--build-copy', str(build.resolve()),
                '--url', url, '--out', str((out / 'acceptance').resolve()),
                '--hidden', str(hidden.resolve())]
        result['acceptance_command'] = argv
        with (out / 'acceptance.log').open('w') as log:
            proc = subprocess.run(argv, env=checker_env, stdout=log, stderr=subprocess.STDOUT,
                                  timeout=900)
        result['acceptance_exit_code'] = proc.returncode
        report_path = out / 'acceptance/report.json'
        report = json.loads(report_path.read_text()) if report_path.is_file() else None
        final_preview = build_input_manifest(preview)
        unchanged = final_preview == after and build_input_manifest(source) == inputs
        result['inputs_unchanged'] = unchanged
        if (report and proc.returncode == 0 and report['exit_code'] == 0
                and report['result_integrity']['valid'] and not result['missing']
                and unchanged and server.poll() is None):
            result['exit_code'] = 0
    except Exception as error:
        # لا ننشر جسم استجابة أو مدخلات جلسة؛ رسالة نقص أو خطأ عام فقط.
        result['error'] = str(error) if isinstance(error, RuntimeError) else type(error).__name__
    finally:
        if server is not None and server.poll() is None:
            import signal
            os.killpg(server.pid, signal.SIGTERM)
            try:
                server.wait(timeout=10)
            except subprocess.TimeoutExpired:
                os.killpg(server.pid, signal.SIGKILL)
                server.wait()
        if server_log is not None:
            server_log.close()
        # صور جلسة الاختبار تبقى خاصة، ولا تدخل مخرجات سير العمل العامة.
        images = out / 'acceptance'
        if images.exists():
            for path in images.glob('*.png'):
                shutil.move(str(path), private / path.name)
        save(out / 'summary.json', result)
        print(json.dumps(result, ensure_ascii=False), flush=True)
    return result['exit_code']


if __name__ == '__main__':
    raise SystemExit(main())
