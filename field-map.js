// =========================
// CONFIG
// =========================
const API_URL =
  "https://script.google.com/macros/s/AKfycbz14OzCFeMIyWMY6FRLckWwgBBtlLej71cDkYNb-qGEISJVHHWSe57Tp_49wHmwlRTQ/exec";

// =========================
// COMPLEX MAP DEFINITIONS
// =========================
const COMPLEX_MAPS = {
  "TURF": {
    canonical: "TURF",
    label: "Turf",
    image: "/haysa-scheduler-ui/assets/turf.jpg",
    fields: {
      "FULL": { left: 22, top: 15, width: 50, height: 80 },
      "1": { left: 22, top: 5, width: 40, height: 20 },
      "2": { left: 40, top: 30, width: 40, height: 20 },
    }
  },

  "SUMNER/SEAN JOYCE": {
    canonical: "SUMNER/SEAN JOYCE",
    label: "Sumner/Sean Joyce",
    image: "/haysa-scheduler-ui/assets/sumner.jpg",
    fields: {
      "1": { left: 35, top: 15, width: 15, height: 18 },
      "1A": { left: 5, top: 5, width: 40, height: 15 },
      "1B": { left: 50, top: 5, width: 40, height: 15 },
      "2": { left: 5, top: 25, width: 90, height: 15 },
      "2A": { left: 5, top: 25, width: 40, height: 15 },
      "2B": { left: 50, top: 25, width: 40, height: 15 },
      "3": { left: 5, top: 45, width: 90, height: 15 },
      "3A": { left: 5, top: 45, width: 40, height: 15 },
      "3B": { left: 50, top: 45, width: 40, height: 15 },
      "4": { left: 5, top: 65, width: 90, height: 15 },
      "4A": { left: 5, top: 65, width: 40, height: 15 },
      "4B": { left: 50, top: 65, width: 40, height: 15 }
    }
  },

  "AVON BUTLER": {
    canonical: "AVON BUTLER",
    label: "Butler",
    image: "/haysa-scheduler-ui/assets/butler-layout.jpg",
    fields: {
      "FULL": { left: 5, top: 5, width: 90, height: 90 },
      "1": { left: 5, top: 5, width: 40, height: 20 },
      "2": { left: 50, top: 5, width: 40, height: 20 },
      "3": { left: 5, top: 30, width: 40, height: 20 },
      "4": { left: 50, top: 30, width: 40, height: 20 },
      "5": { left: 5, top: 55, width: 40, height: 20 },
      "6": { left: 50, top: 55, width: 40, height: 20 },
      "BU1": { left: 5, top: 80, width: 40, height: 15 },
      "BU2": { left: 50, top: 80, width: 40, height: 15 },
      "Softball Diamond": { left: 30, top: 80, width: 40, height: 15 }
    }
  }
};

// =========================
// FETCH SNAPSHOT
// =========================
async function loadSnapshot() {
  const res = await fetch(`${API_URL}?action=getSnapshot`);
  return res.json();
}

// =========================
// TIME SLIDER
// =========================
function sliderToDate(value) {
  const minutes = parseInt(value, 10);
  const dt = new Date();
  dt.setHours(Math.floor(minutes / 60));
  dt.setMinutes(minutes % 60);
  dt.setSeconds(0);
  return dt;
}

