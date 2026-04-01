// ===== CONFIG =====

// Hard-coded season dates (kept unless backend provides them)
let SEASON_START = "2026-03-15";
let SEASON_END = "2026-06-30";

const API_URL =
  "https://script.google.com/macros/s/AKfycbz14OzCFeMIyWMY6FRLckWwgBBtlLej71cDkYNb-qGEISJVHHWSe57Tp_49wHmwlRTQ/exec";

const CANONICAL_MAP = {
  SUMNER: "SUMNER/SEAN JOYCE",
  "SEAN JOYCE": "SUMNER/SEAN JOYCE",
  "SUMNER/SEAN JOYCE": "SUMNER/SEAN JOYCE",

  "AVON BUTLER": "BUTLER",
  "AVON BUTLER ELEMENTARY SCHOOL": "BUTLER",
  BUTLER: "BUTLER",
};

// ===== STATE =====

let calendar = null;
let seasonEvents = [];
let practiceOnly = false;
let selectedFields = new Set();
let allFieldKeys = new Set();

let lastUpdateText = "";
let lastCheckedTime = null;
let previousIcsTimestamp = "";

// Popover state
let popoverInitialized = false;

// ===== TIME HELPERS =====

function timeAgo(ts) {
  if (!ts) return "";

  const now = Date.now();
  const then = new Date(ts).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? "" : "s"} ago`;
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? "" : "s"} ago`;
  if (diffDay === 1) return "yesterday";

  return new Date(ts).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// ===== LAST UPDATE TICKER =====

function startLastUpdateTicker() {
  const el = document.getElementById("lastUpdate");
  if (!el) return;

  function refresh() {
    if (!lastCheckedTime) return;

    const checkedAgo = timeAgo(lastCheckedTime);
    const updatedAgo = lastUpdateText ? timeAgo(lastUpdateText) : null;

    if (!lastUpdateText) {
      el.textContent = `Last checked ${checkedAgo}`;
      return;
    }

    const icsChanged = lastUpdateText !== previousIcsTimestamp;

    if (icsChanged) {
      el.textContent = `Data updated ${updatedAgo}`;
    } else {
      el.textContent = `Last checked ${checkedAgo}`;
    }
  }

  refresh();
  setInterval(refresh, 60000);
}

// ===== LOADING OVERLAY =====

function showLoading() {
  const overlay = document.getElementById("loadingOverlay");
  if (overlay) overlay.style.display = "flex";
}

function hideLoading() {
  const overlay = document.getElementById("loadingOverlay");
  if (overlay) overlay.style.display = "none";
}

// ===== DATA LOAD =====

async function fetchSeasonEvents() {
  const params = new URLSearchParams();
  params.append("start", SEASON_START);
  params.append("end", SEASON_END);

  const url =
    API_URL + (API_URL.includes("?") ? "&" : "?") + params.toString();

  const res = await fetch(url);
  if (!res.ok) {
    console.error("Failed to fetch season events", res.status, res.statusText);
    return { lastUpdate: "", events: [] };
  }

  return await res.json();
}

async function loadSeasonData() {
  showLoading();

  const data = await fetchSeasonEvents();

  if (data.seasonStart) SEASON_START = data.seasonStart;
  if (data.seasonEnd) SEASON_END = data.seasonEnd;

  const rawEvents = data.events || [];

  previousIcsTimestamp = lastUpdateText;
  lastUpdateText = data.lastUpdate || "";
  lastCheckedTime = Date.now();

  seasonEvents = rawEvents.map((ev) => {
    const ext = ev.extendedProps || {};
    const rawCanonical = (ext.canonical || "").toUpperCase();
    const normalizedCanonical = CANONICAL_MAP[rawCanonical] || rawCanonical;

    return {
      ...ev,
      extendedProps: {
        ...ext,
        canonical: normalizedCanonical,
      },
    };
  });

  allFieldKeys = new Set();
  seasonEvents.forEach((ev) => {
    const ext = ev.extendedProps || {};
    if (ext.canonical) {
      allFieldKeys.add(ext.canonical);
    }
  });

  selectedFields = new Set(allFieldKeys);

  initFieldLayersUI();
  startLastUpdateTicker();

  hideLoading();

  if (calendar) {
    calendar.refetchEvents();
  }
}

// ===== FIELD LAYERS UI =====

function createFieldCheckbox(canonical, labelText) {
  const container = document.getElementById("fieldLayersContainer");

  const wrapper = document.createElement("label");
  wrapper.className = "field-layer-item";

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = true;
  checkbox.dataset.canonical = canonical;

  checkbox.addEventListener("change", () => {
    if (checkbox.checked) {
      selectedFields.add(canonical);
    } else {
      selectedFields.delete(canonical);
    }
    if (calendar) calendar.refetchEvents();
  });

  const span = document.createElement("span");
  span.textContent =
