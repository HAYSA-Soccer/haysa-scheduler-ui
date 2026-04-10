// ===== ADMIN WHITELIST =====
const ADMIN_EMAILS = [
  "haysa.manager@gmail.com",
  "president@haysa.org",
  "treasurer@haysa.org",
  "secretary@haysa.org",
  "riskmanager@haysa.org",
  "registrar@haysa.org",
  "webmaster@haysa.org",
  "volunteercoordinator.haysa@gmail.com",
  "assistanttreasurer.haysa@gmail.com",
  "coachcoordinator.haysa@gmail.com",
  "refereecoordinator.haysa@gmail.com",
  "minikickerdirector.haysa@gmail.com",
  "recdirector.haysa@gmail.com",
  "traveldirector.haysa@gmail.com",
  "brian.green88@yahoo.com"
];

// ===== CONFIG =====

let SEASON_START = "2026-03-15";
let SEASON_END   = "2026-06-30";

// MUST use script.google.com — NOT googleusercontent.com
const API_URL =
  "https://script.google.com/macros/s/AKfycbz14OzCFeMIyWMY6FRLckWwgBBtlLej71cDkYNb-qGEISJVHHWSe57Tp_49wHmwlRTQ/exec";

// ===== STATE =====

let calendar = null;
let practiceOnly = false;
let selectedFields = new Set();
let allFieldKeys = new Set();

let lastUpdateText = "";
let lastCheckedTime = null;
let previousIcsTimestamp = "";

let popoverInitialized = false;

// Full-season snapshot
let SNAPSHOT = null;

// ===== SNAPSHOT LOADER =====
// GET ONLY — no POST, no JSON, no CORS issues
async function loadSnapshot(force = false) {
  const url = `${API_URL}?action=getSnapshot${force ? "&force=true" : ""}`;
  const res = await fetch(url);

  if (!res.ok) {
    console.error("Snapshot load failed", res.status, res.statusText);
    return SNAPSHOT;
  }

  SNAPSHOT = await res.json();
  return SNAPSHOT;
}

// ===== INITIAL FIELD LIST =====

async function loadSeasonMeta() {
  const overlay = document.getElementById("loadingOverlay");
  if (overlay) overlay.style.display = "flex";

  await loadSnapshot();

  if (!SNAPSHOT) {
    if (overlay) overlay.style.display = "none";
    return;
  }

  SEASON_START = SNAPSHOT.seasonStart;
  SEASON_END   = SNAPSHOT.seasonEnd;

  previousIcsTimestamp = lastUpdateText;
  lastUpdateText = SNAPSHOT.lastUpdate || "";
  lastCheckedTime = Date.now();

  allFieldKeys = new Set();
  (SNAPSHOT.events || []).forEach(ev => {
    const ext = ev.extendedProps || {};
    if (ext.canonical) allFieldKeys.add(ext.canonical);
  });

  selectedFields = new Set(allFieldKeys);

  initFieldLayersUI();

  if (overlay) overlay.style.display = "none";
}

function createFieldCheckbox(canonical, labelText) {
  const container = document.getElementById("fieldLayersContainer");
  if (!container) return;

  const wrapper = document.createElement("label");
  wrapper.className = "field-layer-item";

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = true;
  checkbox.dataset.canonical = canonical;

  checkbox.addEventListener("change", () => {
    if (checkbox.checked) selectedFields.add(canonical);
    else selectedFields.delete(canonical);
    if (calendar) calendar.refetchEvents();
  });

  const span = document.createElement("span");
  span.textContent = labelText;

  wrapper.appendChild(checkbox);
  wrapper.appendChild(span);
  container.appendChild(wrapper);
}


function initFieldLayersUI() {
  const container = document.getElementById("fieldLayersContainer");
  if (!container) return;

  container.innerHTML = "";

  allFieldKeys.forEach(canonical => {
    let label = canonical;
    if (canonical === "SUMNER/SEAN JOYCE") label = "Sumner / Sean Joyce";
    else label = canonical.charAt(0) + canonical.slice(1).toLowerCase();

    createFieldCheckbox(canonical, label);
  });
}


// ===== FIELD LAYERS UI =====
// (unchanged)
// ... (your UI code stays exactly the same)
function initPracticeToggle() {
  const toggle = document.getElementById("practiceOnlyToggle");
  if (!toggle) return;

  toggle.addEventListener("change", () => {
    practiceOnly = toggle.checked;
    if (calendar) calendar.refetchEvents();
  });
}

// ===== REFRESH BUTTON =====
// FIXED — now uses GET instead of POST
function initRefreshButton() {
  const btn = document.getElementById("refreshButton");
  if (!btn) return;

  btn.addEventListener("click", async () => {

    const params = new URLSearchParams(window.location.search);
    const isAdmin = params.get("admin") === "1";

    if (isAdmin) {
      try {
        const url = `${API_URL}?action=refreshSnapshot&key=HAYSA_REFRESH`;
        const res = await fetch(url);
        const data = await res.json();

        if (data.success) {
          alert("Backend refreshed successfully!");
          await loadSnapshot(true);
          if (calendar) calendar.refetchEvents();
          return;
        } else {
          alert("Backend refresh failed or unauthorized.");
        }
      } catch (err) {
        console.error(err);
        alert("Error contacting backend.");
      }
    }

    // Non-admin fallback: local refresh only
    await loadSnapshot(true);
    if (calendar) calendar.refetchEvents();
  });
}

// ===== AUTO-REFRESH SNAPSHOT =====
// (unchanged)
// ... (your auto-refresh code stays exactly the same)

// ===== BOOTSTRAP =====
// (unchanged)
document.addEventListener("DOMContentLoaded", async () => {
  const params = new URLSearchParams(window.location.search);
  const isAdmin = params.get("admin") === "1";

  if (isAdmin) {
    document.getElementById("refreshButton").style.display = "inline-block";
  }

  await loadSeasonMeta();
  initPracticeToggle();
  initRefreshButton();
  initCalendar();
  initMobileWeekNav();
  initAutoRefresh();
});
