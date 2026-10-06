"""Selection uses durable local records; tests never load models or start servers."""
import json
import os
import sys
import tempfile
import types
import unittest
from pathlib import Path
from unittest.mock import patch

SCRATCH = Path('/Users/daaronch/code/second-brain/.codex-work/2026-10-04/review-selection-tests')
SCRATCH.mkdir(parents=True, exist_ok=True)
os.environ['TRAIN_STATE'] = str(SCRATCH)
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / 'scripts'))
learning = types.ModuleType('learning')
learning.answer = lambda *args: (_ for _ in ()).throw(AssertionError('Model called'))
learning.train = learning.answer
sys.modules['learning'] = learning
import service
import store
from corpus import TRAIN, HELD_OUT, MIN_TRAINING

TARGET = 'Could you please provide your order number?'


class SelectionTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory(dir=SCRATCH)
        self.original_db = store.DB
        store.DB = Path(self.directory.name) / 'test.sqlite'
        store.init()

    def tearDown(self):
        store.DB = self.original_db
        self.directory.cleanup()

    def add(self, identity, index=0, status='graded', prompt=None, answer='Sorry, I cannot help.'):
        kind, authored = TRAIN[index]
        teacher = {'confidence': 0.90, 'verdict': 'fail',
                   'corrected_target': TARGET, 'rationale': 'Missing reference'}
        with store.connect() as db:
            db.execute('INSERT INTO records '
                       '(id,site,prompt,answer,kind,version,status,teacher,target) '
                       'VALUES (?,?,?,?,?,?,?,?,?)',
                       (identity, 'north', prompt or authored, answer, kind, 'base',
                        status, json.dumps(teacher), TARGET))

    def status(self, identity):
        return next(row['status'] for row in store.records() if row['id'] == identity)

    def test_duplicate_never_grows_queue_after_any_review_decision(self):
        for status in ('grading', 'graded', 'pending', 'approved', 'discarded'):
            with self.subTest(status=status):
                with store.connect() as db:
                    db.execute('DELETE FROM records')
                self.add('first', status=status)
                self.add('repeat')
                self.assertEqual(service.review({'id': 'repeat'})['status'], 'duplicate')
                self.assertEqual(service.review({'id': 'repeat'})['status'], 'duplicate')

    def test_correct_original_is_excluded(self):
        self.add('good', answer=TARGET)
        self.assertEqual(service.review({'id': 'good'})['status'], 'excluded')

    def test_training_starts_only_at_minimum_unique_approved_batch(self):
        for index in range(MIN_TRAINING - 1):
            self.add(str(index), index=index, status='approved')
        self.assertEqual(service.tick({})['status'], 'rejected')
        self.add('boundary', index=MIN_TRAINING - 1, status='approved')
        with patch.object(service.threading, 'Thread') as worker:
            self.assertEqual(service.tick({})['status'], 'started')
            worker.return_value.start.assert_called_once()
        self.assertEqual(len(worker.call_args.kwargs['args'][0]), MIN_TRAINING)

    def test_unsupported_and_held_out_are_pending_but_never_approved(self):
        for prompt in ('Please delete my account.', HELD_OUT[0][1]):
            self.add(prompt, prompt=prompt)
            self.assertEqual(service.review({'id': prompt})['status'], 'pending')
            with self.assertRaisesRegex(ValueError, 'outside'):
                service.approve({'id': prompt, 'target': TARGET})
            self.assertEqual(service.discard({'id': prompt})['status'], 'discarded')
            with self.assertRaises(ValueError):
                service.discard({'id': prompt})

    def test_batch_is_atomic_and_validates_rubric(self):
        self.add('one', status='pending')
        self.add('two', index=1, status='pending')
        with self.assertRaises(ValueError):
            service.approve_batch({'items': [{'id': 'one', 'target': TARGET},
                                            {'id': 'two', 'target': 'I have refunded you.'}]})
        self.assertEqual(self.status('one'), 'pending')
        self.assertEqual(self.status('two'), 'pending')
        result = service.approve_batch({'items': [{'id': 'one', 'target': TARGET},
                                                 {'id': 'two', 'target': TARGET}]})
        self.assertEqual(result['ids'], ['one', 'two'])
        self.assertTrue(all(row['reviewed_at'] for row in store.records()))

    def test_repeated_batch_ids_and_requests_rejected(self):
        self.add('one', status='pending')
        for items in ([{'id': 'one', 'target': TARGET}] * 2, []):
            with self.assertRaises(ValueError):
                service.approve_batch({'items': items})
        self.add('two', status='pending')
        with self.assertRaises(ValueError):
            service.approve({'id': 'two', 'target': TARGET})
        self.assertEqual(self.status('one'), 'pending')

    def test_grade_bypasses_model_for_unsuitable_correct_and_duplicate(self):
        self.add('first', status='discarded')
        inputs = [('outside', 'Please delete my account.', 'Bad answer'),
                  ('correct', TRAIN[1][1], TARGET),
                  ('repeat', TRAIN[0][1], 'Bad answer')]
        with patch.object(service, 'request_json', side_effect=AssertionError('Teacher called')):
            for identity, prompt, answer in inputs:
                result = service.grade({'id': identity, 'kind': 'refund', 'site': 'north',
                                        'prompt': prompt, 'answer': answer, 'version': 'base'})
                self.assertEqual(result['teacher']['corrected_target'], '')
                self.assertTrue(result['teacher']['rationale'])
                self.assertEqual(result['teacher']['source'], 'selection')
                self.assertEqual(result['teacher']['confidence'], 0)
        self.assertEqual(service.review({'id': 'outside'})['status'], 'pending')
        self.assertEqual(service.review({'id': 'correct'})['status'], 'excluded')
        self.assertEqual(service.review({'id': 'repeat'})['status'], 'duplicate')

    def test_repeated_unsupported_request_is_selected_out(self):
        payload = {'kind': 'refund', 'site': 'north', 'prompt': 'Please delete my account.',
                   'answer': 'Sorry.', 'version': 'base'}
        with patch.object(service, 'request_json', side_effect=AssertionError('Teacher called')):
            service.grade({**payload, 'id': 'outside-first'})
            self.assertEqual(service.review({'id': 'outside-first'})['status'], 'pending')
            result = service.grade({**payload, 'id': 'outside-repeat'})
            self.assertIn('Repeated request', result['teacher']['rationale'])
            self.assertEqual(service.review({'id': 'outside-repeat'})['status'], 'duplicate')
        with store.connect() as db:
            self.assertEqual(db.execute("SELECT COUNT(*) FROM events WHERE stage='teacher'").fetchone()[0], 0)
            self.assertEqual(db.execute("SELECT COUNT(*) FROM events WHERE stage='selection'").fetchone()[0], 2)

    def test_recorded_proof_teacher_never_calls_model(self):
        kind, prompt = TRAIN[0]
        payload = {'id': 'proof-01', 'kind': kind, 'site': 'north',
                   'prompt': prompt, 'answer': 'I cannot help.', 'version': 'base'}
        with patch.object(service, 'FIXTURE', True), \
             patch.object(service, 'request_json', side_effect=AssertionError('Model called')):
            result = service.grade(payload)
        self.assertEqual(result['teacher']['source'], 'recorded-proof')
        self.assertEqual(service.review({'id': payload['id']})['status'], 'approved')

    def test_unique_low_confidence_correction_stays_pending(self):
        self.add('one')
        self.assertEqual(service.review({'id': 'one'})['status'], 'pending')


if __name__ == '__main__':
    unittest.main()
