// =========================
// CONFIG
// =========================
const API_URL =
  "https://script.google.com/macros/s/AKfycbz14OzCFeMIyWMY6FRLckWwgBBtlLej71cDkYNb-qGEISJVHHWSe57Tp_49wHmwlRTQ/exec";

// =========================
// FIELD TYPE DEFINITIONS
// =========================
const FIELD_TYPE = {
  "SUMNER/SEAN JOYCE": {
    full: ["1", "2", "3", "4"],
    half: ["1A", "1B", "2A", "2B", "3A", "3B", "4A", "4B"]
  },
  "TURF": {
    full: ["FULL"],
    half: ["1", "2"] // or rename to H-HST1/H-HST2 if needed
  },
  "AVON BUTLER": {
    full: ["FULL"],
    half: ["1", "2", "3", "4", "5", "6", "BU1", "BU2"]
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
// FIELD TIMELINES (NO NORMALIZATION)
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
    fields.forEach(surface => {
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
// GAP FINDER (EARLIEST START)
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
// EXACT-TIME CHECK
// =========================
function isFieldFreeForDuration(timeline, startTs, durationMs) {
  const endTs = startTs + durationMs;

  if (!timeline || timeline.length === 0) return true;

  for (const interval of timeline) {
    // If ANY overlap → not free
    if (!(interval.end <= startTs || interval.start >= endTs)) {
      return false;
    }
  }

  return true;
}

// =========================
// INIT SEARCH
// =========================
async function initSearch() {
  const snapshot = await loadSnapshot();
  const events = snapshot.events || [];

  const dateInput = document.getElementById("dateInput");
  dateInput.value = new Date().toISOString().slice(0, 10);

  document.getElementById("searchBtn").addEventListener("click", () => {
    const complex = document.getElementById("complexSelect").value;
    const fieldType = document.getElementById("fieldTypeSelect").value;
    const searchType = document.getElementById("searchTypeSelect").value;

    const durationMin = parseInt(document.getElementById("durationInput").value, 10);
    const startStr = document.getElementById("startInput").value;
    const dateStr = document.getElementById("dateInput").value;

    if (!durationMin || !startStr || !dateStr) {
      alert("Please fill duration, start time, and day.");
      return;
    }

    const [h, m] = startStr.split(":").map(Number);
    const day = new Date(dateStr);

    const dayStart = new Date(day);
    dayStart.setHours(6, 0, 0, 0);

    const dayEnd = new Date(day);
    dayEnd.setHours(21, 0, 0, 0);

    const earliestTs = new Date(day).setHours(h, m, 0, 0);
    const minDurationMs = durationMin * 60 * 1000;

    const dayEvents = filterEventsForDay(events, day);
    const timelines = buildFieldTimelines(dayEvents);

    const results = [];

    Object.keys(timelines).forEach(canonical => {
      if (complex && canonical !== complex) return;

      Object.keys(timelines[canonical]).forEach(surface => {
        // FIELD TYPE FILTER
        if (fieldType === "full" &&
            !FIELD_TYPE[canonical].full.includes(surface)) return;

        if (fieldType === "half" &&
            !FIELD_TYPE[canonical].half.includes(surface)) return;

        const timeline = timelines[canonical][surface];

        // SEARCH TYPE LOGIC
        if (searchType === "earliest") {
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

        } else if (searchType === "exact") {
          const startTs = earliestTs;
          const endTs = startTs + minDurationMs;

          if (startTs >= dayStart.getTime() && endTs <= dayEnd.getTime()) {
            if (isFieldFreeForDuration(timeline, startTs, minDurationMs)) {
              results.push({
                canonical,
                surface,
                start: startTs,
                end: endTs
              });
            }
          }
        }
      });
    });

    const resultsDiv = document.getElementById("results");
    resultsDiv.innerHTML = "";

    if (results.length === 0) {
      resultsDiv.textContent = "No matching availability. Try a different time, duration, or complex.";
      return;
    }

    results.sort((a, b) => a.start - b.start);

    results.slice(0, 50).forEach(r => {
      const div = document.createElement("div");
      div.className = "result-item";

      const startStr = new Date(r.start).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
      });
      const endStr = new Date(r.end).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
      });

      div.innerHTML = `
        <strong>${r.canonical} – ${r.surface}</strong>
        Available ${startStr}–${endStr}
      `;

      // SHOW ON RADAR BUTTON
      const btn = document.createElement("button");
      btn.textContent = "Show on Radar";
      btn.addEventListener("click", () => {
        localStorage.setItem("radarJump", JSON.stringify({
          canonical: r.canonical,
          surface: r.surface,
          start: r.start
        }));
        window.location.href = "/haysa-scheduler-ui/field-map.html";
      });

      div.appendChild(btn);
      resultsDiv.appendChild(div);
    });
  });
}

initSearch();
