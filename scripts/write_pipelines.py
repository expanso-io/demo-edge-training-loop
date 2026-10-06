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
    label: deliver_result
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
      - label: log_transcript
        log:
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
      - label: log_teacher_start
        log:
          level: INFO
          message: 'Teacher starting id=${! this.id }'
      - label: grade_transcript
        switch:
          - check: this.public_bar_fixture == true
            processors:
              - label: use_recorded_teacher_result
                mapping: root = this.expected_output
          - processors:
              - label: call_local_teacher
                http:
                  url: http://127.0.0.1:8025/grade
                  verb: POST
                  headers:
                    Content-Type: application/json
                  timeout: 240s
                  retries: 10
                  retry_period: 5s
      - label: log_teacher_result
        log:
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
      - label: trigger_training
        switch:
          - check: this.public_bar_fixture == true
            processors:
              - label: use_recorded_training_receipt
                mapping: root = this.expected_output
          - processors:
              - label: call_local_training_service
                http:
                  url: http://127.0.0.1:8025/tick
                  verb: POST
                  headers:
                    Content-Type: application/json
                  retries: 10
                  retry_period: 5s
      - label: log_training_status
        log:
          level: INFO
          message: 'Training status=${! this.status } error=${! error() }'
  output:
    label: save_training_receipt
    reject_errored:
      file:
        path: /data/training-receipts.jsonl
        codec: lines
'''
(ROOT / 'pipelines' / 'training-trigger.yaml').write_text(text)

text = header('rollout', 'site') + '''  input:
    # Poll timer only; adapter data comes from the local training service.
    generate:
      interval: 5s
      mapping: 'root = {"trigger": "rollout_poll", "site": env("TRAIN_LOOP_SITE")}'
  pipeline:
    processors:
      - label: fetch_site_bundle
        switch:
          - check: this.public_bar_fixture == true
            processors:
              - label: use_recorded_rollout_receipt
                mapping: root = this.expected_output
          - processors:
              - label: fetch_local_site_bundle
                http:
                  url: http://127.0.0.1:8025/bundle/${! this.site }
                  verb: GET
                  timeout: 120s
                  retries: 10
                  retry_period: 5s
              - label: install_local_adapter
                http:
                  url: http://127.0.0.1:${! env("TRAIN_LOOP_INSTALL_PORT") }/install
                  verb: POST
                  headers:
                    Content-Type: application/json
                  timeout: 120s
                  retries: 10
                  retry_period: 5s
      - label: log_release
        log:
          level: INFO
          message: 'Release site=${! this.site } error=${! error() }'
''' + output('http://127.0.0.1:8025/receipt')
(ROOT / 'pipelines' / 'rollout.yaml').write_text(text)
