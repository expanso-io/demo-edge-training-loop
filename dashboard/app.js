/* Local learning loop — live board.
 *
 * Nothing drawn is invented. Customers write in at every line of both assistant
 * sites continuously (representative; the counts beside them are measured);
 * each measured receipt adds a burst on its own site's lane. Inside the
 * training node a spine carries what the counts say is there: graded
 * conversations to the person, approved ones to training while a batch is
 * waiting, steps to the gate while a run is live. A pass sends the adapter
 * through the release column and back to the sites, north first; a
 * rejection dies at the gate. Expanso Cloud sits outside the customer
 * boundary and only its control heartbeat crosses the line.
 */

"use strict";

const POLL_MS = 1000;

const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches ? 0.35 : 1;

const SEATS = 4;

const SITES = /** @type {const} */ (["north", "south"]);

const RATE = {
  customer: 0.55,   // ambient customer messages per seat, per second
  seat: 0.3,        // ambient transcripts leaving each seat
  toReview: 0.9,
  perApproved: 0.3,
  training: 2.6,
  released: 0.45,   // accepted adapter live at a site
  ctlDown: 1.4,
  ctlUp: 0.9,
};

const SPEED = { customer: 1.1, seat: 0.38, spine: 0.7, gate: 0.6, ret: 0.45, ctl: 0.4 };

/* Terracotta is a conversation, teal is approved or shipped, red is held at
 * the gate, violet is Expanso Cloud: the same four meanings as styles.css. */
const COLOR = { conv: "#b8472a", ok: "#0f7a63", err: "#b3261e", ctl: "#6743cf" };

const CONV = "184, 71, 42";

const OK = "15, 122, 99";

const ERR = "179, 38, 30";

const CTL = "103, 67, 207";

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

  const num = node.closest(".num");

  if (num) {
    num.classList.remove("flash");
    void num.getBoundingClientRect();
    num.classList.add("flash");
  }
}

/** @param {string} id @param {string} value */
function setState(id, value) {
  element(id).dataset.state = value;
}

const stage = element("stage");

const flowCanvas = element("flow");

const ringCanvas = element("ring");

/** @param {HTMLElement} node */
function context2d(node) {
  if (!(node instanceof HTMLCanvasElement)) throw new Error("Not a canvas");

  const context = node.getContext("2d");

  if (!context) throw new Error("Canvas unavailable");

  return context;
}

const ctx = context2d(flowCanvas);

const rctx = context2d(ringCanvas);

/* ------------------------------------------------------------ geometry */

/** @typedef {import("./contracts").Point} Point */

/** @typedef {import("./contracts").Lane} Lane */

/** @param {Element} node @param {"left" | "right" | "top" | "bottom" | "center"} side */
function anchor(node, side) {
  const box = node.getBoundingClientRect();
  const frame = stage.getBoundingClientRect();
  const x = side === "left" ? box.left : side === "right" ? box.right : box.left + box.width / 2;
  const y = side === "top" ? box.top : side === "bottom" ? box.bottom : box.top + box.height / 2;

  return { x: x - frame.left, y: y - frame.top };
}

/** @param {string} id @param {"left" | "right" | "top" | "bottom" | "center"} side */
function at(id, side) {
  return anchor(element(id), side);
}

/** @param {string} id */
function glyph(id) {
  return anchor(element(id).querySelector(".glyph") ?? element(id), "center");
}

/** @type {Record<string, Lane>} */
let lanes = {};

/** @param {Point} from @param {Point} to @param {number} bow @param {number} [exit] @returns {Lane} */
function curve(from, to, bow, exit) {
  return { kind: "curve", from, to, bow, exit };
}

