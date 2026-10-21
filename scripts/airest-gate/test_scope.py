"""عينات نطاق تركيب البوابة؛ لا تغير اختبارات المنتج."""
import hashlib
import json
from pathlib import Path
import subprocess
import tempfile
import unittest

from guard import SCOPE_SHA256
from scope import full_diff, load_scope, outside_scope, parse_diff


class ScopeTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.policy = load_scope(Path(__file__).with_name('approved-scope.json'), SCOPE_SHA256)

    def git(self, *args):
        return subprocess.check_output(['git', '-C', str(self.root), *args], stderr=subprocess.PIPE).decode().strip()

    def write(self, name, body):
        path = self.root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(body)

    def commit(self):
        self.git('add', '.')
        self.git('-c', 'user.name=Scope Fixture', '-c', 'user.email=fixture@example.invalid',
                 'commit', '-m', 'test: synthetic scope fixture\n\nCo-Authored-By: Paperclip <noreply@paperclip.ing>')
        return self.git('rev-parse', 'HEAD')

    def baseline(self):
        self.git('init', '-b', 'main')
        self.write('docs/airest-gate.md', 'synthetic baseline\n')
        self.write('src/existing.txt', 'synthetic inherited file\n')
        return self.commit()

    def test_two_commits_reject_first_violation(self):
        base = self.baseline()
        self.write('src/outside.txt', 'synthetic violation\n')
        first = self.commit()
        self.write('docs/airest-gate.md', 'synthetic allowed final commit\n')
        head = self.commit()
        last = full_diff(self.root, first, head)
        changes = full_diff(self.root, base, head)
        self.assertEqual(outside_scope(last, self.policy), [])
        self.assertEqual(outside_scope(changes, self.policy), ['src/outside.txt'])
        print(json.dumps({'sample': 'two-commits', 'base': base, 'first': first, 'head': head,
                          'full_diff': changes, 'last_commit': last, 'scope_exit_code': 1}), flush=True)

    def test_allowed_full_diff_passes(self):
        base = self.baseline()
        self.write('docs/airest-gate.md', 'synthetic allowed change\n')
        head = self.commit()
        changes = full_diff(self.root, base, head)
        self.assertTrue(changes)
        self.assertEqual(outside_scope(changes, self.policy), [])
        print(json.dumps({'sample': 'allowed', 'base': base, 'head': head,
                          'full_diff': changes, 'scope_exit_code': 0}), flush=True)

    def test_both_rename_paths_are_checked(self):
        for raw in [b'R100\0src/old.txt\0docs/airest-gate.md\0',
                    b'R100\0docs/airest-gate.md\0src/new.txt\0']:
            changes = parse_diff(raw)
            self.assertEqual(len(changes[0]['paths']), 2)
            self.assertEqual(len(outside_scope(changes, self.policy)), 1)

    def test_inherited_deletion_is_rejected(self):
        base = self.baseline()
        self.git('rm', 'src/existing.txt')
        head = self.commit()
        changes = full_diff(self.root, base, head)
        self.assertEqual(changes[0]['status'], 'D')
        self.assertEqual(outside_scope(changes, self.policy), ['src/existing.txt'])

    def test_unreadable_git_fails(self):
        with self.assertRaises(subprocess.CalledProcessError):
            full_diff(self.root, 'missing-base', 'missing-head')

    def test_missing_changed_or_partial_list_fails(self):
        path = self.root / 'policy.json'
        with self.assertRaises(FileNotFoundError):
            load_scope(path, SCOPE_SHA256)
        policy = dict(self.policy, paths=self.policy['paths'][:-1])
        path.write_text(json.dumps(policy))
        with self.assertRaises(ValueError):
            load_scope(path, hashlib.sha256(path.read_bytes()).hexdigest())
        path.write_text(json.dumps(dict(self.policy, paths=['src/**'] * 3)))
        with self.assertRaises(ValueError):
            load_scope(path, SCOPE_SHA256)

    def test_malformed_diff_fails(self):
        for raw in [b'A\0path', b'R100\0old\0', b'R100\0old\0\0', b'X\0path\0', b'M\0\xff\0']:
            with self.subTest(raw=raw), self.assertRaises((ValueError, UnicodeDecodeError)):
                parse_diff(raw)


if __name__ == '__main__':
    unittest.main(verbosity=2)
