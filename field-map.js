// =========================
// CONFIG
// =========================
const API_URL =
  "https://script.google.com/macros/s/AKfycbz14OzCFeMIyWMY6FRLckWwgBBtlLej71cDkYNb-qGEISJVHHWSe57Tp_49wHmwlRTQ/exec";

let currentDate = new Date(); // today by default

// =========================
// DAY HELPERS
// =========================
function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth() === b.getMonth() &&
         a.getDate() === b.getDate();
}

function filterEventsForDay(events, day) {
  return events.filter(ev => {
    const start = new Date(ev.start);
    return isSameDay(start, day);
  });
}

function updateDayLabel() {
  const el = document.getElementById("dayLabel");
  if (!el) return;
  el.textContent = currentDate.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric"
  });
}

// =========================
// COMPLEX MAP DEFINITIONS
// =========================
const COMPLEX_MAPS = {
  "TURF": {
    canonical: "TURF",
    label: "Turf",
    image: "/haysa-scheduler-ui/assets/turf.jpg",
    fields: {
      "FULL": { left: 22, top: 15, width: 54, height: 62 },
      "1": { left: 22, top: 15, width: 27, height: 62 },
      "2": { left: 49, top: 15, width: 27, height: 62 }
    }
  },

  "SUMNER/SEAN JOYCE": {
    canonical: "SUMNER/SEAN JOYCE",
    label: "Sumner/Sean Joyce",
    image: "/haysa-scheduler-ui/assets/sumner.jpg",
    fields: {
      "1": { left: 40, top: 15, width: 15.5, height: 17 },
      "1A": { left: 40, top: 23.5, width: 15.5, height: 8.5 },
      "1B": { left: 40, top: 15, width: 15.5, height: 8.5 },

      "2": { left: 60, top: 15, width: 15.5, height: 17 },
      "2A": { left: 60, top: 23.5, width: 15.5, height: 8.5 },
      "2B": { left: 60, top: 15, width: 15.5, height: 8.5 },

      "3":  { left: 15, top: 69.5, width: 15.5, height: 17, rotate: 10.2 },
      "3A": { left: 40, top: 75,   width: 0,    height: 0,  rotate: 20 },
      "3B": { left: 50, top: 75,   width: 0,    height: 0,  rotate: 20 },

      "4":  { left: 38, top: 64.5, width: 28.5, height: 9,  rotate: 0 },
      "4A": { left: 38, top: 63.5, width: 13,   height: 9,  rotate: 8 },
      "4B": { left: 51, top: 64.5, width: 13,   height: 9,  rotate: 8 }
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
  const dt = new Date(currentDate);
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
  if (/^\d[A-B]$/.test(s)) return s[0];
  if (/^\d+$/.test(s)) return s;

  if (s.startsWith("BU")) return "FULL";
  if (s.toLowerCase().includes("softball")) return "FULL";
  if (s.toLowerCase().includes("mini")) return "FULL";

  return s;
}

// =========================
// FIELD TIMELINES
// =========================
function buildFieldTimelines(events) {
  const timelines = {};

  events.forEach(ev => {
    const canonical = ev.extendedProps?.canonical;
    const fieldList = ev.extendedProps?.fields;
    if (!canonical || !fieldList) return;

    const start = new Date(ev.start).getTime();
    const end = new Date(ev.end).getTime();

    const fields = fieldList.split(",").map(f => f.trim());
    fields.forEach(raw => {
      const surface = normalizeSurface(raw);

      if (!timelines[canonical]) timelines[canonical] = {};
      if (!timelines[canonical][surface]) timelines[canonical][surface] = [];

      timelines[canonical][surface].push({ start, end });
    });
  });

  Object.keys(timelines).forEach(canonical => {
    Object.keys(timelines[canonical]).forEach(surface => {
      timelines[canonical][surface].sort((a, b) => a.start - b.start);
    });
  });

  return timelines;
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

    const fields = fieldList.split(",").map(f => f.trim());

    fields.forEach(raw => {
      const surface = normalizeSurface(raw);

      if (!usage[canonical]) usage[canonical] = {};
      usage[canonical][surface] = { status: "booked", event: ev, start, end };
    });
  });

  return usage;
}

// =========================
// AVAILABILITY WINDOW
// =========================
function getAvailabilityWindow(timeline, ts) {
  if (!timeline || timeline.length === 0) {
    return { from: ts, to: null };
  }

  let currentlyBooked = false;
  let nextStart = null;

  for (const interval of timeline) {
    if (ts >= interval.start && ts < interval.end) {
      currentlyBooked = true;
      break;
    }
    if (interval.start > ts && nextStart === null) {
      nextStart = interval.start;
    }
  }

  if (currentlyBooked) return null;

  return { from: ts, to: nextStart };
}

