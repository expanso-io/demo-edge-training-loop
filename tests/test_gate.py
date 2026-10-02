"""Fail-closed release and training data isolation checks."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / 'scripts'))
from corpus import HELD_OUT, TRAIN, passes
from gate import improved, training_fingerprint


def evaluated(passing):
    return {'outputs': [{'prompt': prompt, 'answer': 'actual output', 'pass': i in passing}
                        for i, (_, prompt) in enumerate(HELD_OUT)]}


class GateTests(unittest.TestCase):
    def test_improvement_requires_no_regression(self):
        self.assertTrue(improved(evaluated({0}), evaluated({0, 1})))
        self.assertFalse(improved(evaluated({0}), evaluated({1, 2})))
        self.assertFalse(improved(evaluated({0}), evaluated({0})))
        self.assertFalse(improved(evaluated({0, 1}), evaluated({0})))

    def test_same_complete_held_out_set(self):
        missing = evaluated({0, 1})
        missing['outputs'].pop()
        self.assertFalse(improved(evaluated({0}), missing))
        wrong = evaluated({0, 1})
        wrong['outputs'][0]['prompt'] = 'different prompt'
        self.assertFalse(improved(evaluated({0}), wrong))

    def test_empty_answer_cannot_pass(self):
        result = evaluated({0, 1})
        result['outputs'][1]['answer'] = ''
        self.assertFalse(improved(evaluated({0}), result))

    def test_training_and_evaluation_are_disjoint(self):
        self.assertFalse({p for _, p in TRAIN} & {p for _, p in HELD_OUT})
        row = {'id': 'one', 'prompt': TRAIN[0][1], 'target': 'Please provide your order number.', 'status': 'approved'}
        self.assertEqual(len(training_fingerprint([row])), 64)
        with self.assertRaises(ValueError):
            training_fingerprint([row, row])
        with self.assertRaises(ValueError):
            training_fingerprint([{**row, 'prompt': HELD_OUT[0][1]}])
        with self.assertRaises(ValueError):
            training_fingerprint([{**row, 'status': 'pending'}])

    def test_policy_rubric_rejects_completed_action_claim(self):
        self.assertTrue(passes('refund', 'Please provide your order number.'))
        self.assertFalse(passes('refund', 'I have refunded the order number you provided.'))
        self.assertFalse(passes('booking', 'Your order number?'))


if __name__ == '__main__':
    unittest.main()
