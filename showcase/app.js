/* Local learning loop — live board.
 *
 * The screen is always moving. Each agent site emits conversation particles
 * continuously (customers keep talking whether or not anything is training);
 * every measured receipt adds a visible burst on its lane. Inside the edge
 * node the stage lanes carry what the counts say is there: graded records to
 * review, approved records to training, training steps to the gate. A pass
 * sends the adapter back along the return lane, north first; a rejection
 * dies at the gate in red. Expanso Cloud sits outside the customer boundary
 * and only its control heartbeat crosses the line.
 *
 * Numbers on the board are measured. Ambient emission is representative of
 * live conversations and is documented as such in DESIGN_BRIEF.md.
 */

"use strict";

const POLL_MS = 1000;

const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches ? 0.35 : 1;

const RATE = {
  site: 3,          // ambient conversations per site, per second
  toReview: 0.9,    // graded records moving to the person
  perApproved: 0.3, // approved records trickling toward training, each
  training: 2.6,    // steps toward the gate while a run is live
  ctlDown: 1.4,
  ctlUp: 0.9,
  shipped: 0.5,     // accepted adapter live at the sites
};

const SPEED = { site: 0.42, stage: 0.55, train: 0.8, ret: 0.5, ctl: 0.4 };

const COLOR = { conv: "#2b63c7", ok: "#0d8577", err: "#c2362d", ctl: "#7f8796" };

/** @param {string} id */
function element(id) {
  const node = document.getElementById(id);

  if (!node) throw new Error(`Missing element: ${id}`);

  return node;
}

/** @param {string} id @param {string | number} value */
function text(id, value) {
  const node = element(id);
  const next = String(value);

  if (node.textContent === next) return;

  node.textContent = next;

  const stage = node.closest(".stage, .site");

  if (stage) {
    stage.classList.remove("flash");
    void stage.getBoundingClientRect();
    stage.classList.add("flash");
  }
}

/** @param {string} id @param {string} state */
function pill(id, state) {
  element(id).dataset.state = state;
}

const canvas = element("flow");

const topology = element("topology");

function brush() {
  if (!(canvas instanceof HTMLCanvasElement)) throw new Error("Flow surface is not a canvas");

  const context = canvas.getContext("2d");

  if (!context) throw new Error("Canvas unavailable");

  return context;
}

const ctx = brush();

/* ------------------------------------------------------------ geometry */

/** @param {string} id @param {"left" | "right" | "top" | "bottom" | "center"} side */
function anchor(id, side) {
  const node = element(id).getBoundingClientRect();
  const frame = topology.getBoundingClientRect();
  const x = side === "left" ? node.left : side === "right" ? node.right : node.left + node.width / 2;
  const y = side === "top" ? node.top : side === "bottom" ? node.bottom : node.top + node.height / 2;

  return { x: x - frame.left, y: y - frame.top };
}

/** @typedef {import("./contracts").Point} Point */

/** @typedef {import("./contracts").Lane} Lane */

/** @type {Record<string, Lane>} */
let lanes = {};

function stacked() {
  return element("node-edge").getBoundingClientRect().top > element("node-sites").getBoundingClientRect().bottom;
}