/** Lanes connect seats, glyphs and card walls; recomputed on resize and render. */
function layout() {
  const edgeIn = at("node-edge", "left");
  const teacher = at("stage-teacher", "center");
  const stacked = at("node-edge", "top").y > at("site-south", "bottom").y;
  const returnBottom = Math.max(at("node-edge", "bottom").y, at("site-south", "bottom").y);

  /** @type {Record<string, Lane>} */
  const next = {};

  for (const site of SITES) {
    const card = element(`site-${site}`);
    const seats = card.querySelectorAll(".seat");
    const cardLeft = anchor(card, "left");
    const cardRight = anchor(card, "right");

    seats.forEach((seat, index) => {
      const centre = anchor(seat, "center");
      const spread = (index - (SEATS - 1) / 2) * 14;

      next[`cust-${site}-${index}`] = curve({ x: cardLeft.x + 6, y: centre.y + (index % 2 ? 14 : -14) }, centre, 0);
      // Out of the seat, through the card's right wall at the seat's own
      // height, then across the gap into the edge node beside the teacher.
      next[`seat-${site}-${index}`] = stacked
        ? curve(centre, { x: at("node-edge", "center").x + spread, y: at("node-edge", "top").y }, 0, cardRight.x)
        : { kind: "poly", points: [centre, { x: cardRight.x, y: centre.y + spread }, { x: edgeIn.x, y: teacher.y + spread + (site === "north" ? -22 : 22) }], exit: cardRight.x };
    });
  }

  next.review = curve(glyph("stage-teacher"), glyph("stage-review"), 0);
  next.train = curve(glyph("stage-review"), glyph("stage-train"), 0);
  next.gate = curve(glyph("stage-train"), glyph("stage-gate"), 0);
  next.reject = curve(glyph("stage-gate"), { x: glyph("stage-gate").x - 34, y: glyph("stage-gate").y + 40 }, 8);
  const gateOut = at("node-edge", "right");
  const releaseIn = at("improvement", "left");
  const releaseGutter = (gateOut.x + releaseIn.x) / 2;

  next.release = stacked
    ? curve(at("node-edge", "bottom"), at("improvement", "top"), 0)
    : { kind: "poly", points: [{ x: gateOut.x, y: at("stage-gate", "right").y }, { x: releaseGutter, y: at("stage-gate", "right").y }, { x: releaseGutter, y: releaseIn.y }, releaseIn] };

  for (const site of SITES) {
    const siteLeft = at(`site-${site}`, "left");
    const outer = site === "north";
    const ladderOut = at("ladder", "right");
    const start = { x: ladderOut.x, y: ladderOut.y + (outer ? -8 : 8) };
    const right = ladderOut.x + (outer ? 24 : 12);
    const left = siteLeft.x - (outer ? 24 : 12);
    const bottom = returnBottom + (outer ? 40 : 24);

    next[`ret-${site}`] = stacked
      ? { kind: "poly", points: [start, { x: right, y: start.y }, { x: right, y: at("ladder", "bottom").y + (outer ? 32 : 16) }, { x: left, y: at("ladder", "bottom").y + (outer ? 32 : 16) }, { x: left, y: siteLeft.y }, siteLeft] }
      : { kind: "poly", points: [start, { x: right, y: start.y }, { x: right, y: bottom }, { x: left, y: bottom }, { x: left, y: siteLeft.y }, siteLeft] };
  }

  next.ctlDown = curve(at("node-orch", "bottom"), at("node-edge", "top"), 0);
  next.ctlUp = curve(at("node-edge", "top"), at("node-orch", "bottom"), 0);
  lanes = next;

  // The boundary encloses the site cards and the edge node; Cloud stays outside it.
  const boundary = element("boundary");
  const frame = stage.getBoundingClientRect();

  boundary.style.top = `${at("node-orch", "bottom").y + 10}px`;
  boundary.style.left = `${at("site-north", "left").x - 12}px`;
  boundary.style.right = `${frame.width - at("node-edge", "right").x - 12}px`;
  boundary.style.bottom = `${frame.height - Math.max(at("site-south", "bottom").y, at("node-edge", "bottom").y) - 12}px`;
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
  const box = stage.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;

  if (!(flowCanvas instanceof HTMLCanvasElement)) return;

  flowCanvas.width = Math.max(1, Math.floor(box.width * dpr));
  flowCanvas.height = Math.max(1, Math.floor(box.height * dpr));
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
    arrive: opts.arrive,
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

/** @param {string} id */
function seatNumber(id) {
  let hash = 0;

  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) % 9973;

  return hash % SEATS;
}

/** @param {string} site @param {number} seat */
function seatBusy(site, seat) {
  const node = element(`floor-${site}`).querySelector(`[data-seat="${seat}"]`);

  if (!node) return;

  node.classList.add("heard");
  setTimeout(() => node.classList.add("answered"), 320);
  setTimeout(() => node.classList.remove("heard", "answered"), 1100);
}

/* ----------------------------------------------------------------- state */

/** @type {import("./contracts").State | null} */
let S = null;

let connected = false;

let latestEvent = 0;

let lastRound = -1;

/** @type {{north: string, south: string}} */
let lastSites = { north: "base", south: "base" };

let lastTraining = "idle";

let lastFrame = performance.now();

function cloudRunning() {
  return S?.cloud?.running ?? 0;
}

function live() {
  return connected && (S?.cloud?.total ? cloudRunning() > 0 : true);
}

