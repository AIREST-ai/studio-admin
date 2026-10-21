#!/usr/bin/env python3
"""فحص قبول مستقل؛ لا يغيّر مصدر الموقع ولا يصنع جلسة دخول."""
import argparse
from collections import Counter
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import subprocess
import time
from datetime import datetime, timezone, timedelta
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright

FORBIDDEN = re.compile(r"\bPlanner\b|\bAssistants\b|Captain Draft|مساحة الذكاء")
OLD_ROUTES = ['/dashboard/planner', '/dashboard/ai-workspace', '/dashboard/captain', '/dashboard/captain/assistants']
SMART = '/dashboard/captain/smart'
HOME = '/dashboard/default'
LOGIN = '/auth/v2/login'
PUBLIC_IDS = tuple(f'P{n:02}' for n in range(1, 13))
HIDDEN_IDS = tuple(f'H{n:02}' for n in range(1, 5))
BUILD_TREES = {'src', 'public', 'media', 'assets', 'fonts', 'styles', 'scripts', 'config', 'lib'}
BUILD_ROOT_SUFFIXES = {'.json', '.jsonc', '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.mts', '.cts', '.css', '.scss', '.sass', '.less'}
EXCLUDED_DIRS = {'.git', 'node_modules', '.next', 'dist', 'out', 'build', 'coverage',
                 '.turbo', '.cache', '__pycache__', '.preview-state', 'secrets', '.secrets'}


def excluded_input(path):
    return (any(part in EXCLUDED_DIRS for part in path.parts)
            or any(part.startswith('.env') for part in path.parts)
            or path.name in {'.npmrc', '.yarnrc', '.yarnrc.yml'}
            or path.suffix.lower() in {'.pem', '.key', '.p12', '.pfx', '.log', '.tsbuildinfo'})


class Unproven(Exception):
    pass


def require(ok, message):
    if not ok:
        raise AssertionError(message)


def strip_comments(text):
    text = re.sub(r'/\*.*?\*/', '', text, flags=re.S)
    return re.sub(r'^\s*//[^\n]*$', '', text, flags=re.M)


def fingerprint(root):
    h = hashlib.sha256()
    files = sorted(p for p in root.rglob('*') if p.is_file()) if root.exists() else []
    for p in files:
        h.update(str(p.relative_to(root)).encode())
        h.update(p.read_bytes())
    return {'sha256': h.hexdigest(), 'files': len(files)}


def build_input_manifest(root):
    """مدخلات مشروع أيرست؛ لا تقرأ الأسرار أو مخرجات البناء أو التبعيات المثبتة."""
    if not (root / 'src').is_dir() or not (root / 'package.json').is_file():
        raise Unproven('مجلد المصدر أو تعريف الحزمة مفقود')
    if not any((root / name).is_file() for name in ['package-lock.json', 'npm-shrinkwrap.json']):
        raise Unproven('ملف قفل حزم البناء مفقود')
    files = {}

    def collect(path):
        relative = path.relative_to(root)
        if excluded_input(relative):
            return
        if path.is_symlink():
            raise Unproven('مدخل بناء مرتبط خارج اللقطة؛ انسخه فعلياً: ' + relative.as_posix())
        if path.is_dir():
            for child in sorted(path.iterdir()):
                collect(child)
        elif path.is_file():
            files[relative.as_posix()] = hashlib.sha256(path.read_bytes()).hexdigest()

    for path in sorted(root.iterdir()):
        if (path.name in BUILD_TREES or path.suffix in BUILD_ROOT_SUFFIXES
                or path.name in {'.babelrc', '.browserslistrc', 'yarn.lock', 'pnpm-lock.yaml'}):
            collect(path)
    encoded = json.dumps(files, sort_keys=True, separators=(',', ':')).encode()
    return {'sha256': hashlib.sha256(encoded).hexdigest(), 'files': files}