/** Lanes connect box walls (DESIGN_SYSTEM.md flow grammar rule 4). */
function layout() {
  const edgeIn = anchor("node-edge", "left");
  const teacher = anchor("stage-teacher", "center");
  const sitesBottom = anchor("node-sites", "bottom");
  const gateBottom = anchor("stage-gate", "bottom");
  const frameHeight = topology.clientHeight;
  const vertical = stacked();

  /** @param {"site-north" | "site-south"} id @param {number} bow @returns {Lane} */
  const siteLane = (id, bow) => {
    const chip = anchor(id, "right");
    const out = anchor("node-sites", "right");

    const target = vertical
      ? { x: anchor("node-edge", "center").x + bow * 6, y: anchor("node-edge", "top").y }
      : { x: edgeIn.x, y: teacher.y + bow };

    return { kind: "curve", from: { x: chip.x + 2, y: chip.y }, to: target, bow: vertical ? 0 : bow * 1.5, exit: out.x };
  };

  const margin = topology.clientWidth - 10;

  const ctlPoints = [anchor("node-orch", "right"), { x: margin, y: anchor("node-orch", "right").y },
    { x: margin, y: anchor("node-edge", "right").y }, anchor("node-edge", "right")];

  const returnPoints = vertical
    ? [gateBottom, { x: gateBottom.x, y: gateBottom.y + 18 }, { x: 10, y: gateBottom.y + 18 },
      { x: 10, y: anchor("node-sites", "center").y }, anchor("node-sites", "left")]
    : [gateBottom, { x: gateBottom.x, y: frameHeight - 30 }, { x: sitesBottom.x, y: frameHeight - 30 }, sitesBottom];

  lanes = {
    north: siteLane("site-north", -16),
    south: siteLane("site-south", 16),
    review: { kind: "curve", from: anchor("stage-teacher", "right"), to: anchor("stage-review", "left"), bow: 0 },
    train: { kind: "curve", from: anchor("stage-review", "right"), to: anchor("stage-train", "left"), bow: 0 },
    gate: { kind: "curve", from: anchor("stage-train", "right"), to: anchor("stage-gate", "left"), bow: 0 },
    reject: { kind: "curve", from: anchor("stage-gate", "center"), to: { x: anchor("stage-gate", "center").x + 36, y: anchor("stage-gate", "bottom").y + 26 }, bow: 10 },
    ret: { kind: "poly", points: returnPoints },
    ctlDown: vertical ? { kind: "poly", points: ctlPoints } : { kind: "curve", from: anchor("node-orch", "bottom"), to: anchor("node-edge", "top"), bow: 0 },
    ctlUp: vertical ? { kind: "poly", points: [...ctlPoints].reverse() } : { kind: "curve", from: anchor("node-edge", "top"), to: anchor("node-orch", "bottom"), bow: 0 },
  };
}

/** @param {number} a @param {number} c @param {number} b @param {number} t */
function quad(a, c, b, t) {
  const u = 1 - t;

  return u * u * a + 2 * u * t * c + t * t * b;
}

/** @param {Lane} lane @param {number} t @returns {Point} */
function along(lane, t) {
  if (lane.kind === "curve") {
    const cx = (lane.from.x + lane.to.x) / 2;
    const cy = (lane.from.y + lane.to.y) / 2 + lane.bow;

    return { x: quad(lane.from.x, cx, lane.to.x, t), y: quad(lane.from.y, cy, lane.to.y, t) };
  }

  const points = lane.points;
  const lengths = points.slice(1).map((point, index) => Math.hypot(point.x - points[index].x, point.y - points[index].y));
  const total = lengths.reduce((sum, length) => sum + length, 0);

  let remaining = total * t;

  for (let index = 0; index < lengths.length; index++) {
    if (remaining <= lengths[index] && lengths[index] > 0) {
      const weight = remaining / lengths[index];

      return { x: points[index].x + (points[index + 1].x - points[index].x) * weight,
        y: points[index].y + (points[index + 1].y - points[index].y) * weight };
    }

    remaining -= lengths[index];
  }

  return points[points.length - 1];
}

