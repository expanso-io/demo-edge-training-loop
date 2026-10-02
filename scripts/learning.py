"""Local CPU LoRA training and deterministic held-out inference."""
import hashlib
import json
import threading
import time
from pathlib import Path

import torch
from peft import LoraConfig, PeftModel, get_peft_model
from transformers import AutoModelForCausalLM, AutoTokenizer

from corpus import HELD_OUT, POLICY, passes
from gate import improved
from store import STATE, event, put

MODEL = 'HuggingFaceTB/SmolLM2-135M-Instruct'
REVISION = '12fd25f77366fa6b3b4b768ec3050bf629380bac'
LOCK = threading.Lock()
MODEL_STATE = {'version': None, 'model': None, 'tokenizer': None}
torch.set_num_threads(4)


def load(version='base'):
    if MODEL_STATE['version'] == version:
        return MODEL_STATE['model'], MODEL_STATE['tokenizer']
    tokenizer = AutoTokenizer.from_pretrained(MODEL, revision=REVISION)
    tokenizer.pad_token = tokenizer.eos_token
    model = AutoModelForCausalLM.from_pretrained(MODEL, revision=REVISION)
    if version != 'base':
        model = PeftModel.from_pretrained(model, STATE / 'adapters' / version)
    model.eval()
    MODEL_STATE.update(version=version, model=model, tokenizer=tokenizer)
    return model, tokenizer


def prompt_tokens(tokenizer, prompt):
    return tokenizer.apply_chat_template(
        [{'role': 'system', 'content': POLICY}, {'role': 'user', 'content': prompt}],
        tokenize=True, add_generation_prompt=True, return_tensors='pt')


def answer_unlocked(prompt, version='base'):
    model, tokenizer = load(version)
    tokens = prompt_tokens(tokenizer, prompt)
    with torch.inference_mode():
        result = model.generate(tokens, attention_mask=torch.ones_like(tokens),
                                max_new_tokens=55, do_sample=False,
                                pad_token_id=tokenizer.eos_token_id)
    return tokenizer.decode(result[0, tokens.shape[1]:], skip_special_tokens=True).strip()


def answer(prompt, version='base'):
    with LOCK:
        return answer_unlocked(prompt, version)


def evaluate(version):
    outputs = []
    for kind, prompt in HELD_OUT:
        text = answer_unlocked(prompt, version)
        outputs.append({'kind': kind, 'prompt': prompt, 'answer': text, 'pass': passes(kind, text)})
    return {'version': version, 'passed': sum(r['pass'] for r in outputs),
            'total': len(outputs), 'outputs': outputs}


def train(rows, version, current):
    with LOCK:
        started = time.monotonic()
        torch.manual_seed(7)
        baseline = evaluate(current)
        MODEL_STATE.update(version=None, model=None, tokenizer=None)
        model, tokenizer = load('base')
        model = get_peft_model(model, LoraConfig(
            task_type='CAUSAL_LM', r=8, lora_alpha=16, lora_dropout=0.0,
            target_modules=['q_proj', 'v_proj']))
        model.train()
        optimizer = torch.optim.AdamW(model.parameters(), lr=0.001)
        batches = []
        for row in rows:
            prefix = prompt_tokens(tokenizer, row['prompt'])[0]
            suffix = tokenizer(row['target'] + tokenizer.eos_token,
                               add_special_tokens=False, return_tensors='pt')['input_ids'][0]
            tokens = torch.cat((prefix, suffix)).unsqueeze(0)
            labels = tokens.clone()
            labels[:, :len(prefix)] = -100
            batches.append((tokens, labels))
        steps = 96
        for step in range(steps):
            tokens, labels = batches[step % len(batches)]
            optimizer.zero_grad()
            loss = model(input_ids=tokens, attention_mask=torch.ones_like(tokens), labels=labels).loss
            if not torch.isfinite(loss):
                raise ValueError('Training loss is not finite')
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()
            if step % 4 == 0 or step == steps - 1:
                put('training', {'status': 'training', 'step': step + 1, 'steps': steps,
                                 'loss': round(loss.item(), 4), 'version': version})
        destination = STATE / 'adapters' / version
        destination.mkdir(parents=True, exist_ok=False)
        model.save_pretrained(destination)
        MODEL_STATE.update(version=None, model=None, tokenizer=None)
        put('training', {'status': 'evaluating', 'version': version})
        candidate = evaluate(version)
        digest = hashlib.sha256((destination / 'adapter_model.safetensors').read_bytes()).hexdigest()
        passed = improved(baseline, candidate)
        result = {'version': version, 'status': 'passed' if passed else 'rejected',
                  'reason': 'Improved without regression' if passed else 'No safe improvement',
                  'baseline': baseline, 'candidate': candidate, 'sha256': digest,
                  'seconds': round(time.monotonic() - started, 1),
                  'training_ids': [r['id'] for r in rows],
                  'held_out_sha256': hashlib.sha256(json.dumps(HELD_OUT).encode()).hexdigest()}
        (destination / 'evaluation.json').write_text(json.dumps(result, indent=2))
        event('gate', result['reason'])
        return result