/** @param {number} now */
function frame(now) {
  const dt = Math.min(0.05, (now - lastFrame) / 1000);

  lastFrame = now;

  const moving = live();
  const records = S?.records ?? [];
  const approved = records.filter((record) => record.status === "approved").length;
  const graded = records.filter((record) => record.teacher).length;
  const status = S?.training.status ?? "idle";
  const training = status === "training";
  const batchWaiting = ["idle", "starting", "training"].includes(status);
  const latest = S?.rounds[S.rounds.length - 1];

  // The sites never stop: customers write in whether or not anything trains.
  for (const site of SITES) {
    for (let seat = 0; seat < SEATS; seat++) {
      emit(`cust-${site}-${seat}`, `cust-${site}-${seat}`, RATE.customer, COLOR.conv, dt,
        { speed: SPEED.customer, size: 2.2, trail: false, arrive: () => seatBusy(site, seat) });
      emit(`seat-${site}-${seat}`, `seat-${site}-${seat}`, RATE.seat, COLOR.conv, dt,
        { speed: SPEED.seat, die: !moving, size: 3 + Math.random() * 1.2 });
    }
  }

  if (moving) {
    emit("review", "review", graded ? RATE.toReview : 0, COLOR.conv, dt, { speed: SPEED.spine, size: 2.6 });
    emit("train", "train", batchWaiting ? Math.min(3, approved * RATE.perApproved) : 0, COLOR.conv, dt, { speed: SPEED.spine, size: 2.6 });
    emit("gate", "gate", training ? RATE.training : 0, COLOR.conv, dt, { speed: SPEED.spine, size: 2.4 });

    if (latest?.status === "passed") emit("release", "release", RATE.released, COLOR.ok, dt, { speed: SPEED.gate, size: 2.8 });

    for (const site of SITES) {
      const shipped = (S?.sites[site] ?? "base") !== "base";

      emit(`ret-${site}`, `ret-${site}`, shipped ? RATE.released : 0, COLOR.ok, dt, { speed: SPEED.ret, size: 3 });
    }
  }

  if (cloudRunning() > 0) {
    emit("ctlDown", "ctlDown", RATE.ctlDown, COLOR.ctl, dt, { speed: SPEED.ctl, size: 2.4, trail: false });
    emit("ctlUp", "ctlUp", RATE.ctlUp, COLOR.ctl, dt, { speed: SPEED.ctl, size: 2.4, trail: false });
  }

  draw(dt, moving);
  requestAnimationFrame(frame);
}

