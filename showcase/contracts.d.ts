export interface Teacher {
  confidence: number;
  rationale: string;
}

export interface Transcript {
  id: string;
  status: string;
  teacher: Teacher;
  prompt: string;
  answer: string;
  target: string;
}

export interface EvalAnswer {
  prompt: string;
  answer: string;
  pass: boolean;
}

export interface Evaluation {
  passed: number;
  total: number;
  outputs: EvalAnswer[];
}

export interface Round {
  status: string;
  reason: string;
  baseline?: Evaluation;
  candidate?: Evaluation;
}

export interface ReceiptEvent {
  seq: number;
  stage: string;
  message: string;
}

export interface Point {
  x: number;
  y: number;
}

export interface FlowLink {
  key: string;
  from: string;
  to: string;
  returning: boolean;
}

export interface Pulse {
  key: string;
  start: number;
}