function resize() {
  const box = topology.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;

  if (!(canvas instanceof HTMLCanvasElement)) return;

  canvas.width = Math.max(1, Math.floor(box.width * dpr));
  canvas.height = Math.max(1, Math.floor(box.height * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  layout();
}

addEventListener("resize", resize);

/* ------------------------------------------------------------ particles */

/** @type {import("./contracts").Particle[]} */
const particles = [];

/** @type {Map<string, number>} */
const emitters = new Map();

/** @param {string} lane @param {string} color @param {Partial<import("./contracts").Particle>} opts */
function spawn(lane, color, opts = {}) {
  particles.push({
    lane, color, t: 0,
    speed: opts.speed || 0.6,
    size: opts.size || 2.8 + Math.random() * 1.4,
    trail: opts.trail !== false,
    die: opts.die || false,
    jitter: (Math.random() - 0.5) * 6,
  });
}

/** @param {string} key @param {string} lane @param {number} perSecond @param {string} color @param {number} dt @param {Partial<import("./contracts").Particle>} opts */
function emit(key, lane, perSecond, color, dt, opts = {}) {
  if (perSecond <= 0) return;

  const carry = (emitters.get(key) ?? Math.random()) + perSecond * REDUCED * dt;
  const count = Math.floor(carry);

  emitters.set(key, carry - count);

  for (let index = 0; index < Math.min(count, 40); index++) spawn(lane, color, opts);
}

/** @param {string} lane @param {number} count @param {string} color @param {Partial<import("./contracts").Particle>} opts */
function burst(lane, count, color, opts = {}) {
  for (let index = 0; index < count; index++) {
    setTimeout(() => spawn(lane, color, opts), index * 28);
  }
}

/* ----------------------------------------------------------------- state */

/** @type {import("./contracts").State | null} */
let S = null;

let connected = false;

let latestEvent = 0;

let lastRound = 0;

/** @type {{north: string, south: string}} */
let lastSites = { north: "base", south: "base" };

let lastTraining = "idle";

let lastFrame = performance.now();

function live() {
  return connected && (S?.cloud?.running ?? 1) > 0;
}

/** @param {number} now */
function frame(now) {
  const dt = Math.min(0.05, (now - lastFrame) / 1000);

  lastFrame = now;

  const moving = live();
  const records = S?.records ?? [];
  const approved = records.filter((record) => record.status === "approved").length;
  const graded = records.filter((record) => record.teacher).length;
  const training = S?.training.status === "training";
  const batchWaiting = ["idle", "starting", "training"].includes(S?.training.status ?? "idle");
  const shipped = document.body.dataset.shipped === "true";

  // Rule 2: the sites emit whether or not anything listens.
  emit("north", "north", RATE.site, COLOR.conv, dt, { speed: SPEED.site, die: !moving, size: 3.2 + Math.random() * 1.4 });
  emit("south", "south", RATE.site, COLOR.conv, dt, { speed: SPEED.site, die: !moving, size: 3.2 + Math.random() * 1.4 });

  if (moving) {
    emit("review", "review", graded ? RATE.toReview : 0, COLOR.conv, dt, { speed: SPEED.stage });
    emit("train", "train", batchWaiting ? Math.min(3, approved * RATE.perApproved) : 0, COLOR.conv, dt, { speed: SPEED.stage, size: 2.6 });
    emit("gate", "gate", training ? RATE.training : 0, COLOR.conv, dt, { speed: SPEED.train, size: 2.4 });
    // The accepted adapter is live at both sites: the loop stays visibly closed.
    emit("ret", "ret", shipped ? RATE.shipped : 0, COLOR.ok, dt, { speed: SPEED.ret, size: 3 });
  }

  if ((S?.cloud?.running ?? 0) > 0) {
    emit("ctlDown", "ctlDown", RATE.ctlDown, COLOR.ctl, dt, { speed: SPEED.ctl, size: 2.4, trail: false });
    emit("ctlUp", "ctlUp", RATE.ctlUp, COLOR.ctl, dt, { speed: SPEED.ctl, size: 2.4, trail: false });
  }

  draw(dt, moving);
  requestAnimationFrame(frame);
}

/** @param {Lane} lane @param {number} alpha @param {boolean} broken @param {boolean} [shipped] */
function guide(lane, alpha, broken, shipped = false) {
  ctx.strokeStyle = broken ? `rgba(194, 54, 45, ${alpha + 0.1})`
    : shipped ? `rgba(13, 133, 119, ${alpha + 0.18})` : `rgba(43, 99, 199, ${alpha})`;
  ctx.setLineDash(broken ? [4, 7] : []);
  ctx.beginPath();

  if (lane.kind === "curve") {
    ctx.moveTo(lane.from.x, lane.from.y);
    ctx.quadraticCurveTo((lane.from.x + lane.to.x) / 2, (lane.from.y + lane.to.y) / 2 + lane.bow, lane.to.x, lane.to.y);
  } else {
    ctx.moveTo(lane.points[0].x, lane.points[0].y);

    for (const point of lane.points.slice(1)) ctx.lineTo(point.x, point.y);
  }

  ctx.stroke();
  ctx.setLineDash([]);
}

/** @param {number} dt @param {boolean} moving */
function draw(dt, moving) {
  ctx.clearRect(0, 0, topology.clientWidth, topology.clientHeight);
  ctx.lineWidth = 1;

  // Faint guide paths so the loop reads between particles (rule 5).
  guide(lanes.north, 0.22, !moving);
  guide(lanes.south, 0.22, !moving);
  guide(lanes.review, 0.22, false);
  guide(lanes.train, 0.22, false);
  guide(lanes.gate, 0.22, false);
  guide(lanes.ctlDown, 0.2, false);

  guide(lanes.ret, 0.22, false, document.body.dataset.shipped === "true");

  for (let index = particles.length - 1; index >= 0; index--) {
    const particle = particles[index];
    const lane = lanes[particle.lane];

    particle.t += particle.speed * REDUCED * dt;

    if (!lane || particle.t >= 1) { particles.splice(index, 1); continue; }

    const point = along(lane, particle.t);

    // Rule 3: light inside the source's own box, full strength after exiting.
    // A dying particle dissipates before it reaches the idle edge wall.
    let fade = Math.sin(Math.PI * particle.t);

    if (lane.kind === "curve" && lane.exit !== undefined && point.x < lane.exit) fade *= 0.4;

    // Dissipates AT the boundary: full strength to 60% of the lane, gone by 85%.
    if (particle.die) fade *= Math.min(1, Math.max(0, (0.85 - particle.t) / 0.25));

    const x = point.x + (lane.kind === "poly" ? particle.jitter : 0);

    if (particle.trail) {
      const back = along(lane, Math.max(0, particle.t - 0.04));

      ctx.strokeStyle = particle.color;
      ctx.globalAlpha = 0.22 * fade;
      ctx.lineWidth = particle.size * 0.9;
      ctx.beginPath();
      ctx.moveTo(back.x + (lane.kind === "poly" ? particle.jitter : 0), back.y);
      ctx.lineTo(x, point.y);
      ctx.stroke();
    }

    ctx.globalAlpha = 0.85 * fade;
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(x, point.y, particle.size, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 1;
  ctx.lineWidth = 1;
}

/* --------------------------------------------------------------- render */

let selectedId = "";

let submitting = false;

/** @param {import("./contracts").Transcript[]} records */
function review(records) {
  const pending = records.filter((record) => record.status === "pending");
  const current = pending.find((record) => record.id === selectedId) || pending[0];
  const target = element("target");

  if (!(target instanceof HTMLTextAreaElement)) throw new Error("Review input missing");

  element("review-loading").hidden = true;
  element("review-form").hidden = !current;
  element("review-empty").hidden = Boolean(current);
  text("pending", `${pending.length} waiting`);
  element("stage-review").dataset.queue = String(pending.length);

  if (!current) {
    selectedId = "";
    text("review-empty", records.some((record) => record.status === "grading")
      ? "teacher is grading" : "nothing waiting on a person");

    return;
  }

  text("review-id", current.id);
  text("confidence", `${Math.round(current.teacher.confidence * 100)}% TEACHER CONFIDENCE`);
  text("prompt", current.prompt);
  text("answer", current.answer);
  text("rationale", current.teacher.rationale);

  if (selectedId !== current.id) {
    target.value = current.target;
    selectedId = current.id;
    text("review-error", "");
  }
}

/** @param {import("./contracts").Round[]} history */
function rounds(history) {
  const latest = history[history.length - 1];
  const gate = element("stage-gate");

  if (!latest) {
    gate.dataset.result = "";
    pill("pill-release", "off");

    return;
  }

  gate.dataset.result = latest.status;
  text("gate-state", latest.reason);
  pill("pill-release", latest.status === "passed" ? "on" : "warn");

  if (history.length !== lastRound) {
    if (lastRound > 0) {
      if (latest.status === "passed") burst("ret", 36, COLOR.ok, { speed: SPEED.ret, size: 3.4 });
      else burst("reject", 22, COLOR.err, { speed: 1.3, size: 2.6, die: true });
    }

    lastRound = history.length;
  }

  const evaluated = history.findLast((round) => round.baseline);

  if (!evaluated?.baseline || !evaluated.candidate) {
    text("gate-score", latest.status === "passed" ? "PASS" : "REJECTED");
    text("gate-label", latest.status === "passed" ? "release allowed" : "sites unchanged");

    return;
  }

  text("gate-score", `${evaluated.baseline.passed}/${evaluated.baseline.total} → ${evaluated.candidate.passed}/${evaluated.candidate.total}`);
  text("gate-label", evaluated.status === "passed" ? "candidate wins · ships" : "no improvement · stays");

  const before = evaluated.baseline.outputs;
  const after = evaluated.candidate.outputs;
  const changed = before.findIndex((record, index) => !record.pass && after[index].pass);
  const index = changed < 0 ? 0 : changed;

  text("eval-prompt", before[index].prompt);
  text("before", before[index].answer);
  text("after", after[index].answer);
}

/** @param {import("./contracts").ReceiptEvent[]} history */
function events(history) {
  const feed = element("events");

  if (history.length === 0) return;

  if (latestEvent > 0) {
    for (const event of history) {
      if (event.seq <= latestEvent) continue;

      if (event.stage === "collect") burst(event.message.includes("south") ? "south" : "north", 10, COLOR.conv, { speed: SPEED.site, size: 3.2 });
      else if (event.stage === "teacher") burst("review", 6, COLOR.conv, { speed: SPEED.stage });
      else if (event.stage === "review" && event.message.includes("approved")) burst("train", 8, COLOR.conv, { speed: SPEED.stage });
      else if (event.stage === "training") burst("gate", 12, COLOR.conv, { speed: SPEED.train });
      else if (event.stage === "rollout" && event.message.includes("activated")) burst("ret", 18, COLOR.ok, { speed: SPEED.ret, size: 3.4 });
    }
  }

  if (feed.matches(":hover")) return;

  feed.replaceChildren();

  for (const event of history.slice(0, 7)) {
    const row = document.createElement("li");
    const tag = document.createElement("span");

    tag.className = "stage-tag";
    tag.textContent = event.stage.toUpperCase();
    row.dataset.stage = event.stage;
    row.append(tag, event.message);

    if (event.seq > latestEvent && latestEvent > 0) row.classList.add("fresh");

    feed.append(row);
  }

  latestEvent = history[0].seq;
}

/** @param {import("./contracts").State} state */
function render(state) {
  const records = state.records;
  const shipped = state.sites.north !== "base" && state.sites.south !== "base";

  text("received", records.length);
  text("graded", records.filter((record) => record.teacher).length);
  text("review-count", records.filter((record) => record.status === "pending").length);
  text("north-version", state.sites.north);
  text("south-version", state.sites.south);
  element("site-north").dataset.version = state.sites.north === "base" ? "base" : "adapter";
  element("site-south").dataset.version = state.sites.south === "base" ? "base" : "adapter";
  element("return-label").dataset.state = state.sites.north === "base" ? "off" : "on";
  document.body.dataset.shipped = String(shipped);

  // A presenter started before this field existed reports no Cloud counts; the
  // board then runs on local receipts alone instead of crashing the render.
  const cloud = state.cloud ?? { running: 0, total: 0 };

  text("cloud-jobs", cloud.total ? `jobs · ${cloud.running}/${cloud.total} running` : "jobs · status unavailable");
  pill("pill-cloud", !cloud.total ? "off" : cloud.running === cloud.total ? "on" : cloud.running ? "warn" : "err");
  pill("pill-teacher", records.some((record) => record.status === "grading") ? "warn" : records.some((record) => record.teacher) ? "on" : "off");

  const training = state.training;

  if (training.status === "training") {
    text("train-step", `${training.step}/${training.steps}`);
    text("train-label", "LoRA steps · this Mac");
    pill("pill-training", "warn");
  } else if (training.status === "idle") {
    text("train-step", "–");
    text("train-label", `LoRA · ${records.filter((record) => record.status === "approved").length} approved waiting`);
    pill("pill-training", "off");
  } else {
    text("train-step", training.status.toUpperCase());
    text("train-label", "LoRA · this Mac");
    pill("pill-training", ["passed", "rejected"].includes(training.status) ? "on" : "warn");
  }

  if (lastTraining !== "training" && training.status === "training") burst("gate", 10, COLOR.conv, { speed: SPEED.train });

  lastTraining = training.status;

  if (state.sites.north !== lastSites.north && state.sites.north !== "base") burst("ret", 14, COLOR.ok, { speed: SPEED.ret, size: 3.4 });

  lastSites = { ...state.sites };

  const edge = element("node-edge");
  const why = element("edge-why");

  edge.classList.toggle("disabled", !live());
  why.hidden = live();
  why.textContent = cloud.total && cloud.running === 0 ? "NO JOBS RUNNING — scheduled from Expanso Cloud; conversations keep arriving, nothing is graded" : "";

  text("before-title", shipped ? "BEFORE · BASE" : "CURRENT");
  text("after-title", shipped ? `AFTER · ${state.sites.north}` : "CANDIDATE");

  review(records);
  rounds(state.rounds);
  events(state.events);
  layout();
}

async function poll() {
  try {
    const response = await fetch("/api/state", { cache: "no-store" });

    if (!response.ok) throw new Error("Local training node is unavailable");

    /** @type {import("./contracts").State} */
    const state = await response.json();

    S = state;
    connected = true;
    pill("pill-node", "on");
    render(state);
  } catch {
    connected = false;
    pill("pill-node", "err");
    element("review-loading").hidden = true;
    element("review-empty").hidden = false;
    element("edge-why").hidden = false;
    element("edge-why").textContent = "TRAINING NODE UNREACHABLE — conversations keep arriving at the sites";
    element("node-edge").classList.add("disabled");
  } finally {
    setTimeout(poll, POLL_MS);
  }
}

element("review-form").addEventListener("submit", async (event) => {
  event.preventDefault();

  const target = element("target");
  const approve = element("approve");

  if (submitting || !selectedId || !(target instanceof HTMLTextAreaElement) || !(approve instanceof HTMLButtonElement)) return;

  submitting = true;
  approve.disabled = true;

  try {
    const response = await fetch("/api/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: selectedId, target: target.value }),
    });

    const result = await response.json();

    if (!response.ok) throw new Error(result.error || "Approval failed");

    burst("train", 10, COLOR.conv, { speed: SPEED.stage });
    selectedId = "";
    element("review-form").hidden = true;
  } catch (error) {
    text("review-error", error instanceof Error ? error.message : "Approval failed");
  } finally {
    submitting = false;
    approve.disabled = false;
  }
});

resize();

requestAnimationFrame(frame);

poll();