/** @param {Lane} lane @param {string} rgb @param {number} alpha @param {boolean} [dashed] */
function guide(lane, rgb, alpha, dashed = false) {
  ctx.strokeStyle = `rgba(${rgb}, ${alpha})`;
  ctx.setLineDash(dashed ? [4, 7] : []);
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
  ctx.clearRect(0, 0, stage.clientWidth, stage.clientHeight);
  ctx.lineWidth = 1;

  const shippedNorth = (S?.sites.north ?? "base") !== "base";
  const shippedSouth = (S?.sites.south ?? "base") !== "base";

  for (const site of SITES) {
    for (let seat = 0; seat < SEATS; seat++) {
      guide(lanes[`seat-${site}-${seat}`], moving ? CONV : ERR, moving ? 0.1 : 0.14, !moving);
    }
  }

  guide(lanes.review, CONV, 0.22);
  guide(lanes.train, CONV, 0.22);
  guide(lanes.gate, CONV, 0.22);
  guide(lanes.release, OK, 0.2);
  guide(lanes["ret-north"], OK, shippedNorth ? 0.45 : 0.14);
  guide(lanes["ret-south"], OK, shippedSouth ? 0.45 : 0.14);
  guide(lanes.ctlDown, CTL, 0.2);

  for (let index = particles.length - 1; index >= 0; index--) {
    const particle = particles[index];
    const lane = lanes[particle.lane];

    particle.t += particle.speed * REDUCED * dt;

    if (!lane || particle.t >= 1) {
      if (lane && particle.arrive) particle.arrive();

      particles.splice(index, 1);
      continue;
    }

    const point = along(lane, particle.t);

    let fade = Math.sin(Math.PI * particle.t);

    // Light inside the source's own card, full strength after exiting it.
    if (lane.exit !== undefined && point.x < lane.exit) fade *= 0.6;

    // Dissipates AT the boundary: full strength to 60% of the lane, gone by 85%.
    if (particle.die) fade *= Math.min(1, Math.max(0, (0.85 - particle.t) / 0.25));

    const x = point.x + (lane.kind === "poly" ? particle.jitter : 0);

    if (particle.trail) {
      const back = along(lane, Math.max(0, particle.t - 0.04));

      ctx.strokeStyle = particle.color;
      ctx.globalAlpha = 0.25 * fade;
      ctx.lineWidth = particle.size * 0.9;
      ctx.beginPath();
      ctx.moveTo(back.x + (lane.kind === "poly" ? particle.jitter : 0), back.y);
      ctx.lineTo(x, point.y);
      ctx.stroke();
    }

    ctx.globalAlpha = 0.9 * fade;
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(x, point.y, particle.size, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 1;
  ctx.lineWidth = 1;
}

/* ----------------------------------------------------------------- ring */

/** @param {import("./contracts").Round | undefined} round */
function drawRing(round) {
  const size = 120;
  const dpr = window.devicePixelRatio || 1;

  if (!(ringCanvas instanceof HTMLCanvasElement)) return;

  ringCanvas.width = size * dpr;
  ringCanvas.height = size * dpr;
  rctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  rctx.clearRect(0, 0, size, size);

  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 9;
  const start = -Math.PI / 2;

  rctx.lineWidth = 9;
  rctx.beginPath();
  rctx.arc(cx, cy, r, 0, Math.PI * 2);
  rctx.strokeStyle = "rgba(92, 85, 77, .16)";
  rctx.stroke();

  const base = round?.baseline;
  const cand = round?.candidate;
  const tone = round?.status === "passed" ? COLOR.ok : COLOR.err;

  if (base && cand) {
    rctx.beginPath();
    rctx.arc(cx, cy, r, start, start + Math.max(0.02, base.passed / base.total) * Math.PI * 2);
    rctx.strokeStyle = "rgba(92, 85, 77, .5)";
    rctx.lineWidth = 9;
    rctx.stroke();
    rctx.beginPath();
    rctx.arc(cx, cy, r - 1, start, start + Math.max(0.02, cand.passed / cand.total) * Math.PI * 2);
    rctx.strokeStyle = tone;
    rctx.lineWidth = 11;
    rctx.stroke();
  }

  rctx.font = "13px ui-monospace, SFMono-Regular, Menlo, monospace";
  rctx.textAlign = "center";
  rctx.textBaseline = "middle";
  rctx.fillStyle = cand ? tone : "#766e65";
  rctx.fillText(cand ? `${cand.passed}/${cand.total}` : "gate", cx, cy - 8);
  rctx.fillStyle = "#766e65";
  rctx.fillText(base ? `was ${base.passed}/${base.total}` : "pending", cx, cy + 9);
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
  text("pending", pending.length ? `${pending.length} waiting` : "queue empty");
  element("stage-review").dataset.queue = String(pending.length);
  element("stage-review").dataset.live = String(pending.length > 0);

  if (!current) {
    selectedId = "";
    text("review-empty", records.some((record) => record.status === "grading") ? "teacher is grading" : "nothing waiting on a person");

    return;
  }

  text("review-id", `${current.site} · ${current.id}`);
  text("confidence", `${Math.round(current.teacher.confidence * 100)}% CONFIDENCE`);
  text("prompt", current.prompt);
  text("answer", current.answer);
  text("rationale", current.teacher.rationale);

  if (selectedId !== current.id) {
    target.value = current.target;
    selectedId = current.id;
    text("review-error", "");
  }
}

/** @param {string} id @param {boolean[]} passes */
function cells(id, passes) {
  const holder = element(id);

  holder.replaceChildren();

  for (let index = 0; index < 8; index++) {
    const cell = document.createElement("i");

    if (index < passes.length) cell.dataset.pass = String(passes[index]);

    holder.append(cell);
  }
}

/** @param {import("./contracts").Round[]} history @param {string} trainingStatus */
function rounds(history, trainingStatus) {
  const latest = history[history.length - 1];
  const gate = element("stage-gate");
  const improvement = element("improvement");
  const list = element("rounds");

  gate.dataset.result = latest?.status ?? "";
  gate.dataset.live = String(trainingStatus === "evaluating");
  improvement.dataset.result = latest?.status ?? "";

  if (history.length !== lastRound) {
    if (lastRound >= 0 && latest) {
      if (latest.status === "passed") burst("release", 36, COLOR.ok, { speed: SPEED.gate, size: 3.4 });
      else burst("reject", 22, COLOR.err, { speed: 1.3, size: 2.6, die: true });
    }

    lastRound = history.length;
  }

  list.replaceChildren();

  if (!latest) {
    const empty = document.createElement("li");

    empty.className = "empty";
    empty.textContent = "base model at both sites · nothing has shipped";
    list.append(empty);
  }

  for (const round of history.slice(-4).reverse()) {
    const row = document.createElement("li");
    const name = document.createElement("b");
    const detail = document.createElement("span");
    const tag = document.createElement("span");

    row.dataset.result = round.status;
    row.dataset.round = String(history.indexOf(round));
    name.textContent = round.version ?? "round";
    detail.textContent = round.baseline && round.candidate
      ? `${round.baseline.passed}/${round.baseline.total} → ${round.candidate.passed}/${round.candidate.total}`
      : round.reason;
    tag.className = "tag";
    tag.textContent = round.status === "passed" ? "SHIPPED" : "HELD";
    row.append(name, detail, tag);
    list.append(row);
  }

  const evaluated = history.findLast((round) => round.baseline);

  drawRing(evaluated);

  if (!evaluated?.baseline || !evaluated.candidate) {
    text("gate-score", latest ? (latest.status === "passed" ? "PASS" : "HELD") : "–");
    text("gate-meta", latest ? latest.reason : "candidate must beat the current model");
    text("delta", "—");
    text("verdict", latest ? (latest.status === "passed" ? "released" : "held · sites unchanged") : "no round yet");
    text("verdict-sub", latest ? latest.reason : "first gate runs after 12 approvals");
    cells("checks-base", []);
    cells("checks-cand", []);

    return;
  }

  const base = evaluated.baseline;
  const cand = evaluated.candidate;
  const gained = cand.passed - base.passed;

  text("gate-score", `${cand.passed}/${cand.total}`);
  text("gate-label", "PASSED");
  text("gate-meta", `current model ${base.passed}/${base.total} · ${evaluated.status === "passed" ? "candidate wins, ships canary first" : "no improvement, sites unchanged"}`);
  text("delta", `${gained >= 0 ? "+" : ""}${gained}`);
  text("verdict", evaluated.status === "passed" ? `${evaluated.version ?? "candidate"} released` : "candidate held");
  text("verdict-sub", evaluated.reason);
  cells("checks-base", base.outputs.map((output) => output.pass));
  cells("checks-cand", cand.outputs.map((output) => output.pass));

  const changed = base.outputs.findIndex((record, index) => !record.pass && cand.outputs[index].pass);
  const index = changed < 0 ? 0 : changed;

  text("eval-prompt", base.outputs[index].prompt);
  text("before", base.outputs[index].answer);
  text("after", cand.outputs[index].answer);
}

/** @param {import("./contracts").Transcript[]} records */
function feed(records) {
  const list = element("feed");

  if (list.matches(":hover") || inspecting || records.length === 0) return;

  list.replaceChildren();

  for (const record of records.slice(-9).reverse()) {
    const row = document.createElement("li");

    row.dataset.id = record.id;
    const site = document.createElement("span");
    const kind = document.createElement("span");
    const body = document.createElement("span");
    const status = document.createElement("span");

    row.dataset.status = record.status;
    site.className = "site-tag";
    site.textContent = record.site.toUpperCase();
    kind.className = "kind";
    kind.textContent = record.kind;
    body.className = "text";
    body.textContent = record.prompt;
    status.className = "status";
    status.textContent = record.status === "pending" ? "NEEDS A PERSON" : record.status.toUpperCase();
    row.append(site, kind, body, status);
    list.append(row);
  }
}

/** @param {import("./contracts").ReceiptEvent[]} history */
function events(history) {
  const list = element("events");

  if (history.length === 0) return;

  if (latestEvent > 0) {
    for (const event of history) {
      if (event.seq <= latestEvent) continue;

      if (event.stage === "collect") {
        const site = event.message.includes("south") ? "south" : "north";
        const newest = S?.records.findLast((record) => record.site === site);
        const seat = seatNumber(newest ? newest.id : event.message + event.seq);

        burst(`cust-${site}-${seat}`, 6, COLOR.conv, { speed: SPEED.customer, size: 2.4, trail: false, arrive: () => seatBusy(site, seat) });
        burst(`seat-${site}-${seat}`, 12, COLOR.conv, { speed: SPEED.seat, size: 3.4 });
      } else if (event.stage === "teacher") {
        burst("review", 6, COLOR.conv, { speed: SPEED.spine });
      } else if (event.stage === "review" && event.message.includes("approved")) {
        burst("train", 8, COLOR.conv, { speed: SPEED.spine });
      } else if (event.stage === "training") {
        burst("gate", 12, COLOR.conv, { speed: SPEED.spine });
      } else if (event.stage === "rollout" && event.message.includes("activated")) {
        const site = event.message.includes("south") ? "south" : "north";

        burst(`ret-${site}`, 20, COLOR.ok, { speed: SPEED.ret, size: 3.4 });
        element(`site-${site}`).classList.add("gain");
        setTimeout(() => element(`site-${site}`).classList.remove("gain"), 1500);
      }
    }
  }

  if (list.matches(":hover")) return;

  list.replaceChildren();

  for (const event of history.slice(0, 8)) {
    const row = document.createElement("li");
    const tag = document.createElement("span");

    tag.className = "stage-tag";
    tag.textContent = event.stage.toUpperCase();
    row.dataset.stage = event.stage;
    row.append(tag, event.message);

    if (event.seq > latestEvent && latestEvent > 0) row.classList.add("fresh");

    list.append(row);
  }

  latestEvent = history[0].seq;
}

/** @param {"north" | "south"} site @param {import("./contracts").State} full */
function renderSite(site, full) {
  const mine = full.records.filter((record) => record.site === site);
  const refunds = mine.filter((record) => record.kind === "refund").length;
  const bookings = mine.length - refunds;
  const card = element(`site-${site}`);
  const version = full.sites[site];
  const last = mine[mine.length - 1];

  text(`${site}-count`, mine.length);
  text(`${site}-version`, version);
  card.dataset.version = version === "base" ? "base" : "adapter";

  const bars = element(`${site}-kinds`).querySelectorAll("i b");

  bars.forEach((bar, index) => {
    if (bar instanceof HTMLElement) bar.style.width = mine.length ? `${((index ? bookings : refunds) / mine.length) * 100}%` : "0%";
  });

  const lastNode = element(`${site}-last`);

  lastNode.replaceChildren();

  if (last) {
    const kind = document.createElement("b");

    kind.textContent = last.kind;
    lastNode.append("last: ", kind, ` · ${last.id} · ${last.version}`);
  } else {
    lastNode.textContent = "awaiting the first customer";
  }

  if (version !== lastSites[site] && version !== "base") burst(`ret-${site}`, 16, COLOR.ok, { speed: SPEED.ret, size: 3.4 });

  const canary = element(`canary-${site}`);
  const label = canary.lastChild;

  setState(`canary-${site}`, version === "base" ? (full.rollback ? "rollback" : "off") : "on");

  if (label) label.textContent = ` ${site} · ${version}`;
}

/** @param {import("./contracts").State} full */
function renderTeacher(full) {
  const records = full.records;
  const graded = records.filter((record) => record.teacher).length;
  const approved = records.filter((record) => record.status === "approved").length;
  const pending = records.filter((record) => record.status === "pending").length;
  const grading = records.filter((record) => record.status === "grading").length;
  const total = Math.max(1, approved + pending + grading);
  const parts = { pass: approved, person: pending, grading };

  text("graded", graded);
  element("stage-teacher").dataset.live = String(grading > 0);
  element("teacher-split").querySelectorAll("i").forEach((bar) => {
    if (!(bar instanceof HTMLElement)) return;

    const part = bar.dataset.part === "pass" ? parts.pass : bar.dataset.part === "person" ? parts.person : parts.grading;

    bar.style.width = `${Math.max(part ? 6 : 0, (part / total) * 100)}%`;
  });
  text("teacher-split-label", graded ? `${approved} ready · ${pending} need a person · ${grading} grading` : "no verdicts yet");
  text("review-count", pending);

  const queue = element("queue");
  const chips = document.createElement("div");
  const label = document.createElement("span");

  chips.className = "chips";

  for (const record of records) {
    if (record.status !== "approved" && record.status !== "pending") continue;

    const chip = document.createElement("i");

    if (record.status === "pending") chip.className = "pending";

    chips.append(chip);
  }

  label.id = "approved-label";
  label.textContent = `${approved} approved for training · needs 12`;
  queue.replaceChildren(chips, label);
}

/** @param {import("./contracts").State} full */
function renderTraining(full) {
  const training = full.training;
  const approved = full.records.filter((record) => record.status === "approved").length;
  const bar = element("train-bar");
  const steps = Math.max(1, training.steps);

  element("stage-train").dataset.live = String(["training", "starting", "evaluating"].includes(training.status));

  if (training.status === "training") {
    text("train-step", `${training.step}/${training.steps}`);
    text("train-label", "STEPS");
  text("train-meta", `LoRA on ${approved} approved conversations`);
    bar.style.width = `${(training.step / steps) * 100}%`;
    text("train-pct", `${Math.round((training.step / steps) * 100)}%`);
  } else if (training.status === "idle") {
    text("train-step", "–");
    text("train-label", "STEPS");
    text("train-meta", approved >= 12 ? "batch ready · next scheduled trigger starts the run" : `needs 12 approved conversations · ${approved} so far`);
    bar.style.width = "0%";
    text("train-pct", "idle");
  } else {
    text("train-step", training.status.toUpperCase());
    text("train-label", "RUN");
  text("train-meta", training.version || "Customer edge node");
    bar.style.width = ["passed", "rejected", "evaluating"].includes(training.status) ? "100%" : "0%";
    text("train-pct", training.status);
  }

  if (lastTraining !== "training" && training.status === "training") burst("gate", 10, COLOR.conv, { speed: SPEED.spine });

  lastTraining = training.status;
}

/** @param {import("./contracts").State} full */
function renderBadge(full) {
  const badge = element("state-badge");
  const records = full.records;
  const pending = records.filter((record) => record.status === "pending").length;
  const grading = records.filter((record) => record.status === "grading").length;
  const shipped = full.sites.north !== "base" && full.sites.south !== "base";
  const latest = full.rounds[full.rounds.length - 1];

  /** @type {[string, string]} */
  const [tone, label] = full.training.status === "training" ? ["busy", "TRAINING"]
    : grading > 0 ? ["busy", "GRADING"]
      : pending > 0 ? ["busy", "AWAITING A PERSON"]
        : shipped ? ["live", `${full.sites.north} LIVE`]
          : latest?.status === "rejected" ? ["live", "HELD · BASE LIVE"]
            : ["live", "COLLECTING"];

  setState("state-badge", tone);
  badge.textContent = label;
}

/** @param {import("./contracts").State} full */
function render(full) {
  const shipped = full.sites.north !== "base" && full.sites.south !== "base";
  const cloud = full.cloud ?? { running: 0, total: 0 };

  document.body.dataset.shipped = String(shipped);
  renderSite("north", full);
  renderSite("south", full);
  lastSites = { ...full.sites };

  text("cloud-jobs", cloud.total ? `${cloud.total} jobs · ${cloud.running} running` : "job status unavailable · local receipts only");
  text("orchestrated", cloud.total ? `EXPANSO CLOUD · ${cloud.running}/${cloud.total} JOBS RUNNING` : "EXPANSO CLOUD · STATUS UNAVAILABLE");
  element("node-edge").querySelectorAll(".pipes i").forEach((pipe) => {
    if (pipe instanceof HTMLElement) pipe.dataset.on = String(cloud.total > 0 && cloud.running === cloud.total);
  });

  renderTeacher(full);
  renderTraining(full);

  const edge = element("node-edge");
  const why = element("edge-why");

  edge.dataset.running = String(live());
  why.hidden = true;
  why.textContent = "";

  text("before-title", shipped ? "BEFORE · BASE" : "CURRENT");
  text("after-title", shipped ? `AFTER · ${full.sites.north}` : "CANDIDATE");

  renderBadge(full);
  review(full.records);
  rounds(full.rounds, full.training.status);
  feed(full.records);
  events(full.events);
  layout();
}

async function poll() {
  try {
    const response = await fetch("/api/state", { cache: "no-store" });

    if (!response.ok) throw new Error("Local training node is unavailable");

    /** @type {import("./contracts").State} */
    const full = await response.json();

    S = full;
    connected = true;
    document.body.dataset.state = full.training.status === "training" ? "busy" : "live";
    render(full);
  } catch {
    connected = false;
    document.body.dataset.state = "down";
    setState("state-badge", "down");
    element("state-badge").textContent = "STANDBY";
    text("orchestrated", "TRAINING NODE UNREACHABLE");
    element("review-loading").hidden = true;
    element("review-empty").hidden = false;
    element("edge-why").hidden = false;
  element("edge-why").textContent = "Training node unreachable";
    element("node-edge").dataset.running = "false";
  } finally {
    setTimeout(poll, POLL_MS);
  }
}

/* ------------------------------------------------------- popup inspector */
/* Space Force's click-to-inspect, read as a transcript: who said what, what
 * the teacher proposed, what the person approved. One record at a time. */

let inspecting = false;

let popupDismissedUntil = 0;

/** @param {string} term @param {string} value @param {string} [tone] */
function line(term, value, tone = "") {
  const dt = document.createElement("dt");
  const dd = document.createElement("dd");

  dt.textContent = term;
  dd.textContent = value;
  dd.className = tone;

  return [dt, dd];
}

/** @param {import("./contracts").Transcript} record */
function conversationView(record) {
  const list = document.createElement("dl");
  const teacher = record.teacher;
  const verdict = teacher ? `${teacher.verdict ? `${teacher.verdict} · ` : ""}${Math.round(teacher.confidence * 100)}% confidence · ${teacher.rationale}` : "not graded yet";

  list.append(
    ...line("CUSTOMER", record.prompt, "customer"),
    ...line("ASSISTANT", record.answer),
    ...line("TEACHER", verdict, "teacher"),
    ...line(record.status === "approved" ? "APPROVED" : "PROPOSED", record.target || "—", "target"),
    ...line("RECORD", `${record.site} · ${record.id} · ${record.kind} · answered by ${record.version} · ${record.status}`, "machine"),
  );

  return [list];
}

/** @param {import("./contracts").Round} round */
function roundView(round) {
  const list = document.createElement("dl");
  const base = round.baseline;
  const cand = round.candidate;
  const score = base && cand ? `current ${base.passed}/${base.total} → candidate ${cand.passed}/${cand.total}` : "no held-out comparison";

  list.append(
    ...line("VERDICT", `${round.status === "passed" ? "shipped" : "held"} · ${round.reason}`, round.status === "passed" ? "target" : "customer"),
    ...line("HELD OUT", score, "machine"),
    ...line("TRAINED ON", `${round.count ?? round.training_ids?.length ?? "—"} approved conversations${round.seconds ? ` · ${round.seconds}s` : ""}${round.sha256 ? ` · adapter ${round.sha256.slice(0, 12)}` : ""}`, "machine"),
  );

  if (!base || !cand) return [list];

  const held = document.createElement("ol");

  held.className = "held-out";

  cand.outputs.forEach((output, index) => {
    const row = document.createElement("li");
    const was = document.createElement("i");
    const now = document.createElement("i");
    const said = document.createElement("span");

    was.dataset.pass = String(base.outputs[index]?.pass ?? false);
    now.dataset.pass = String(output.pass);
    said.textContent = `${output.prompt} — ${output.answer}`;
    row.append(was, now, said);
    held.append(row);
  });

  return [list, held];
}

/** @param {string} title @param {Node[]} body */
function showPopup(title, body) {
  const popup = element("popup");

  if (popup.dataset.open === "true" || performance.now() < popupDismissedUntil) return;

  text("popup-title", title);
  element("popup-body").replaceChildren(...body);
  popup.dataset.open = "true";
  popup.setAttribute("aria-hidden", "false");
  inspecting = true;
  element("feed").classList.add("paused");
  text("feed-hint", "paused · click or esc to resume");
}

function hidePopup() {
  const popup = element("popup");

  if (popup.dataset.open !== "true") return;

  popupDismissedUntil = performance.now() + 250;
  popup.dataset.open = "false";
  popup.setAttribute("aria-hidden", "true");
  inspecting = false;
  element("feed").classList.remove("paused");
  element("feed").querySelectorAll("li").forEach((row) => row.classList.remove("active"));
  text("feed-hint", "click a conversation to read it whole");
}

/** @param {string} id */
function openRecord(id) {
  const record = S?.records.find((item) => item.id === id);

  if (record) showPopup(`CONVERSATION · ${record.site.toUpperCase()} · ${record.id}`, conversationView(record));
}

/** @param {"north" | "south"} site @param {number} seat */
function openSeat(site, seat) {
  const record = S?.records.findLast((item) => item.site === site && seatNumber(item.id) === seat);

  if (record) openRecord(record.id);
  else showPopup(`LINE ${seat + 1} · ${site.toUpperCase()}`, [Object.assign(document.createElement("p"), { className: "empty", textContent: "no measured conversation on this line yet · the ambient traffic is representative" })]);
}

element("popup").addEventListener("click", hidePopup);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") hidePopup();
});

