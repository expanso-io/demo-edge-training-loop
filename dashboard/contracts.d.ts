export interface Teacher {
  source?: string;
  confidence: number;
  rationale: string;
  verdict?: string;
  corrected_target?: string;
}

export interface Transcript {
  id: string;
  site: string;
  kind: string;
  version: string;
  status: string;
  teacher: Teacher;
  prompt: string;
  answer: string;
  target: string;
}

export interface EvalAnswer {
  kind?: string;
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
  version?: string;
  status: string;
  reason: string;
  baseline?: Evaluation;
  candidate?: Evaluation;
  count?: number;
  seconds?: number;
  sha256?: string;
  training_ids?: string[];
}

export interface ReceiptEvent {
  seq: number;
  stage: string;
  message: string;
}

export interface Training {
  status: string;
  step: number;
  steps: number;
  version?: string;
}

export interface Cloud {
  running: number;
  total: number;
}

export interface State {
  records: Transcript[];
  events: ReceiptEvent[];
  mode: string;
  cloud?: Cloud;
  sites: { north: string; south: string };
  rollback?: unknown;
  rounds: Round[];
  training: Training;
}

export interface Point {
  x: number;
  y: number;
}

export interface CurveLane {
  kind: "curve";
  from: Point;
  to: Point;
  bow: number;
  /** x past which a source particle has left its own card and reads at full strength */
  exit?: number;
}

export interface PolyLane {
  kind: "poly";
  points: Point[];
  exit?: number;
}

export type Lane = CurveLane | PolyLane;

export interface Particle {
  lane: string;
  color: string;
  t: number;
  speed: number;
  size: number;
  trail: boolean;
  /** dissipates before arrival: the edge is idle, or the gate rejected it */
  die: boolean;
  jitter: number;
  /** runs once when the particle reaches the end of its lane */
  arrive?: () => void;
}
