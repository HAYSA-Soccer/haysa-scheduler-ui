// =========================
// CONFIG
// =========================
const API_URL =
  "https://script.google.com/macros/s/AKfycbz14OzCFeMIyWMY6FRLckWwgBBtlLej71cDkYNb-qGEISJVHHWSe57Tp_49wHmwlRTQ/exec";

// Canonical → Display label
const LABELS = {
  "AVON BUTLER": "Butler",
  "TURF": "Turf"
};

// =========================
// COMPLEX MAP DEFINITIONS
// =========================
const COMPLEX_MAPS = {
  "AVON BUTLER": {
    label: "Butler",
    image: "assets/butler-layout.jpg",

    fields: {
      "3A": { left: 55.8, top: 27.0, width: 10.5, height: 10.4 },
      "3B": { left: 55.8, top: 27.0, width: 10.5, height: 10.4 },
      "4A": { left: 71.3, top: 27.0, width: 10.3, height: 10.6 },
      "4B": { left: 71.3, top: 27.0, width: 10.3, height: 10.6 },
      "1A": { left: 55.8, top: 39.1, width: 10.3, height: 10.6 },
      "1B": { left: 55.8, top: 39.1, width: 10.3, height: 10.6 },
      "2A": { left: 69.8, top: 40.1, width: 10.3, height: 10.6 },
      "2B": { left: 69.8, top: 40.1, width: 10.3, height: 10.6 },
      "5A": { left: 55.8, top: 57.7, width: 10.3, height: 10.2 },
      "5B": { left: 55.8, top: 57.7, width: 10.3, height: 10.2 },
      "6A": { left: 55.8, top: 68.4, width: 10.3, height: 10.4 },
      "6B": { left: 55.8, top: 68.4, width: 10.3, height: 10.4 },
      "FULL": { left: 10, top: 10, width: 80, height: 80 }
    }
  },

  "TURF": {
    label: "Turf",
    image: "assets/turf.jpg",
    fields: {
      "A": { left: 10, top: 10, width: 40, height: 80 },
      "B": { left: 50, top: 10, width: 40, height: 80 },
      "FULL": { left: 10, top: 10, width: 80, height: 80 }
    }
  }
};

// =========================
// FETCH BACKEND SNAPSHOT
// =========================
async function loadSnapshot() {
  const res = await fetch(`${API_URL}?action=getSnapshot`);
  return res.json();
}

// =========================
// TIME SLIDER → DATE
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
  const label = document.getElementById("timeLabel");
  label.textContent = dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// =========================
// USAGE ENGINE
// =========================
function getFieldUsageAtTime(dt, events) {
  const ts = dt.getTime();
  const usage = {};

  events.forEach(ev => {
    const canonical = ev.extendedProps?.canonical;
    const surface = ev.extendedProps?.surface;
    if (!canonical || !surface) return;

    const start = new Date(ev.start).getTime();
    const end = new Date(ev.end).getTime();

    if (ts >= start && ts < end) {
      if (!usage[canonical]) usage[canonical] = {};
      usage[canonical][surface] = { status: "booked", event: ev };
    }
  });

  return usage;
}

// =========================
// UPDATE MAP OVERLAY
// =========================
function updateUsageOverlay(usage) {
  document.querySelectorAll(".field-box").forEach(el => {
    const label = el.dataset.label; // e.g. "Turf – A"
    const [canonical, surface] = label.split(" – ");

    const u = usage[canonical]?.[surface];

    el.classList.remove("open", "booked", "partial", "full");

    if (!u) {
      el.classList.add("open");
    } else {
      el.classList.add("booked");
    }
  });

  // FULL field logic
  Object.keys(usage).forEach(canonical => {
    const surfaces = usage[canonical];
    if (!surfaces) return;

    const A = surfaces["A"]?.status === "booked";
    const B = surfaces["B"]?.status === "booked";

    const fullEl = document.querySelector(
      `.field-box[data-label="${canonical} – FULL"]`
    );

    if (!fullEl) return;

    fullEl.classList.remove("open", "booked", "partial", "full");

    if (!A && !B) {
      fullEl.classList.add("open");
    } else if (A && B) {
      fullEl.classList.add("full");
    } else {
      fullEl.classList.add("partial");
    }
  });
}

// =========================
// RENDER MAPS
// =========================
function renderAllComplexes(active) {
  const container = document.getElementById("all-complexes");
  container.innerHTML = "";

  active.forEach(c => {
    const map = COMPLEX_MAPS[c];
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

      box.dataset.label = `${map.label} – ${field}`;

      wrapper.appendChild(box);
    });

    container.appendChild(wrapper);
  });
}

// =========================
// MAIN INIT
// =========================
async function init() {
  const snapshot = await loadSnapshot();
  const events = snapshot.events || [];
  const active = snapshot.activeComplexes || [];

  renderAllComplexes(active);

  // Slider listener
  const slider = document.getElementById("timeSlider");
  slider.addEventListener("input", e => {
    const dt = sliderToDate(e.target.value);
    updateTimeLabel(dt);

    const usage = getFieldUsageAtTime(dt, events);
    updateUsageOverlay(usage);
  });

  // Initialize at current time
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  slider.value = minutes;
  updateTimeLabel(now);

  const usage = getFieldUsageAtTime(now, events);
  updateUsageOverlay(usage);
}

init();
