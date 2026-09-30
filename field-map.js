// =========================
// CONFIG
// =========================
const API_URL =
  "https://script.google.com/macros/s/AKfycbz14OzCFeMIyWMY6FRLckWwgBBtlLej71cDkYNb-qGEISJVHHWSe57Tp_49wHmwlRTQ/exec";

let currentDate = new Date();
let debugMode = false;

// Allowed hours (8am–9pm)
const ALLOWED_START_MIN = 8 * 60;   // 8:00 AM
const ALLOWED_END_MIN   = 21 * 60;  // 9:00 PM;

// =========================
// DAY HELPERS
// =========================
function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth() === b.getMonth() &&
         a.getDate() === b.getDate();
}

function filterEventsForDay(events, day) {
  return events.filter(ev => isSameDay(new Date(ev.start), day));
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
// COMPLEX MAPS
// =========================
const COMPLEX_MAPS = {
  "TURF": {
    canonical: "TURF",
    label: "Turf",
    image: "/haysa-scheduler-ui/assets/turf.jpg",
    fields: {
      "1": {
        svgShape: {
          type: "polygon",
          points: `
            22,34
            49,34
            49,63
            22,63
          `
        }
      },
      "2": {
        svgShape: {
          type: "polygon",
          points: `
            49,34
            76,34
            76,63
            49,63
          `
        }
      },
      "FULL": {
        svgShape: {
          type: "polygon",
          points: `
            22,34
            76,34
            76,63
            22,63
          `
        }
      }
    }
  },

  "BROOKVILLE": {
    canonical: "BROOKVILLE",
    label: "Brookville",
    image: "/haysa-scheduler-ui/assets/brookville.jpg",
    fields: {
      "FULL": {
        svgShape: {
          type: "polygon",
            points: `
              32.66,64.92
              48.93,84.99
              60.57,73.98
              44.49,54.49
              32.66,64.92
              `

        }
      }
    }
  },

  "SUMNER/SEAN JOYCE": {
    canonical: "SUMNER/SEAN JOYCE",
    label: "Sumner/Sean Joyce",
    image: "/haysa-scheduler-ui/assets/sumner.jpg",
    fields: {
      "1": {
        svgShape: {
          type: "polygon",
          points: `
            40,15
            55.5,15
            55.5,32
            40,32
          `
        }
      },
      "1A": {
        svgShape: {
          type: "polygon",
          points: `
            40,23.5
            55.5,23.5
            55.5,32
            40,32
          `
        }
      },
      "1B": {
        svgShape: {
          type: "polygon",
          points: `
            40,15
            55.5,15
            55.5,23.5
            40,23.5
          `
        }
      },

      "2": {
        svgShape: {
          type: "polygon",
          points: `
            60,15
            75.5,15
            75.5,32
            60,32
          `
        }
      },
      "2A": {
        svgShape: {
          type: "polygon",
          points: `
            60,23.5
            75.5,23.5
            75.5,32
            60,32
          `
        }
      },
      "2B": {
        svgShape: {
          type: "polygon",
          points: `
            60,15
            75.5,15
            75.5,23.5
            60,23.5
          `
        }
      },

      "3": {
        svgShape: {
          type: "polygon",
          points: `
            15,69.5
            30.5,69.5
            30.5,86.5
            15,86.5
          `
        }
      },

      "4": {
        svgShape: {
          type: "polygon",
          points: `
            38.91,62.19
            65.96,63.79
            63.83,74.70
            37.67,73.39
          `
        }
      },

      "4A": {
        svgShape: {
          type: "polygon",
          points: `
            38.91,62.19
            51.17,62.91
            49.83,73.84
            37.67,73.39
          `
        }
      },

      "4B": {
        svgShape: {
          type: "polygon",
          points: `
            51.17,62.91
            65.96,63.79
            63.83,74.70
            49.83,73.84
          `
        }
      }
    }
  },

  "AVON BUTLER": {
    canonical: "AVON BUTLER",
    label: "Butler",
    image: "/haysa-scheduler-ui/assets/butler-layout.jpg",
    fields: {
      "FULL": {
        svgShape: {
          type: "polygon",
          points: `
            5,5
            5,5
            5,5
            5,5
          `
        }
      },

      "3": {
        svgShape: {
          type: "polygon",
          points: `
            56,27
            69,27
            69,37
            56,37
          `
        }
      },
      "4": {
        svgShape: {
          type: "polygon",
          points: `
            71.5,27
            84.5,27
            84.5,37
            71.5,37
          `
        }
      },

      "1": {
        svgShape: {
          type: "polygon",
          points: `
            56,40
            69,40
            69,50
            56,50
          `
        }
      },
      "2": {
        svgShape: {
          type: "polygon",
          points: `
            70,40
            83,40
            83,50
            70,50
          `
        }
      },

      "5": {
        svgShape: {
          type: "polygon",
          points: `
            56,58
            71,58
            71,67
            56,67
          `
        }
      },
      "6": {
        svgShape: {
          type: "polygon",
          points: `
            56,68.5
            71,68.5
            71,77.5
            56,77.5
          `
        }
      },

      "BU1": {
        svgShape: {
          type: "polygon",
          points: `
            55,40
            55,40
            55,40
            55,40
          `
        }
      },
      "BU2": {
        svgShape: {
          type: "polygon",
          points: `
            55,45
            55,45
            55,45
            55,45
          `
        }
      },

      "Softball Diamond": {
        svgShape: {
          type: "polygon",
          points: `
            42.41,80.03
            50.43,76.65
            58.11,79.65
            60.61,86.91
            48.09,90.29
          `
        }
      }
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
  return s.trim();
}

function isHalfField(surface) {
  if (!surface) return false;
  return surface.endsWith("A") ||
         surface.endsWith("B") ||
         surface.startsWith("BU");
}

// =========================
// AVAILABILITY TIMELINES
// =========================
function buildAvailabilityTimelines(events) {
  const timelines = {};

  events.forEach(ev => {
    const title = (ev.title || "").toLowerCase();
    if (!title.includes("available")) return;

    // FIXED: read from ICS fields
    const canonical = ev.field;
    const fieldList = String(ev.surface);
    if (!canonical || !fieldList) return;

    const start = new Date(ev.start).getTime();
    const end = new Date(ev.end).getTime();

    // FIXED: ICS only has one surface, not a list
    const fields = [ fieldList ];

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
// BOOKING USAGE ENGINE
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

    const isAvailabilityBlock =
      (ev.title || "").toLowerCase().includes("available");

    const fields = fieldList.split(",").map(f => f.trim());

    fields.forEach(raw => {
      const surface = normalizeSurface(raw);
      if (!usage[canonical]) usage[canonical] = {};

      if (!isAvailabilityBlock) {
        usage[canonical][surface] = { status: "booked", event: ev, start, end };
      }
    });
  });

  return usage;
}

// =========================
// AVAILABILITY WINDOW
// =========================
function getAvailabilityWindow(timeline, ts) {
  if (!timeline || timeline.length === 0) {
    return null;
  }

  for (const interval of timeline) {
    if (ts >= interval.start && ts < interval.end) {
      return { from: ts, to: interval.end };
    }
  }

  return null;
}

// =========================
// SVG HELPERS
// =========================
function polygonCentroid(pointsStr) {
  const pts = pointsStr
    .trim()
    .split(/\s+/)
    .map(p => p.split(",").map(Number));

  let area = 0, cx = 0, cy = 0;

  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [x1, y1] = pts[j];
    const [x2, y2] = pts[i];
    const f = x1 * y2 - x2 * y1;
    area += f;
    cx += (x1 + x2) * f;
    cy += (y1 + y2) * f;
  }

  area *= 0.5;
  cx /= (6 * area);
  cy /= (6 * area);

  return { cx, cy };
}

function placeSvgLabel(svg, poly, text) {
  const layer = svg.querySelector(".label-layer");
  const points = poly.getAttribute("points");
  const { cx, cy } = polygonCentroid(points);

  const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
  t.setAttribute("x", cx);
  t.setAttribute("y", cy);
  t.setAttribute("text-anchor", "middle");
  t.setAttribute("dominant-baseline", "middle");
  t.setAttribute("font-size", "5.5");
  t.setAttribute("font-weight", "600");
  t.setAttribute("fill", "#fff");
  t.setAttribute("stroke", "#000");
  t.setAttribute("stroke-width", "0.5");
  t.setAttribute("paint-order", "stroke fill");
  t.textContent = text;

  layer.appendChild(t);
}

function createComplexSVG(complexKey, complexDef) {
  const wrapper = document.createElement("div");
  wrapper.className = "complex-wrapper";

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.classList.add("complex-svg");
  svg.setAttribute("viewBox", "0 0 100 100");
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");

  const img = document.createElementNS("http://www.w3.org/2000/svg", "image");
  img.setAttribute("href", complexDef.image);
  img.setAttribute("x", "0");
  img.setAttribute("y", "0");
  img.setAttribute("width", "100");
  img.setAttribute("height", "100");
  svg.appendChild(img);

  const polyLayer = document.createElementNS("http://www.w3.org/2000/svg", "g");
  polyLayer.classList.add("polygon-layer");
  svg.appendChild(polyLayer);

  const labelLayer = document.createElementNS("http://www.w3.org/2000/svg", "g");
  labelLayer.classList.add("label-layer");
  svg.appendChild(labelLayer);

  wrapper.appendChild(svg);
  return { wrapper, svg, polyLayer, labelLayer };
}

function rectToPolygonPoints(left, top, width, height) {
  const x1 = left;
  const y1 = top;
  const x2 = left + width;
  const y2 = top + height;

  return `
    ${x1.toFixed(2)},${y1.toFixed(2)}
    ${x2.toFixed(2)},${y1.toFixed(2)}
    ${x2.toFixed(2)},${y2.toFixed(2)}
    ${x1.toFixed(2)},${y2.toFixed(2)}
  `;
}

function addFieldPolygon(polyLayer, canonical, surface, fieldDef) {
  const poly = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
  poly.dataset.canonical = canonical;
  poly.dataset.surface = surface;
  poly.classList.add("field-poly");

  if (fieldDef.svgShape && fieldDef.svgShape.type === "polygon") {
    poly.setAttribute("points", fieldDef.svgShape.points.trim());
  } else if (
    typeof fieldDef.left === "number" &&
    typeof fieldDef.top === "number" &&
    typeof fieldDef.width === "number" &&
    typeof fieldDef.height === "number"
  ) {
    const pts = rectToPolygonPoints(fieldDef.left, fieldDef.top, fieldDef.width, fieldDef.height);
    poly.setAttribute("points", pts.trim());
  } else {
    const pts = `
      10.00,10.00
      40.00,10.00
      40.00,40.00
      10.00,40.00
    `;
    poly.setAttribute("points", pts.trim());
  }

  polyLayer.appendChild(poly);
}

// =========================
// UPDATE OVERLAY
// =========================
function updateUsageOverlay(usage, timelines, dt) {

  const minutes = dt.getHours() * 60 + dt.getMinutes();
  const ts = dt.getTime();

  document.querySelectorAll(".label-layer text").forEach(t => t.remove());

  document.querySelectorAll("polygon.field-poly").forEach(poly => {
    const canonical = poly.dataset.canonical;
    const surface = normalizeSurface(poly.dataset.surface);

    console.log("Checking:", canonical, surface, usage[canonical]?.[surface]);
    
    const svg = poly.ownerSVGElement;

    const u = usage[canonical]?.[surface];
    const timeline = timelines[canonical]?.[surface];
    const window = getAvailabilityWindow(timeline, ts);

    poly.classList.remove("available", "booked", "blocked");

    if (minutes < ALLOWED_START_MIN || minutes >= ALLOWED_END_MIN) {
      poly.classList.add("blocked");
      return;
    }

    if (u) {
      poly.classList.add("booked");

      const startStr = new Date(u.start).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
      });
      const endStr = new Date(u.end).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
      });

      placeSvgLabel(svg, poly, `Booked ${startStr}–${endStr}`);
      return;
    }

    if (window) {
      poly.classList.add("available");

      const toStr = new Date(window.to).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
      });

      placeSvgLabel(svg, poly, `Available until ${toStr}`);
      return;
    }

    poly.classList.add("blocked");
  });

  Object.keys(timelines).forEach(canonical => {
    const fullPoly = document.querySelector(
      `polygon.field-poly[data-canonical="${canonical}"][data-surface="FULL"]`
    );
    if (!fullPoly) return;

    const bookedCount = Object.keys(usage[canonical] || {}).length;

    fullPoly.classList.remove("available", "booked", "blocked", "partial", "full");

    if (bookedCount === 0) {
      fullPoly.classList.add("available");
    } else if (bookedCount === 1) {
      fullPoly.classList.add("partial");
    } else {
      fullPoly.classList.add("full");
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
    const def = COMPLEX_MAPS[canonical];
    if (!def) return;

    const { wrapper, svg, polyLayer } = createComplexSVG(canonical, def);

    Object.entries(def.fields).forEach(([surface, fieldDef]) => {
      addFieldPolygon(polyLayer, canonical, surface, fieldDef);
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
  let dayTimelines = buildAvailabilityTimelines(dayEvents);

  const active = Object.keys(COMPLEX_MAPS);
  renderAllComplexes(active);

  updateDayLabel();

  const slider = document.getElementById("timeSlider");
  const radarDate = document.getElementById("radarDate");
  const prevBtn = document.getElementById("prevDay");
  const nextBtn = document.getElementById("nextDay");
  const debugToggle = document.getElementById("debugToggle");

  function attachSvgDebugHandlers() {
    document.querySelectorAll(".complex-svg").forEach(svg => {
      svg.style.pointerEvents = debugMode ? "auto" : "none";

      const newSvg = svg.cloneNode(true);
      svg.parentNode.replaceChild(newSvg, svg);

      newSvg.addEventListener("click", e => {
        if (!debugMode) return;

        const rect = newSvg.getBoundingClientRect();
        const xPx = e.clientX - rect.left;
        const yPx = e.clientY - rect.top;

        const x = (xPx / rect.width) * 100;
        const y = (yPx / rect.height) * 100;

        console.log(`Clicked at: ${x.toFixed(2)}, ${y.toFixed(2)}`);
      });
    });
  }

  attachSvgDebugHandlers();

  if (debugToggle) {
    debugToggle.addEventListener("click", () => {
      debugMode = !debugMode;
      debugToggle.textContent = debugMode ? "Debug (ON)" : "Debug";
      attachSvgDebugHandlers();
    });
  }

  const jump = JSON.parse(localStorage.getItem("radarJump") || "null");
  if (jump) {
    currentDate = new Date(jump.start);
    updateDayLabel();

    dayEvents = filterEventsForDay(events, currentDate);
    dayTimelines = buildAvailabilityTimelines(dayEvents);

    const dt = new Date(jump.start);
    slider.value = dt.getHours() * 60 + dt.getMinutes();
    updateTimeLabel(dt);

    const usage = getFieldUsageAtTime(dt, dayEvents);
    updateUsageOverlay(usage, dayTimelines, dt);

    if (jump.canonical && jump.surface) {
      const labelSurface = normalizeSurface(jump.surface);
      const poly = document.querySelector(
        `polygon.field-poly[data-canonical="${jump.canonical}"][data-surface="${labelSurface}"]`
      );
      if (poly) {
        poly.classList.add("highlight");
        poly.ownerSVGElement.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }

    localStorage.removeItem("radarJump");
  } else {
    const now = new Date(currentDate);
    slider.value = now.getHours() * 60 + now.getMinutes();
    updateTimeLabel(now);

    const usage = getFieldUsageAtTime(now, dayEvents);
    updateUsageOverlay(usage, dayTimelines, now);
  }

  if (radarDate) {
    radarDate.value = currentDate.toISOString().slice(0, 10);
    radarDate.addEventListener("change", e => {
      currentDate = new Date(e.target.value);
      updateDayLabel();

      dayEvents = filterEventsForDay(events, currentDate);
      dayTimelines = buildAvailabilityTimelines(dayEvents);

      const dt = new Date(currentDate);
      dt.setHours(17, 0, 0, 0);

      slider.value = dt.getHours() * 60 + dt.getMinutes();
      updateTimeLabel(dt);

      const usage = getFieldUsageAtTime(dt, dayEvents);
      updateUsageOverlay(usage, dayTimelines, dt);
    });
  }

  slider.addEventListener("input", e => {
    const dt = sliderToDate(e.target.value);
    updateTimeLabel(dt);

    const usage = getFieldUsageAtTime(dt, dayEvents);
    updateUsageOverlay(usage, dayTimelines, dt);
  });

  if (prevBtn) {
    prevBtn.addEventListener("click", () => {
      currentDate.setDate(currentDate.getDate() - 1);
      updateDayLabel();

      dayEvents = filterEventsForDay(events, currentDate);
      dayTimelines = buildAvailabilityTimelines(dayEvents);

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
      dayTimelines = buildAvailabilityTimelines(dayEvents);

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
