"""Simulator delivery and finite replay contract."""
import sys
import unittest
import urllib.error
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / 'scripts'))
import producer

class ProducerTests(unittest.TestCase):
    def test_failed_submission_reuses_original_answer(self):
        calls = []
        answer = {'id': 'captured', 'answer': 'original'}
        def post(url, data):
            calls.append((url, data))
            if len(calls) == 2:
                raise urllib.error.URLError('input not ready')
            return answer
        with patch.object(sys, 'argv', ['producer', '--continuous']), patch.object(producer, 'post', side_effect=post), patch.object(producer.time, 'sleep', side_effect=[None, StopIteration]):
            with self.assertRaises(StopIteration):
                producer.main()
        self.assertEqual(len(calls), 3)
        self.assertEqual(calls[1][0], calls[2][0])
        self.assertIs(calls[1][1], calls[2][1])

    def test_weather_sample_is_explicit_and_sites_alternate(self):
        calls = []
        def post(url, data):
            calls.append((url, data))
            return {'id': data.get('id', 'receipt')}
        with patch.object(sys, 'argv', ['producer', '--continuous']), patch.object(producer, 'post', side_effect=post), patch.object(producer.time, 'sleep', side_effect=[None, StopIteration]):
            with self.assertRaises(StopIteration):
                producer.main()
        self.assertIn('8026/infer', calls[0][0])
        self.assertIn('8027/infer', calls[2][0])
        self.assertEqual(calls[0][1]['prompt'], producer.TRAIN[0][1])
        self.assertEqual(calls[2][1]['prompt'], 'What will the weather be tomorrow?')
        self.assertNotEqual(calls[0][1]['id'], calls[2][1]['id'])

    def test_finite_recording_ids_remain_stable(self):
        with patch.object(sys, 'argv', ['producer', '--count', '1']), patch.object(producer, 'post', return_value={'id': 'recording-01'}) as post:
            producer.main()
        self.assertEqual(post.call_args_list[0].args[1]['id'], 'recording-01')

if __name__ == '__main__':
    unittest.main()
