"""Durable event journal. All records stay in the local customer environment."""
import json
import os
import sqlite3
import time
from contextlib import contextmanager
from pathlib import Path

STATE = Path(os.environ.get('TRAIN_STATE', '.runtime/state')).resolve()
STATE.mkdir(parents=True, exist_ok=True, mode=0o700)
DB = STATE / 'loop.sqlite'


@contextmanager
def connect():
    db = sqlite3.connect(DB, timeout=30)
    db.row_factory = sqlite3.Row
    try:
        yield db
        db.commit()
    finally:
        db.close()


def init():
    with connect() as db:
        db.executescript('''
        CREATE TABLE IF NOT EXISTS records (
          id TEXT PRIMARY KEY, site TEXT NOT NULL, prompt TEXT NOT NULL,
          answer TEXT NOT NULL, kind TEXT NOT NULL, version TEXT NOT NULL,
          status TEXT NOT NULL, teacher TEXT, target TEXT, reviewed_at REAL
        );
        CREATE TABLE IF NOT EXISTS events (
          seq INTEGER PRIMARY KEY AUTOINCREMENT, at REAL, stage TEXT, message TEXT
        );
        CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
        ''')
        for key, value in [('mode', 'Local model preparation'), ('rounds', []),
                           ('training', {'status': 'idle'}),
                           ('sites', {'north': 'base', 'south': 'base'})]:
            db.execute('INSERT OR IGNORE INTO settings VALUES (?, ?)',
                       (key, json.dumps(value)))
    DB.chmod(0o600)


def get(key):
    with connect() as db:
        row = db.execute('SELECT value FROM settings WHERE key=?', (key,)).fetchone()
        return json.loads(row['value']) if row else None


def put(key, value):
    with connect() as db:
        db.execute('INSERT OR REPLACE INTO settings VALUES (?, ?)', (key, json.dumps(value)))


def event(stage, message):
    with connect() as db:
        db.execute('INSERT INTO events(at,stage,message) VALUES (?,?,?)',
                   (time.time(), stage, message))


def records():
    with connect() as db:
        rows = db.execute('SELECT * FROM records ORDER BY rowid').fetchall()
    result = []
    for row in rows:
        item = dict(row)
        item['teacher'] = json.loads(item['teacher']) if item['teacher'] else None
        result.append(item)
    return result


def snapshot():
    with connect() as db:
        events = [dict(r) for r in db.execute('SELECT * FROM events ORDER BY seq DESC LIMIT 12')]
    return {'records': records(), 'events': events, 'mode': get('mode'),
            'sites': get('sites'), 'site_checks': get('site_checks'), 'rollback': get('rollback'), 'rounds': get('rounds'), 'training': get('training')}