def compare_build_inputs(source, build):
    original = build_input_manifest(source)
    copied = build_input_manifest(build)
    a, b = original['files'], copied['files']
    differences = {
        'missing': sorted(a.keys() - b.keys()),
        'extra': sorted(b.keys() - a.keys()),
        'changed': sorted(name for name in a.keys() & b.keys() if a[name] != b[name]),
    }
    return {'matches': not any(differences.values()), 'source': original, 'build': copied,
            'differences': differences}


def acceptance_outcome(public, hidden, unchanged):
    """عدد النتائج وهويتها جزء من القبول؛ الحالات المخفية هنا معرّفات فقط."""
    integrity = {}
    for name, results, expected in [('public', public, PUBLIC_IDS), ('hidden', hidden, HIDDEN_IDS)]:
        ids = [item.get('id') for item in results if isinstance(item, dict) and isinstance(item.get('id'), str)]
        counts = Counter(ids)
        integrity[name] = {
            'expected': len(expected), 'recorded': len(results),
            'missing': sorted(set(expected) - counts.keys()),
            'duplicates': sorted(key for key, count in counts.items() if count > 1),
            'unexpected': sorted(counts.keys() - set(expected)),
            'invalid_results': sum(not isinstance(item, dict) or not isinstance(item.get('id'), str)
                                   or item.get('status') not in {'passed', 'failed', 'unproven'} for item in results),
        }
    valid = all(item['recorded'] == item['expected'] and not any(item[key] for key in
                ['missing', 'duplicates', 'unexpected', 'invalid_results']) for item in integrity.values())
    integrity['valid'] = valid
    if not valid or not unchanged or any(item['status'] == 'failed' for item in public + hidden):
        return 1, integrity
    return (2 if any(item['status'] == 'unproven' for item in public + hidden) else 0), integrity


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--url', required=True)
    ap.add_argument('--source', type=Path, required=True)
    ap.add_argument('--build-copy', type=Path, required=True,
                    help='نسخة مستقلة للبناء؛ ممنوع مسار الإنتاج')
    ap.add_argument('--out', type=Path, required=True)
    ap.add_argument('--hidden', type=Path, default=Path(__file__).parent / 'private/cases.py')
    ap.add_argument('--build-timeout', type=int, default=600)
    ap.add_argument('--webpack', action='store_true')
    args = ap.parse_args()
    args.out.mkdir(parents=True, exist_ok=False)
    source = args.source.resolve()
    build = args.build_copy.resolve()
    public = []
    hidden = []
    state = {'page': None, 'authenticated': False, 'args': args, 'source': source,
             'base': args.url.rstrip('/'), 'out': args.out, 'page_errors': []}

    def check(code, title, fn, private=False):
        try:
            detail = fn()
            result = {'id': code, 'title': title, 'status': 'passed', 'detail': detail}
        except Unproven as e:
            result = {'id': code, 'title': title, 'status': 'unproven', 'detail': str(e)}
        except Exception as e:
            # لا نحفظ المدخلات أو جسم الاستجابة أو سجل شبكة قد يحمل جلسة.
            result = {'id': code, 'title': title, 'status': 'failed',
                      'detail': str(e).split('Call log:')[0][:700]}
        (hidden if private else public).append(result)
        print(code, result['status'], flush=True)

    before = fingerprint(source / 'src')

    def run_build():
        if build == source or build.name == 'نسخة-إنتاج-الاستوديو':
            raise Unproven('مسار البناء ليس نسخة مستقلة')
        inputs = compare_build_inputs(source, build)
        state['build_inputs_before'] = inputs['source']
        (args.out / 'build-inputs.json').write_text(json.dumps(inputs, ensure_ascii=False, indent=2))
        require(inputs['matches'], 'مدخلات نسخة البناء لا تطابق المصدر؛ راجع build-inputs.json')
        command = ['npm', 'run', 'build'] + (['--', '--webpack'] if args.webpack else [])
        # لا تمرر مفاتيح تشغيل الوكيل أو كلمات مرور الفحص إلى البناء.
        env = {k: v for k, v in os.environ.items() if k in
               ['PATH', 'HOME', 'TMPDIR', 'LANG', 'LC_ALL', 'NODE_OPTIONS']}
        env['NEXT_TELEMETRY_DISABLED'] = '1'
        with (args.out / 'build.log').open('w') as log:
            try:
                proc = subprocess.run(command, cwd=build, stdout=log, stderr=subprocess.STDOUT,
                                      env=env, timeout=args.build_timeout)
                result = {'command': command, 'exit_code': proc.returncode}
            except subprocess.TimeoutExpired:
                result = {'command': command, 'exit_code': None, 'timeout': args.build_timeout}
        (args.out / 'build-result.json').write_text(json.dumps(result, ensure_ascii=False, indent=2))
        require(result['exit_code'] == 0, 'فشل البناء؛ راجع build.log وbuild-result.json')
        return result

    check('P01', 'بناء نسخة مطابقة', run_build)

    def no_source_translation():
        hits = []
        patterns = re.compile(r'AutoTranslateAr|auto-translate-ar|google\.translate|translate\.google|data-translation-pending|lingo/dom-ar')
        files = list((source / 'src').rglob('*'))
        require(files, 'المصدر مفقود')
        for path in files:
            if path.suffix not in ['.ts', '.tsx', '.js', '.jsx']: continue
            text = path.read_text(errors='replace')
            text = strip_comments(text)
            if patterns.search(text): hits.append(str(path.relative_to(source)))
        require(not hits, 'طبقة ترجمة في: ' + ', '.join(hits[:12]))
        return {'source_files_scanned': len(files)}

    check('P07', 'غياب طبقة الترجمة من المصدر', no_source_translation)

    def old_source():
        hits = []
        app = source / 'src/app'
        require(app.exists(), 'مجلد الصفحات مفقود')
        for path in app.rglob('*'):
            if path.suffix not in ['.tsx', '.ts']: continue
            text = strip_comments(path.read_text(errors='replace'))
            # نصوص واجهة مقتبسة أو داخل عنصر؛ لا نطابق أسماء الأنواع والدوال.
            for match in re.finditer(r'(["\'`])([^"\'`\n]{1,200})\1|>([^<>{}\n]{1,200})<', text):
                value = match.group(2) or match.group(3)
                if FORBIDDEN.search(value):
                    hits.append(str(path.relative_to(source))); break
        require(not hits, 'نصوص الصفحات القديمة في: ' + ', '.join(hits[:15]))
        return 'غياب النصوص المحددة في مصدر واجهة الصفحات'

    check('P09', 'غياب نصوص الصفحات القديمة من المصدر', old_source)

    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        ctx = browser.new_context(viewport={'width': 1440, 'height': 1000}, locale='ar-QA')
        page = ctx.new_page()
        page.set_default_timeout(8000)
        page.on('pageerror', lambda e: state['page_errors'].append(str(e)[:200]))
        state['page'] = page
        translations = []
        page.on('request', lambda req: translations.append(urlparse(req.url).netloc)
                if re.search(r'translate\.google|translate\.googleapis|weglot|gtranslate', req.url) else None)

        def visit(path):
            response = page.goto(state['base'] + path, wait_until='networkidle', timeout=20000)
            require(response is not None and response.status < 400, 'الصفحة لم تفتح بنجاح')
            return response

        state['visit'] = visit

        def protected(path):
            if not state['authenticated']:
                raise Unproven('الدخول الحقيقي غير مثبت؛ لا نعدّ التحويل إلى الدخول نجاحاً للصفحة')
            visit(path)
            require('/auth/' not in urlparse(page.url).path, 'انتهت الجلسة أو أعيد التحويل إلى الدخول')

        state['protected'] = protected

        def entry():
            visit('/')
            require('/auth/' in urlparse(page.url).path, 'الزائر لم يصل إلى الدخول')
            require(page.locator('input[type=email]').is_visible(), 'حقل البريد مفقود')
            require(page.locator('input[type=password]').is_visible(), 'حقل كلمة المرور مفقود')
            page.screenshot(path=str(args.out / 'login-1440.png'), full_page=True)
            return {'path': urlparse(page.url).path, 'http': 200}

        check('P02', 'وصول الزائر إلى صفحة الدخول', entry)

        def login():
            email = os.environ.get('AIREST_TEST_EMAIL')
            password = os.environ.get('AIREST_TEST_PASSWORD')
            if not email or not password:
                raise Unproven('حساب اختبار مأذون غير متاح في متغيرات الفحص')
            visit(LOGIN + '?next=' + HOME)
            page.locator('input[type=email]').fill(email)
            page.locator('input[type=password]').fill(password)
            with page.expect_response(lambda r: '/api/studio-auth/login' in r.url and r.request.method == 'POST') as response:
                page.locator('form button[type=submit]').click()
            require(response.value.ok, 'الخادم لم يقبل الدخول')
            page.wait_for_url(re.compile(r'/dashboard/'), timeout=15000)
            require('/auth/' not in page.url, 'لم يكتمل انتقال الدخول')
            state['authenticated'] = True
            return {'login_http': response.value.status, 'destination': urlparse(page.url).path}

        check('P03', 'دخول حقيقي ثم انتقال للوحة', login)

        def home():
            protected(HOME)
            require(page.locator('main').is_visible(), 'محتوى الرئيسية مفقود')
            page.screenshot(path=str(args.out / 'home-1440.png'), full_page=True)
            return {'path': urlparse(page.url).path}

        check('P04', 'الصفحة الرئيسية بعد الدخول', home)

        def rtl(width):
            page.set_viewport_size({'width': width, 'height': 1000 if width == 1440 else 844})
            visit(LOGIN)
            require(page.locator('html').get_attribute('dir') == 'rtl', 'اتجاه الدخول غير صحيح')
            page.screenshot(path=str(args.out / f'login-{width}.png'), full_page=True)
            for path, name in [(HOME, 'home'), (SMART, 'smart')]:
                protected(path)
                require(page.locator('html').get_attribute('dir') == 'rtl', f'اتجاه الصفحة غير صحيح: {path}')
                page.screenshot(path=str(args.out / f'{name}-{width}.png'), full_page=True)
            return {'width': width, 'pages': 3}

        check('P05', 'اتجاه الصفحات بعرض ١٤٤٠', lambda: rtl(1440))
        check('P06', 'اتجاه الصفحات بعرض ٣٩٠', lambda: rtl(390))

        def no_runtime_translation():
            for path in [LOGIN, HOME, SMART]:
                if path == LOGIN: visit(path)
                else: protected(path)
                require(not translations, 'طلب شبكة لطبقة ترجمة')
                require(page.locator('[data-translation-pending],.goog-te-banner-frame,.goog-te-gadget').count() == 0,
                        'علامة ترجمة في الصفحة')
                # فحص حزم الصفحة أيضاً يلتقط الطبقة التي تؤجل تغيير النص حتى إكمال التحميل.
                for script in page.locator('script[src]').evaluate_all('(nodes) => nodes.map(n => n.src)'):
                    if urlparse(script).netloc != urlparse(state['base']).netloc: continue
                    body = ctx.request.get(script).text()
                    require(not re.search(r'data-translation-pending|translationSnapshot|google\.translate', body),
                            'طبقة ترجمة داخل حزمة متصفح محملة')
            return 'المسارات المعلنة وحزمها بلا العلامات المعروفة'

        check('P08', 'غياب الترجمة في المتصفح', no_runtime_translation)

        def old_runtime():
            for path in [HOME, SMART] + OLD_ROUTES:
                if not state['authenticated']: raise Unproven('لا جلسة لفحص الصفحات الداخلية')
                response = page.goto(state['base'] + path, wait_until='networkidle', timeout=20000)
                require('/auth/' not in page.url, 'تحويل إلى الدخول')
                require(response is not None and response.status < 500, 'خطأ خادم')
                if response.status in [404, 410] and path in OLD_ROUTES: continue
                require(not FORBIDDEN.search(page.locator('body').inner_text()), 'ظهر نص قديم في ' + path)
            return {'paths_checked': 2 + len(OLD_ROUTES)}

        check('P10', 'غياب الصفحات القديمة في المتصفح', old_runtime)

        def smart_visible():
            protected(SMART)
            require('سمارت' in page.locator('body').inner_text(), 'سمارت غير ظاهرة')
            require(page.get_by_role('button', name='استفسار', exact=True).is_visible(), 'زر سمارت مفقود')
            return {'path': urlparse(page.url).path}

        check('P11', 'وجود سمارت وأداتها', smart_visible)

        def smart_working():
            protected(SMART)
            before_errors = len(state['page_errors'])
            page.get_by_role('button', name='استفسار', exact=True).click()
            require(page.get_by_text('اسألني أي شيء في المحادثة بالأسفل:', exact=False).is_visible(), 'زر الاستفسار لم يظهر إجابته')
            require(len(state['page_errors']) == before_errors, 'خطأ متصفح عند تفاعل سمارت')
            page.screenshot(path=str(args.out / 'smart-interaction.png'), full_page=True)
            return 'استجابة واجهة سمارت مثبتة؛ ليست اختباراً لخدمة ذكاء خارجية'

        check('P12', 'تفاعل سمارت', smart_working)

        if args.hidden.exists():
            spec = importlib.util.spec_from_file_location('private_cases', args.hidden)
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            module.run(state, lambda code, title, fn: check(code, title, fn, private=True), require, Unproven)
        else:
            for n in range(4):
                hidden.append({'id': f'H{n+1:02}', 'status': 'unproven', 'detail': 'حزمة الحالات المخفية غير متاحة'})
        browser.close()

    after = fingerprint(source / 'src')
    unchanged = before == after
    inputs_unchanged = False
    try:
        inputs_unchanged = state.get('build_inputs_before') == build_input_manifest(source)
    except (Unproven, OSError):
        pass
    exit_code, integrity = acceptance_outcome(public, hidden, unchanged and inputs_unchanged)
    summary = {
        'schema': 'cmp-290.acceptance.v1',
        'observed_at': datetime.now(timezone(timedelta(hours=3))).isoformat(),
        'target_url': args.url, 'source': str(source), 'source_before': before,
        'source_after': after, 'source_unchanged': unchanged,
        'build_inputs_unchanged': inputs_unchanged, 'result_integrity': integrity,
        'browser': 'chromium', 'public': sorted(public, key=lambda x: x['id']),
        'hidden': {'count': len(hidden), **{s: sum(x['status'] == s for x in hidden)
                                          for s in ['passed', 'failed', 'unproven']}},
        'exit_code': exit_code,
        'limitation': 'مطابقة عنوان الخدمة مع هذه النسخة لا تثبتها بصمة المصدر وحدها؛ يلزم سجل نشر أو تشغيل معلوم.'
    }
    (args.out / 'report.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2))
    if args.hidden.exists():
        private_result = args.hidden.parent / (args.out.name + '-results.json')
        private_result.write_text(json.dumps(hidden, ensure_ascii=False, indent=2))
    print(json.dumps({'exit_code': exit_code, 'public_passed': sum(x['status'] == 'passed' for x in public),
                      'public_failed': sum(x['status'] == 'failed' for x in public),
                      'public_unproven': sum(x['status'] == 'unproven' for x in public),
                      'hidden': summary['hidden']}, ensure_ascii=False), flush=True)
    return exit_code


if __name__ == '__main__':
    raise SystemExit(main())