element("feed").addEventListener("click", (event) => {
  const row = event.target instanceof Element ? event.target.closest("li[data-id]") : null;

  if (!(row instanceof HTMLElement) || !row.dataset.id) return;

  row.classList.add("active");
  openRecord(row.dataset.id);
});

element("rounds").addEventListener("click", (event) => {
  const row = event.target instanceof Element ? event.target.closest("li[data-round]") : null;
  const round = row instanceof HTMLElement ? S?.rounds[Number(row.dataset.round)] : undefined;

  if (round) showPopup(`ROUND · ${round.version ?? "data gate"}`, roundView(round));
});

for (const site of SITES) {
  element(`floor-${site}`).addEventListener("click", (event) => {
    const seat = event.target instanceof Element ? event.target.closest(".seat") : null;

    if (seat instanceof HTMLElement) openSeat(site, Number(seat.dataset.seat));
  });
  element(`floor-${site}`).addEventListener("keydown", (event) => {
    const seat = event.target instanceof Element ? event.target.closest(".seat") : null;

    if ((event.key === "Enter" || event.key === " ") && seat instanceof HTMLElement) {
      event.preventDefault();
      openSeat(site, Number(seat.dataset.seat));
    }
  });
  element(`${site}-last`).addEventListener("click", () => {
    const record = S?.records.findLast((item) => item.site === site);

    if (record) openRecord(record.id);
  });
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

    burst("train", 10, COLOR.conv, { speed: SPEED.spine });
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

drawRing(undefined);

requestAnimationFrame(frame);

poll();
