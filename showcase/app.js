"use strict";

/** @param {string} id */
function element(id) {
  const node = document.getElementById(id);

  if (!node) throw new Error(`Missing element: ${id}`);

  return node;
}

const form = document.querySelector("form");

function targetInput() {
  const input = document.querySelector("textarea");

  if (!input) throw new Error("Missing review input");

  return input;
}

const target = targetInput();

function trainingProgress() {
  const meter = document.querySelector("progress");

  if (!meter) throw new Error("Missing training meter");

  return meter;
}

const progress = trainingProgress();

const approveButton = document.querySelector("#approve");

if (!(form instanceof HTMLFormElement)
  || !(target instanceof HTMLTextAreaElement)
  || !(progress instanceof HTMLProgressElement)
  || !(approveButton instanceof HTMLButtonElement)) {
  throw new Error("Review form is incomplete");
}

let selectedId = "";

let latestEvent = 0;

let submitting = false;

/** @param {string} id @param {string | number} value */
function text(id, value) {
  element(id).textContent = String(value);
}

/** @param {boolean} dark */
function theme(dark) {
  document.body.dataset.theme = dark ? "dark" : "light";
  text("theme", dark ? "Light view" : "Dark view");
  localStorage.setItem("training-theme", dark ? "dark" : "light");
}

theme(localStorage.getItem("training-theme") === "dark");

element("theme").addEventListener("click", () => {
  theme(document.body.dataset.theme !== "dark");
});

/** @param {import("./contracts").Transcript[]} records */
function review(records) {
  const pending = records.filter((record) => record.status === "pending");
  const current = pending.find((record) => record.id === selectedId) || pending[0];
  const reviewForm = element("review-form");
  const empty = element("review-empty");

  element("review-loading").hidden = true;
  reviewForm.hidden = !current;
  empty.hidden = Boolean(current);
  text("pending", `${pending.length} awaiting review`);

  if (!current) {
    selectedId = "";
    text("review-empty", records.length
      ? "The teacher is grading, or approved conversations are ready to train."
      : "Waiting for a graded conversation.");

    return;
  }

  text("review-id", current.id);
  text("confidence", `${Math.round(current.teacher.confidence * 100)}% teacher confidence`);
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
  const container = element("rounds");

  container.replaceChildren();

  for (const round of history.slice(-3)) {
    const row = document.createElement("div");
    const label = document.createElement("strong");
    const detail = document.createElement("span");

    row.className = "round";
    row.dataset.result = round.status;
    label.textContent = round.status === "passed" ? "Passed" : "Rejected";
    detail.textContent = round.baseline && round.candidate
      ? `${round.baseline.passed}/${round.baseline.total} → ${round.candidate.passed}/${round.candidate.total} policy checks`
      : round.reason;
    row.append(label, detail);
    container.append(row);
  }

  const latest = history[history.length - 1];

  if (latest) {
    text("gate-verdict", latest.status === "passed" ? "Pass · release allowed" : "Rejected · sites unchanged");
    element("node-gate").dataset.result = latest.status;
    text("gate-state", latest.reason);
  }

  const evaluated = history.findLast((round) => round.baseline);

  if (!evaluated?.baseline || !evaluated.candidate) return;

  text("score-current", `Current: ${evaluated.baseline.passed}/${evaluated.baseline.total}`);
  text("score-candidate", `Candidate: ${evaluated.candidate.passed}/${evaluated.candidate.total}`);

  const before = evaluated.baseline.outputs;
  const after = evaluated.candidate.outputs;
  const changed = before.findIndex((record, index) => !record.pass && after[index].pass);
  const index = changed < 0 ? 0 : changed;

  text("eval-prompt", before[index].prompt);
  text("before", before[index].answer);
  text("after", after[index].answer);
  text("gate-state", evaluated.reason);
}

/** @param {import("./contracts").ReceiptEvent[]} history */
function events(history) {
  const feed = element("events");

  if (feed.matches(":hover") || history.length === 0) return;

  feed.replaceChildren();

  for (const event of history) {
    const row = document.createElement("li");

    row.textContent = `${event.stage}: ${event.message}`;
    feed.append(row);
  }

  if (latestEvent > 0) {
    for (const event of history) {
      if (event.seq <= latestEvent) continue;

      let key = event.stage;

      if (key === "collect") key = event.message.includes("north") ? "north" : "south";

      if (key === "training") key = "review";
      pulses.push({ key, start: performance.now() });
    }
  }

  latestEvent = history[0].seq;
}