function updateTimeLabel(dt) {
  document.getElementById("timeLabel").textContent =
    dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// =========================
// NORMALIZE SURFACE
// =========================
function normalizeSurface(s) {
  if (!s) return null;
  s = s.trim();

  if (s === "FULL") return "FULL";
  if (/^\d[A-B]$/.test(s)) return s[0]; // 1A → 1
  if (/^\d+$/.test(s)) return s;

  if (s.startsWith("BU")) return "FULL";
  if (s.toLowerCase().includes("softball")) return "FULL";
  if (s.toLowerCase().includes("mini")) return "FULL";

  return s;
}

// =========================
// USAGE ENGINE
// =========================
function getFieldUsageAtTime(dt, events) {
  const ts = dt.getTime();
  const usage = {};

  events.forEach(ev => {
    const canonical = ev.extendedProps?.canonical;
    const fieldList = ev.extendedProps?.fields;

    if (!canonical || !fieldList) return;

    const start = new Date(ev.start).getTime();
    const end = new Date(ev.end).getTime();

    if (ts < start || ts >= end) return;

    // Split fields: "1, 1A, 1B, 2, 2A, 2B"
    const fields = fieldList.split(",").map(f => f.trim());

    fields.forEach(raw => {
      const surface = normalizeSurface(raw); // 1A → 1, 1B → 1, etc.

      if (!usage[canonical]) usage[canonical] = {};
      usage[canonical][surface] = { status: "booked", event: ev };
    });
  });

  return usage;
}


// =========================
// UPDATE OVERLAY
// =========================
function updateUsageOverlay(usage) {
  document.querySelectorAll(".field-box").forEach(el => {
    const [canonical, rawSurface] = el.dataset.label.split(" – ");
    const surface = normalizeSurface(rawSurface);

    const normalized = normalizeSurface(rawSurface);
    const u = usage[canonical]?.[normalized];


    el.classList.remove("open", "booked", "partial", "full");

    if (!u) {
      el.classList.add("open");
    } else {
      el.classList.add("booked");
    }
  });

  // FULL logic
  Object.keys(usage).forEach(canonical => {
    const surfaces = usage[canonical];
    const fullEl = document.querySelector(
      `.field-box[data-label="${canonical} – FULL"]`
    );
    if (!fullEl) return;

    const booked = Object.keys(surfaces).length;

    fullEl.classList.remove("open", "booked", "partial", "full");

    if (booked === 0) {
      fullEl.classList.add("open");
    } else if (booked === 1) {
      fullEl.classList.add("partial");
    } else {
      fullEl.classList.add("full");
    }
  });
}

// =========================
// RENDER MAPS
// =========================
function renderAllComplexes(active) {
  const container = document.getElementById("all-complexes");
  container.innerHTML = "";

  active.forEach(canonical => {
    const map = COMPLEX_MAPS[canonical];
    if (!map) return;

    const wrapper = document.createElement("div");
    wrapper.className = "map-wrapper";

    const img = document.createElement("img");
    img.src = map.image;
    img.className = "map-image";
    wrapper.appendChild(img);

    Object.entries(map.fields).forEach(([field, pos]) => {
      const box = document.createElement("div");
      box.className = "field-box";

      box.style.left = pos.left + "%";
      box.style.top = pos.top + "%";
      box.style.width = pos.width + "%";
      box.style.height = pos.height + "%";

      // IMPORTANT: use canonical internally
      box.dataset.label = `${canonical} – ${field}`;

      wrapper.appendChild(box);
    });

    container.appendChild(wrapper);
  });
}

// =========================
// INIT
// =========================
async function init() {
  const snapshot = await loadSnapshot();
  const events = snapshot.events || [];

  // ⭐ ADD DEBUG BLOCK HERE ⭐
  console.log("=== RAW FIELD DATA FROM BACKEND ===");
  events.slice(0, 50).forEach(ev => {
    console.log({
      title: ev.title,
      canonical: ev.extendedProps?.canonical,
      surface: ev.extendedProps?.surface,
      canonicalField: ev.extendedProps?.canonicalField,
      rawExtendedProps: ev.extendedProps
    });
  });
  // ⭐ END DEBUG BLOCK ⭐

  const active = [...new Set(events.map(ev => ev.extendedProps?.canonical))];

  renderAllComplexes(active);

  const slider = document.getElementById("timeSlider");
  slider.addEventListener("input", e => {
    const dt = sliderToDate(e.target.value);
    updateTimeLabel(dt);

    const usage = getFieldUsageAtTime(dt, events);
    updateUsageOverlay(usage);
  });

  const now = new Date();
  slider.value = now.getHours() * 60 + now.getMinutes();
  updateTimeLabel(now);

  const usage = getFieldUsageAtTime(now, events);
  updateUsageOverlay(usage);
}


init();
