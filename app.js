/* vitali-site — interactions: rotator, sheets, feedback pipeline */
"use strict";

/* Feedback goes to the vitali-feedback Cloudflare Worker (stored in KV; read at /list). */
const FEEDBACK_ENDPOINT = "https://vitali-feedback.mrvitali.workers.dev";

const ROTATING = ["software that thinks", "tools that stay local", "machines that serve you", "things that don't phone home", "AI that belongs to someone"];
const ROTATE_MS = 2600;

/* ── hero word rotator (twyn landing homage) ─────────────────── */
(() => {
  const el = document.querySelector(".rotator-word");
  if (!el) return;
  let i = 0;
  setInterval(() => {
    i = (i + 1) % ROTATING.length;
    const next = ROTATING[i];
    const span = document.createElement("span");
    span.className = "rotator-word";
    span.textContent = next;
    el.replaceWith(span);
  }, ROTATE_MS);
})();

/* ── sheet plumbing ──────────────────────────────────────────── */
const backdrop = document.getElementById("sheetBackdrop");
const sheet = document.getElementById("feedbackSheet");
const form = document.getElementById("feedbackForm");
const successBox = document.getElementById("fbSuccess");
const fbProject = document.getElementById("fbProject");
const fbMessage = document.getElementById("fbMessage");
const fbContact = document.getElementById("fbContact");
const fbNote = document.getElementById("fbNote");
const fbTitle = document.getElementById("feedbackTitle");
const fbSubmit = document.getElementById("fbSubmit");
const fbSuccessNote = document.getElementById("fbSuccessNote");
let lastFocus = null;
let feedbackType = "praise";

function openSheet(project) {
  lastFocus = document.activeElement;
  backdrop.hidden = false;
  sheet.hidden = false;
  form.hidden = false;
  successBox.hidden = true;
  fbNote.textContent = "";
  fbNote.classList.remove("err");
  if (project) {
    const opt = [...fbProject.options].find(o => o.value === project);
    if (opt) fbProject.value = project;
    fbTitle.textContent = `Feedback — ${project}`;
  } else {
    fbProject.value = "General";
    fbTitle.textContent = "Feedback";
  }
  document.body.style.overflow = "hidden";
  fbMessage.focus();
}

function closeSheet() {
  backdrop.hidden = true;
  sheet.hidden = true;
  document.body.style.overflow = "";
  if (lastFocus) lastFocus.focus();
}

document.querySelectorAll("[data-open-feedback]").forEach(b =>
  b.addEventListener("click", () => openSheet(null)));
document.querySelectorAll("[data-feedback-project]").forEach(b =>
  b.addEventListener("click", e => {
    e.stopPropagation();
    openSheet(b.dataset.feedbackProject);
  }));
document.querySelectorAll("[data-close-sheet]").forEach(b =>
  b.addEventListener("click", closeSheet));
backdrop.addEventListener("click", closeSheet);
document.addEventListener("keydown", e => {
  if (e.key === "Escape" && !sheet.hidden) closeSheet();
});

/* cards: whole card opens feedback pre-filled; launch links don't */
document.querySelectorAll(".card").forEach(card => {
  card.addEventListener("click", e => {
    if (e.target.closest("[data-stop]")) return; // launch link
    openSheet(card.dataset.project.charAt(0).toUpperCase() + card.dataset.project.slice(1));
  });
  card.addEventListener("keydown", e => {
    if ((e.key === "Enter" || e.key === " ") && e.target === card) {
      e.preventDefault();
      openSheet(card.dataset.project.charAt(0).toUpperCase() + card.dataset.project.slice(1));
    }
  });
});

/* type chips */
document.querySelectorAll(".type-chip").forEach(chip =>
  chip.addEventListener("click", () => {
    document.querySelectorAll(".type-chip").forEach(c => c.classList.remove("is-active"));
    chip.classList.add("is-active");
    feedbackType = chip.dataset.type;
  }));

/* ── feedback pipeline ───────────────────────────────────────── */
const LOCAL_KEY = "vitali_feedback_queue";

function queueLocal(entry) {
  try {
    const q = JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]");
    q.push(entry);
    localStorage.setItem(LOCAL_KEY, JSON.stringify(q));
    return q.length;
  } catch { return -1; }
}

form.addEventListener("submit", async e => {
  e.preventDefault();
  const entry = {
    project: fbProject.value,
    type: feedbackType,
    message: fbMessage.value.trim(),
    contact: fbContact.value.trim() || null,
    ts: new Date().toISOString(),
    ua: navigator.userAgent,
  };
  if (!entry.message) return;

  fbSubmit.disabled = true;
  fbSubmit.textContent = "Sending…";
  fbNote.textContent = "";
  fbNote.classList.remove("err");

  try {
    if (FEEDBACK_ENDPOINT) {
      const res = await fetch(FEEDBACK_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry),
      });
      if (!res.ok) throw new Error(`endpoint ${res.status}`);
    } else {
      await new Promise(r => setTimeout(r, 500)); // demo-mode beat
      const n = queueLocal(entry);
      if (n < 0) throw new Error("storage blocked");
      entry._queued = n;
    }
    form.hidden = true;
    successBox.hidden = false;
    fbSuccessNote.textContent = FEEDBACK_ENDPOINT
      ? "Thanks — it's in."
      : "Saved on this device (demo mode) — wire a feedback endpoint and these flush automatically.";
    fbMessage.value = "";
    fbContact.value = "";
  } catch (err) {
    fbNote.textContent = "Couldn't send — try again in a sec.";
    fbNote.classList.add("err");
  } finally {
    fbSubmit.disabled = false;
    fbSubmit.textContent = "Send it";
  }
});
