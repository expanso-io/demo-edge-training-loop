"""Release rules shared by training and the tests."""
import hashlib
import json

from corpus import HELD_OUT


def training_fingerprint(rows):
    held_out = {prompt for _, prompt in HELD_OUT}
    ids = [row['id'] for row in rows]
    if len(ids) != len(set(ids)):
        raise ValueError('Duplicate training record')
    if any(row['prompt'] in held_out for row in rows):
        raise ValueError('Held-out prompt cannot enter training')
    if any(row['status'] != 'approved' or not row['target'] for row in rows):
        raise ValueError('Only approved targets may enter training')
    return hashlib.sha256(json.dumps([(r['id'], r['target']) for r in rows]).encode()).hexdigest()


def improved(baseline, candidate):
    old = baseline['outputs']
    new = candidate['outputs']
    if len(old) != len(HELD_OUT) or len(new) != len(old):
        return False
    expected = [prompt for _, prompt in HELD_OUT]
    if [r['prompt'] for r in old] != expected or [r['prompt'] for r in new] != expected:
        return False
    if any(not isinstance(r['pass'], bool) or not r['answer'].strip() for r in old + new):
        return False
    regression = any(a['pass'] and not b['pass'] for a, b in zip(old, new, strict=True))
    return sum(r['pass'] for r in new) > sum(r['pass'] for r in old) and not regression
