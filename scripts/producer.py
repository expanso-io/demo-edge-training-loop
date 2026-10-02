# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""External conversation producer: inference, then a real Expanso input."""
import argparse
import json
import time
import urllib.request
import urllib.error

from corpus import TRAIN


def post(url, payload):
    request = urllib.request.Request(url, data=json.dumps(payload).encode(),
                                     headers={'Content-Type': 'application/json'})
    for attempt in range(12):
        try:
            with urllib.request.urlopen(request, timeout=360) as response:
                body = response.read()
                return json.loads(body) if body else None
        except urllib.error.HTTPError as error:
            if error.code not in (429, 502, 503, 504) or attempt == 11:
                raise
            time.sleep(5)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--count', type=int, default=len(TRAIN))
    parser.add_argument('--run', default='recording')
    args = parser.parse_args()
    if not 1 <= args.count <= len(TRAIN):
        parser.error(f'count must be 1 to {len(TRAIN)}')
    for index, (kind, prompt) in enumerate(TRAIN[:args.count]):
        site = 'north' if index % 2 == 0 else 'south'
        model_port = 8026 if site == 'north' else 8027
        pipeline_port = 18101 if site == 'north' else 18102
        record = post(f'http://127.0.0.1:{model_port}/infer', {
            'id': f'{args.run}-{index + 1:02}', 'kind': kind, 'prompt': prompt})
        post(f'http://127.0.0.1:{pipeline_port}/transcript', record)
        print(f"received {record['id']} from {site}", flush=True)


if __name__ == '__main__':
    main()