async function poll() {
  try {
    const response = await fetch("/api/state", { cache: "no-store" });

    if (!response.ok) throw new Error("Local training node is unavailable");

    /** @type {{records: import("./contracts").Transcript[], mode: string, sites: {north: string, south: string}, rounds: import("./contracts").Round[], events: import("./contracts").ReceiptEvent[], training: {status: string, step: number, steps: number}}} */
    const state = await response.json();

    text("connection", "Connected to local receipts");
    text("mode", state.mode);
    text("north-version", state.sites.north);
    text("south-version", state.sites.south);
    text("received", state.records.length);
    text("received-label", state.records.length === 1 ? "transcript received" : "transcripts received");
    text("graded", state.records.filter((record) => record.teacher).length);
    text("review-count", state.records.filter((record) => record.status === "pending").length);
    text("approved-count", `${state.records.filter((record) => record.status === "approved").length} approved`);
    text("teacher-status", state.records.some((record) => record.status === "grading") ? "Grading a conversation" : "Ready for the next transcript");
    text("canary", state.sites.north === "base" ? "Canary on next release" : "Canary verified");
    document.body.dataset.shipped = String(state.sites.north !== "base" && state.sites.south !== "base");
    review(state.records);
    rounds(state.rounds);
    events(state.events);

    const shipped = state.sites.north !== "base" && state.sites.south !== "base";

    text("before-title", shipped ? "Before · base model" : "Current model");
    text("after-title", shipped ? `After · ${state.sites.north} at both sites` : "Candidate");

    const training = state.training;

    text("training-state", training.status === "training"
      ? `Step ${training.step} of ${training.steps}`
      : training.status === "idle" ? "Waiting for approved data"
        : ["passed", "rejected"].includes(training.status) ? "Training complete" : training.status);
    progress.value = training.status === "training"
      ? training.step / training.steps * 100
      : ["passed", "rejected"].includes(training.status) ? 100 : 0;
  } catch (error) {
    text("connection", error instanceof Error ? error.message : "Connection failed");
    element("review-loading").hidden = true;
  } finally {
    setTimeout(poll, 1000);
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (submitting || !selectedId) return;

  submitting = true;
  approveButton.disabled = true;

  try {
    const response = await fetch("/api/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: selectedId, target: target.value }),
    });

    const result = await response.json();

    if (!response.ok) throw new Error(result.error || "Approval failed");

    selectedId = "";
    element("review-form").hidden = true;
  } catch (error) {
    text("review-error", error instanceof Error ? error.message : "Approval failed");
  } finally {
    submitting = false;
    approveButton.disabled = false;
  }
});

function flowSurface() {
  const surface = document.querySelector("canvas");

  if (!surface) throw new Error("Missing flow surface");

  return surface;
}

const flowCanvas = flowSurface();

function flowBrush() {
  const brush = flowCanvas.getContext("2d");

  if (!brush) throw new Error("Canvas unavailable");

  return brush;
}

const brush = flowBrush();

const links = [
  { key: "north", from: "node-north", to: "node-teacher", returning: false },
  { key: "south", from: "node-south", to: "node-teacher", returning: false },
  { key: "teacher", from: "node-teacher", to: "node-review", returning: false },
  { key: "review", from: "node-review", to: "node-train", returning: false },
  { key: "gate", from: "node-train", to: "node-gate", returning: false },
  { key: "rollout", from: "node-gate", to: "node-sites", returning: true },
];

/** @type {import("./contracts").Pulse[]} */
const pulses = [];

