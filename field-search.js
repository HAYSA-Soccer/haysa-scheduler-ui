// =========================
// CONFIG
// =========================
const API_URL =
  "https://script.google.com/macros/s/AKfycbz14OzCFeMIyWMY6FRLckWwgBBtlLej71cDkYNb-qGEISJVHHWSe57Tp_49wHmwlRTQ/exec";

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
// FETCH SNAPSHOT
// =========================
async function loadSnapshot() {
  const res = await fetch(`${API_URL}?action=getSnapshot`);
  return res.json();
}

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
// GAP / SLOT FINDER
// =========================
function findAvailabilitySlots(timeline, dayStartTs, dayEndTs, minDurationMs, earliestTs) {
  const slots = [];
  let cursor = Math.max(dayStartTs, earliestTs);

  const intervals = timeline || [];

  for (const interval of intervals) {
    if (interval.start > cursor) {
      const gapStart = cursor;
      const gapEnd = Math.min(interval.start, dayEndTs);
      if (gapEnd - gapStart >= minDurationMs) {
        slots.push({ start: gapStart, end: gapEnd });
      }
      cursor = Math.max(cursor, interval.end);
    } else {
      cursor = Math.max(cursor, interval.end);
    }
    if (cursor >= dayEndTs) break;
  }

  if (cursor < dayEndTs) {
    if (dayEndTs - cursor >= minDurationMs) {
      slots.push({ start: cursor, end: dayEndTs });
    }
  }

  return slots;
}

// =========================
// INIT SEARCH
// =========================
async function initSearch() {
  const snapshot = await loadSnapshot();
  const events = snapshot.events || [];

  const dateInput = document.getElementById("dateInput");
  const todayStr = new Date().toISOString().slice(0, 10);
  dateInput.value = todayStr;

  document.getElementById("searchBtn").addEventListener("click", () => {
    const complex = document.getElementById("complexSelect").value;
    const durationMin = parseInt(document.getElementById("durationInput").value, 10);
    const startStr = document.getElementById("startInput").value;
    const dateStr = document.getElementById("dateInput").value;

    if (!durationMin || !startStr || !dateStr) {
      alert("Please fill duration, earliest start, and day.");
      return;
    }

    const [h, m] = startStr.split(":").map(Number);
    const day = new Date(dateStr);

    const dayStart = new Date(day);
    dayStart.setHours(6, 0, 0, 0);   // configurable day window start
    const dayEnd = new Date(day);
    dayEnd.setHours(21, 0, 0, 0);   // configurable day window end

    const earliestTs = new Date(day).setHours(h, m, 0, 0);
    const minDurationMs = durationMin * 60 * 1000;

    const dayEvents = filterEventsForDay(events, day);
    const timelines = buildFieldTimelines(dayEvents);

    const results = [];

    Object.keys(timelines).forEach(canonical => {
      if (complex && canonical !== complex) return;

      Object.keys(timelines[canonical]).forEach(surface => {
        const timeline = timelines[canonical][surface];
        const slots = findAvailabilitySlots(
          timeline,
          dayStart.getTime(),
          dayEnd.getTime(),
          minDurationMs,
          earliestTs
        );

        slots.forEach(slot => {
          results.push({
            canonical,
            surface,
            start: slot.start,
            end: slot.end
          });
        });
      });
    });

    const resultsDiv = document.getElementById("results");
    resultsDiv.innerHTML = "";

    if (results.length === 0) {
      resultsDiv.textContent = "No matching availability. Try a different time, duration, or complex.";
      return;
    }

    results.sort((a, b) => a.start - b.start);

    results.slice(0, 30).forEach(r => {
      const div = document.createElement("div");
      const startStr = new Date(r.start).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
      });
      const endStr = new Date(r.end).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
      });

      div.textContent = `${r.canonical} – ${r.surface}: Available ${startStr}–${endStr}`;
      resultsDiv.appendChild(div);
    });
  });
}

initSearch();