// =========================
– UPDATE OVERLAY
// =========================
function updateUsageOverlay(usage, timelines, dt) {
  const ts = dt.getTime();

  document.querySelectorAll(".field-box").forEach(el => {
    const [canonical, rawSurface] = el.dataset.label.split(" – ");
    const normalized = normalizeSurface(rawSurface);

    const u = usage[canonical]?.[normalized];

    el.classList.remove("open", "booked", "partial", "full", "highlight");
    el.textContent = "";

    if (!u) {
      el.classList.add("open");

      const timeline = timelines[canonical]?.[normalized];
      const window = getAvailabilityWindow(timeline, ts);
      if (window) {
        const toStr = window.to
          ? new Date(window.to).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit"
            })
          : "end of day";

        el.textContent = `Available until ${toStr}`;
      }
    } else {
      el.classList.add("booked");

      const startStr = new Date(u.start).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
      });
      const endStr = new Date(u.end).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
      });

      const durationMin = Math.round((u.end - u.start) / (60 * 1000));

      el.textContent = `Booked ${startStr}–${endStr} (${durationMin} min)`;
    }
  });

  Object.keys(timelines).forEach(canonical => {
    const fullEl = document.querySelector(
      `.field-box[data-label="${canonical} – FULL"]`
    );
    if (!fullEl) return;

    const bookedCount = Object.keys(usage[canonical] || {}).length;

    fullEl.classList.remove("open", "booked", "partial", "full");

    if (bookedCount === 0) {
      fullEl.classList.add("open");
    } else if (bookedCount === 1) {
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

      if (pos.rotate) {
        box.style.transform = `rotate(${pos.rotate}deg)`;
        box.style.transformOrigin = "center";
      }

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

  let dayEvents = filterEventsForDay(events, currentDate);
  let dayTimelines = buildFieldTimelines(dayEvents);

  const active = [...new Set(events.map(ev => ev.extendedProps?.canonical))];
  renderAllComplexes(active);

  updateDayLabel();

  const slider = document.getElementById("timeSlider");

  const jump = JSON.parse(localStorage.getItem("radarJump") || "null");
  if (jump) {
    currentDate = new Date(jump.start);
    updateDayLabel();

    dayEvents = filterEventsForDay(events, currentDate);
    dayTimelines = buildFieldTimelines(dayEvents);

    const dt = new Date(jump.start);
    slider.value = dt.getHours() * 60 + dt.getMinutes();
    updateTimeLabel(dt);

    const usage = getFieldUsageAtTime(dt, dayEvents);
    updateUsageOverlay(usage, dayTimelines, dt);

    const el = document.querySelector(
      `.field-box[data-label="${jump.canonical} – ${normalizeSurface(jump.surface)}"]`
    );
    if (el) el.classList.add("highlight");

    localStorage.removeItem("radarJump");
  } else {
    const now = new Date(currentDate);
    slider.value = now.getHours() * 60 + now.getMinutes();
    updateTimeLabel(now);

    const usage = getFieldUsageAtTime(now, dayEvents);
    updateUsageOverlay(usage, dayTimelines, now);
  }

  slider.addEventListener("input", e => {
    const dt = sliderToDate(e.target.value);
    updateTimeLabel(dt);

    const usage = getFieldUsageAtTime(dt, dayEvents);
    updateUsageOverlay(usage, dayTimelines, dt);
  });

  const prevBtn = document.getElementById("prevDay");
  const nextBtn = document.getElementById("nextDay");
  const radarDate = document.getElementById("radarDate");

  if (radarDate) {
    radarDate.value = currentDate.toISOString().slice(0, 10);
    radarDate.addEventListener("change", e => {
      currentDate = new Date(e.target.value);
      updateDayLabel();

      dayEvents = filterEventsForDay(events, currentDate);
      dayTimelines = buildFieldTimelines(dayEvents);

      const dt = new Date(currentDate);
      dt.setHours(17, 0, 0, 0);

      slider.value = dt.getHours() * 60 + dt.getMinutes();
      updateTimeLabel(dt);

      const usage = getFieldUsageAtTime(dt, dayEvents);
      updateUsageOverlay(usage, dayTimelines, dt);
    });
  }

  if (prevBtn) {
    prevBtn.addEventListener("click", () => {
      currentDate.setDate(currentDate.getDate() - 1);
      updateDayLabel();

      dayEvents = filterEventsForDay(events, currentDate);
      dayTimelines = buildFieldTimelines(dayEvents);

      const dt = new Date(currentDate);
      dt.setHours(17, 0, 0, 0);

      slider.value = dt.getHours() * 60 + dt.getMinutes();
      updateTimeLabel(dt);

      const usage = getFieldUsageAtTime(dt, dayEvents);
      updateUsageOverlay(usage, dayTimelines, dt);

      if (radarDate) {
        radarDate.value = currentDate.toISOString().slice(0, 10);
      }
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      currentDate.setDate(currentDate.getDate() + 1);
      updateDayLabel();

      dayEvents = filterEventsForDay(events, currentDate);
      dayTimelines = buildFieldTimelines(dayEvents);

      const dt = new Date(currentDate);
      dt.setHours(17, 0, 0, 0);

      slider.value = dt.getHours() * 60 + dt.getMinutes();
      updateTimeLabel(dt);

      const usage = getFieldUsageAtTime(dt, dayEvents);
      updateUsageOverlay(usage, dayTimelines, dt);

      if (radarDate) {
        radarDate.value = currentDate.toISOString().slice(0, 10);
      }
    });
  }
}

init();
