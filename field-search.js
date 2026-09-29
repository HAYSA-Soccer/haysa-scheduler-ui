// =========================
// CONFIG
// =========================
const API_URL =
  "https://script.google.com/macros/s/AKfycbz14OzCFeMIyWMY6FRLckWwgBBtlLej71cDkYNb-qGEISJVHHWSe57Tp_49wHmwlRTQ/exec";

// Allowed hours (8am–9pm)
const ALLOWED_START_MIN = 8 * 60;   // 8:00 AM
const ALLOWED_END_MIN   = 21 * 60;  // 9:00 PM;

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
    half: ["1", "2"]
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
// TIMELINE BUILDERS
// =========================
function normalizeSurface(s) {
  if (!s) return null;
  return s.trim();
}

function buildTimelines(events, predicateFn) {
  const timelines = {};

  events.forEach(ev => {
    if (!predicateFn(ev)) return;

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

function isAvailabilityEvent(ev) {
  return (ev.title || "").toLowerCase().includes("available");
}

function isBookingEvent(ev) {
  return !(ev.title || "").toLowerCase().includes("available");
}

// =========================
// BOOKING CHECK
// =========================
function isFreeOfBookings(timelineBooked, startTs, endTs) {
  const intervals = timelineBooked || [];
  for (const interval of intervals) {
    if (!(interval.end <= startTs || interval.start >= endTs)) {
      return false;
    }
  }
  return true;
}

// =========================
// AVAILABILITY CHECK
// =========================
function isWithinAvailability(timelineAvail, startTs, endTs) {
  const intervals = timelineAvail || [];
  for (const interval of intervals) {
    const s = interval.start;
    const e = interval.end;
    if (startTs >= s && endTs <= e) {
      return true;
    }
  }
  return false;
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
    dayStart.setHours(8, 0, 0, 0);

    const dayEnd = new Date(day);
    dayEnd.setHours(21, 0, 0, 0);

    let earliestTs = new Date(day).setHours(h, m, 0, 0);
    const allowedStartTs = new Date(day).setHours(8, 0, 0, 0).getTime();
    const allowedEndTs = new Date(day).setHours(21, 0, 0, 0).getTime();

    if (earliestTs < allowedStartTs) earliestTs = allowedStartTs;
    if (earliestTs >= allowedEndTs) {
      alert("Start time must be between 8:00 AM and 9:00 PM.");
      return;
    }

    const minDurationMs = durationMin * 60 * 1000;

    const dayEvents = filterEventsForDay(events, day);
    const availTimelines = buildTimelines(dayEvents, isAvailabilityEvent);
    const bookingTimelines = buildTimelines(dayEvents, isBookingEvent);

    const results = [];

    Object.keys(availTimelines).forEach(canonical => {
      if (complex && canonical !== complex) return;

      Object.keys(availTimelines[canonical]).forEach(surface => {
        if (fieldType === "full" &&
            !FIELD_TYPE[canonical]?.full.includes(surface)) return;

        if (fieldType === "half" &&
            !FIELD_TYPE[canonical]?.half.includes(surface)) return;

        const timelineAvail = availTimelines[canonical][surface];
        const timelineBooked = bookingTimelines[canonical]?.[surface] || [];

        if (searchType === "earliest") {
          let chosenSlot = null;

          for (const interval of timelineAvail) {
            let slotStart = Math.max(interval.start, earliestTs);
            const slotEnd = slotStart + minDurationMs;

            if (slotEnd > interval.end) continue;
            if (slotStart < allowedStartTs || slotEnd > allowedEndTs) continue;

            if (isFreeOfBookings(timelineBooked, slotStart, slotEnd)) {
              chosenSlot = { start: slotStart, end: slotEnd };
              break;
            }
          }

          if (chosenSlot) {
            results.push({
              canonical,
              surface,
              start: chosenSlot.start,
              end: chosenSlot.end
            });
          }

        } else if (searchType === "exact") {
          const startTs = earliestTs;
          const endTs = startTs + minDurationMs;

          if (startTs < allowedStartTs || endTs > allowedEndTs) return;

          if (!isWithinAvailability(timelineAvail, startTs, endTs)) return;
          if (!isFreeOfBookings(timelineBooked, startTs, endTs)) return;

          results.push({
            canonical,
            surface,
            start: startTs,
            end: endTs
          });
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

    // Set radarJump for the search time (no specific field)
    localStorage.setItem("radarJump", JSON.stringify({
      canonical: null,
      surface: null,
      start: results[0].start // use earliest result time
    }));
    const frame = document.getElementById("radarFrame");
    if (frame && frame.contentWindow) {
      frame.contentWindow.location.reload();
    }

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

      const btn = document.createElement("button");
      btn.textContent = "Show on Radar";
      btn.addEventListener("click", () => {
        localStorage.setItem("radarJump", JSON.stringify({
          canonical: r.canonical,
          surface: r.surface,
          start: r.start
        }));
        const frame = document.getElementById("radarFrame");
        if (frame && frame.contentWindow) {
          frame.contentWindow.location.reload();
        }
      });

      div.appendChild(btn);
      resultsDiv.appendChild(div);
    });
  });
}

initSearch();