/** @param {import("./contracts").FlowLink} link */
function route(link) {
  const frame = element("loop").getBoundingClientRect();
  const from = element(link.from).getBoundingClientRect();
  const to = element(link.to).getBoundingClientRect();
  const vertical = window.innerWidth <= 600 || to.top > from.bottom;

  if (link.returning) {
    if (window.innerWidth <= 1000) {
      return [
        { x: from.left - frame.left, y: from.top - frame.top + from.height / 2 },
        { x: 8, y: from.top - frame.top + from.height / 2 },
        { x: 8, y: to.top - frame.top + to.height / 2 },
        { x: to.left - frame.left, y: to.top - frame.top + to.height / 2 },
      ];
    }

    return [
      { x: from.left - frame.left + from.width / 2, y: from.bottom - frame.top },
      { x: from.left - frame.left + from.width / 2, y: frame.height - 38 },
      { x: to.left - frame.left + to.width / 2, y: frame.height - 38 },
      { x: to.left - frame.left + to.width / 2, y: to.bottom - frame.top },
    ];
  }

  if (vertical) {
    const start = { x: from.left - frame.left + from.width / 2, y: from.bottom - frame.top };
    const end = { x: to.left - frame.left + to.width / 2, y: to.top - frame.top };

    return [start, { x: start.x, y: (start.y + end.y) / 2 },
      { x: end.x, y: (start.y + end.y) / 2 }, end];
  }

  const start = { x: from.right - frame.left, y: from.top - frame.top + from.height / 2 };
  const end = { x: to.left - frame.left, y: to.top - frame.top + to.height / 2 };

  return [start, { x: (start.x + end.x) / 2, y: start.y },
    { x: (start.x + end.x) / 2, y: end.y }, end];
}

/** @param {import("./contracts").Point[]} points @param {number} fraction */
function along(points, fraction) {
  const distances = points.slice(1).map((point, index) =>
    Math.hypot(point.x - points[index].x, point.y - points[index].y));

  let remaining = distances.reduce((sum, distance) => sum + distance, 0) * fraction;

  for (let index = 0; index < distances.length; index++) {
    const distance = distances[index];

    if (remaining <= distance && distance > 0) {
      const weight = remaining / distance;

      return { x: points[index].x + (points[index + 1].x - points[index].x) * weight,
        y: points[index].y + (points[index + 1].y - points[index].y) * weight };
    }

    remaining -= distance;
  }

  return points[points.length - 1];
}

function drawFlow() {
  const frame = element("loop");
  const ratio = window.devicePixelRatio || 1;
  const width = frame.clientWidth;
  const height = frame.clientHeight;

  if (flowCanvas.width !== width * ratio || flowCanvas.height !== height * ratio) {
    flowCanvas.width = width * ratio;
    flowCanvas.height = height * ratio;
  }

  brush.setTransform(ratio, 0, 0, ratio, 0, 0);
  brush.clearRect(0, 0, width, height);
  brush.strokeStyle = getComputedStyle(document.body).getPropertyValue("--accent");
  brush.fillStyle = brush.strokeStyle;
  brush.lineWidth = 1;
  brush.globalAlpha = 0.45;

  for (const link of links) {
    const points = route(link);

    brush.beginPath();
    brush.moveTo(points[0].x, points[0].y);

    for (const point of points.slice(1)) brush.lineTo(point.x, point.y);

    brush.stroke();

    const end = points[points.length - 1];
    const previous = points[points.length - 2];
    const angle = Math.atan2(end.y - previous.y, end.x - previous.x);

    brush.beginPath();
    brush.moveTo(end.x, end.y);
    brush.lineTo(end.x - 5 * Math.cos(angle - 0.5), end.y - 5 * Math.sin(angle - 0.5));
    brush.moveTo(end.x, end.y);
    brush.lineTo(end.x - 5 * Math.cos(angle + 0.5), end.y - 5 * Math.sin(angle + 0.5));
    brush.stroke();
  }

  brush.globalAlpha = 1;

  const duration = matchMedia("(prefers-reduced-motion: reduce)").matches ? 5000 : 1800;

  for (let index = pulses.length - 1; index >= 0; index--) {
    const pulse = pulses[index];
    const fraction = (performance.now() - pulse.start) / duration;

    if (fraction >= 1) {
      pulses.splice(index, 1);
      continue;
    }

    const link = links.find((item) => item.key === pulse.key);

    if (!link) continue;

    const point = along(route(link), fraction);

    brush.beginPath();
    brush.arc(point.x, point.y, 3, 0, Math.PI * 2);
    brush.fill();
  }

  requestAnimationFrame(drawFlow);
}

requestAnimationFrame(drawFlow);

poll();
