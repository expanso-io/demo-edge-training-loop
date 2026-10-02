# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Render the fixed local topology into reviewable Cloud job files."""
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent


def header(name, role, site=None):
    result = f'''name: train-loop-{name}
description: Local conversation learning - {name}
type: pipeline
selector:
  match_labels:
    demo: demo-edge-training-loop
    role: {role}
'''
    if site:
        result += f'    site: {site}\n'
    return result + 'config:\n'


def output(url):
    return f'''  output:
    reject_errored:
      http_client:
        url: {url}
        verb: POST
        headers:
          Content-Type: application/json
        timeout: 300s
        retries: 10
        retry_period: 5s
'''


for site, port in [('north', 18101), ('south', 18102)]:
    text = header(f'collect-{site}', 'site', site) + f'''  input:
    http_server:
      address: 127.0.0.1:{port}
      path: /transcript
      timeout: 300s
  pipeline:
    processors:
      - log:
          level: INFO
          message: 'Transcript received id=${{! this.id }} site={site}'
''' + output('http://127.0.0.1:18110/transcript')
    (ROOT / 'pipelines' / f'collect-{site}.yaml').write_text(text)

text = header('teacher', 'training') + '''  input:
    http_server:
      address: 0.0.0.0:18110
      path: /transcript
      timeout: 300s
  pipeline:
    threads: 1
    processors:
      - log:
          level: INFO
          message: 'Teacher starting id=${! this.id }'
      - http:
          url: http://127.0.0.1:8025/grade
          verb: POST
          headers:
            Content-Type: application/json
          timeout: 240s
          retries: 10
          retry_period: 5s
      - log:
          level: INFO
          message: 'Teacher result id=${! this.id } error=${! error() }'
''' + output('http://127.0.0.1:8025/review')
(ROOT / 'pipelines' / 'teacher.yaml').write_text(text)

text = header('training-trigger', 'training') + '''  input:
    # Timer only. Conversation data enters through the site inputs.
    generate:
      interval: 10s
      mapping: 'root = {"trigger": "schedule"}'
  pipeline:
    processors:
      - http:
          url: http://127.0.0.1:8025/tick
          verb: POST
          headers:
            Content-Type: application/json
          retries: 10
          retry_period: 5s
      - log:
          level: INFO
          message: 'Training status=${! this.status } error=${! error() }'
  output:
    reject_errored:
      file:
        path: /data/training-receipts.jsonl
        codec: lines
'''
(ROOT / 'pipelines' / 'training-trigger.yaml').write_text(text)

for site, port in [('north', 8026), ('south', 8027)]:
    text = header(f'rollout-{site}', 'site', site) + f'''  input:
    http_client:
      url: http://127.0.0.1:8025/bundle/{site}
      rate_limit: rollout_poll
      retries: 10
      retry_period: 5s
  rate_limit_resources:
    - label: rollout_poll
      local:
        count: 1
        interval: 5s
  pipeline:
    processors:
      - http:
          url: http://127.0.0.1:{port}/install
          verb: POST
          headers:
            Content-Type: application/json
          timeout: 120s
          retries: 10
          retry_period: 5s
      - log:
          level: INFO
          message: 'Release site={site} error=${{! error() }}'
''' + output('http://127.0.0.1:8025/receipt')
    (ROOT / 'pipelines' / f'rollout-{site}.yaml').write_text(text)
