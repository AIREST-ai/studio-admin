"""فحص محدود لبوابة النتائج ومدخلات البناء، بلا تشغيل الموقع أو قراءة الحالات المخفية."""
import copy
from pathlib import Path
import tempfile
import unittest

from check import acceptance_outcome, build_input_manifest, compare_build_inputs, Unproven


def results(prefix, count):
    return [{'id': f'{prefix}{n:02}', 'status': 'passed'} for n in range(1, count + 1)]


class ResultGateTests(unittest.TestCase):
    def setUp(self):
        self.public = results('P', 12)
        self.hidden = results('H', 4)

    def outcome(self, public=None, hidden=None, unchanged=True):
        return acceptance_outcome(self.public if public is None else public,
                                  self.hidden if hidden is None else hidden, unchanged)

    def test_complete_unique_passes(self):
        code, integrity = self.outcome()
        self.assertEqual(code, 0)
        self.assertTrue(integrity['valid'])

    def test_empty_partial_or_absent_result_fails(self):
        for count in range(4):
            with self.subTest(hidden_count=count):
                self.assertEqual(self.outcome(hidden=self.hidden[:count])[0], 1)
        for index in range(12):
            with self.subTest(public_missing=index):
                self.assertEqual(self.outcome(public=self.public[:index] + self.public[index + 1:])[0], 1)

    def test_duplicate_ids_fail_even_at_expected_count(self):
        for name in ['public', 'hidden']:
            sample = copy.deepcopy(getattr(self, name))
            sample[-1] = copy.deepcopy(sample[0])
            code, integrity = self.outcome(**{name: sample})
            self.assertEqual(code, 1)
            self.assertTrue(integrity[name]['duplicates'])

    def test_extra_unknown_or_wrong_group_fails(self):
        for sample in [self.hidden + [self.hidden[0]], self.hidden[:-1] + [{'id': 'H99', 'status': 'passed'}],
                       self.hidden[:-1] + [{'id': 'P01', 'status': 'passed'}]]:
            with self.subTest(sample=sample):
                self.assertEqual(self.outcome(hidden=sample)[0], 1)

    def test_invalid_status_or_result_fails(self):
        for item in [{'id': 'H04'}, {'id': 'H04', 'status': 'skipped'}, {'status': 'passed'}, None]:
            with self.subTest(item=item):
                self.assertEqual(self.outcome(hidden=self.hidden[:-1] + [item])[0], 1)

    def test_failure_unproven_and_input_change_still_block(self):
        for status, expected in [('failed', 1), ('unproven', 2)]:
            sample = copy.deepcopy(self.hidden)
            sample[-1]['status'] = status
            self.assertEqual(self.outcome(hidden=sample)[0], expected)
        self.assertEqual(self.outcome(unchanged=False)[0], 1)


class BuildInputsTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.source = Path(self.temp.name) / 'source'
        self.build = Path(self.temp.name) / 'build'
        self.inputs = ['src/app/page.tsx', 'package.json', 'package-lock.json', 'next.config.mjs',
                       'tsconfig.json', 'tsconfig.scripts.json', 'next-env.d.ts', 'postcss.config.mjs',
                       'public/logo.svg', 'media/screen.webp', 'scripts/build.mjs']
        for root in [self.source, self.build]:
            for name in self.inputs:
                path = root / name
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text('fixture:' + name)

    def test_equal_snapshot_passes(self):
        result = compare_build_inputs(self.source, self.build)
        self.assertTrue(result['matches'])
        self.assertEqual(set(result['source']['files']), set(self.inputs))

    def test_each_changed_build_input_is_detected(self):
        for name in self.inputs:
            with self.subTest(path=name):
                path = self.build / name
                original = path.read_bytes()
                path.write_bytes(original + b' changed')
                result = compare_build_inputs(self.source, self.build)
                self.assertFalse(result['matches'])
                self.assertIn(name, result['differences']['changed'])
                path.write_bytes(original)

    def test_missing_and_extra_assets_are_detected(self):
        path = self.build / 'media/screen.webp'
        path.rename(self.build / 'media/extra.webp')
        result = compare_build_inputs(self.source, self.build)
        self.assertFalse(result['matches'])
        self.assertEqual(result['differences']['missing'], ['media/screen.webp'])
        self.assertEqual(result['differences']['extra'], ['media/extra.webp'])

    def test_secret_and_output_changes_are_excluded(self):
        before = build_input_manifest(self.source)
        for name in ['.env.local', 'src/.env.test', 'src/secrets/token.json', '.next/server/page.js',
                     'node_modules/package/index.js', 'tsconfig.tsbuildinfo', 'public/key.pem']:
            path = self.source / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text('synthetic excluded data')
        self.assertEqual(build_input_manifest(self.source), before)

    def test_missing_lock_or_linked_inputs_are_unproven(self):
        lock = self.source / 'package-lock.json'
        lock.rename(self.source / 'saved.lock')
        with self.assertRaises(Unproven):
            build_input_manifest(self.source)
        (self.source / 'saved.lock').rename(lock)
        (self.source / 'public/linked.svg').symlink_to(self.source / 'public/logo.svg')
        with self.assertRaises(Unproven):
            build_input_manifest(self.source)


if __name__ == '__main__':
    unittest.main(verbosity=2)
