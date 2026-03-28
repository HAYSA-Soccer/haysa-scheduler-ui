// ------------------------------------------------------------
// Helper functions for merging and subtracting time windows
// ------------------------------------------------------------
function mergeWindows(events) {
  if (!events.length) return [];
  const windows = events.map(e => ({
    start: new Date(e.start),
    end: new Date(e.end)
  }));

  windows.sort((a, b) => a.start - b.start);

  const merged = [];
  let current = windows[0];

  for (let i = 1; i < windows.length; i++) {
    const next = windows[i];
    if (next.start <= current.end) {
      current.end = new Date(Math.max(current.end, next.end));
    } else {
      merged.push(current);
      current = next;
    }
  }

  merged.push(current);
  return merged;
}

function subtractWindows(avail, blockers) {
  let free = [...avail];

  for (const b of blockers) {
    const block = { start: new Date(b.start), end: new Date(b.end) };
    const updated = [];

    for (const w of free) {
      if (block.end <= w.start || block.start >= w.end) {
        updated.push(w);
        continue;
      }

      if (block.start > w.start) {
        updated.push({ start: w.start, end: block.start });
      }

      if (block.end < w.end) {
        updated.push({ start: block.end, end: w.end });
      }
    }

    free = updated;
    if (!free.length) break;
  }

  return free;
}

// ------------------------------------------------------------
// Classification Logic
// ------------------------------------------------------------
function classifyEvent(ev) {
  const t = (ev.extendedProps.type || "").toLowerCase();
  const title = (ev.title || "").toLowerCase();

  if (t === "availability") return "availability";

  if (title.includes("practice") || title.includes("prac")) return "practice";

  if (title.includes("vs")) return "game";

  if (t === "practice") return "practice";

  if (t === "game") return "game";

  return "block";
}

// ------------------------------------------------------------
// Main UI logic
// ------------------------------------------------------------
document.addEventListener("DOMContentLoaded", async function () {
  const calendarEl = document.getElementById("calendar");
  const lastUpdatedEl = document.getElementById("last-updated");

  function normalizeFieldName(name) {
    return (name || "").toUpperCase().trim();
  }

  function getSelectedFields() {
    return Array.from(document.querySelectorAll('#field-filters input:checked'))
      .map(cb => normalizeFieldName(cb.value));
  }

  function getSelectedTypes() {
    return Array.from(document.querySelectorAll('#type-filters input:checked'))
      .map(cb => cb.value.toLowerCase());
  }

  let allEvents = [];
  let collapsedAvailabilityByField = {};

  const url = "https://script.google.com/macros/s/AKfycbz14OzCFeMIyWMY6FRLckWwgBBtlLej71cDkYNb-qGEISJVHHWSe57Tp_49wHmwlRTQ/exec";

  async function loadData() {
    const response = await fetch(url);
    const data = await response.json();

    if (lastUpdatedEl) {
      lastUpdatedEl.innerText = `Calendar last updated: ${data.lastUpdate}`;
    }

    allEvents = (data.events || []).map(ev => {
      const ext = ev.extendedProps || {};
      const fieldKey = normalizeFieldName(ext.canonical || ext.field || "");

      return {
        ...ev,
        extendedProps: {
          ...ext,
          fieldKey,
          uiType: classifyEvent(ev)
        }
      };
    });

    precomputeCollapsedAvailability();
  }

  function precomputeCollapsedAvailability() {
    collapsedAvailabilityByField = {};

    const grouped = {};
    for (const ev of allEvents) {
      const fieldKey = ev.extendedProps.fieldKey;
      if (!grouped[fieldKey]) grouped[fieldKey] = [];
      grouped[fieldKey].push(ev);
    }

    for (const fieldKey of Object.keys(grouped)) {
      const events = grouped[fieldKey];

      const availability = events.filter(e => e.extendedProps.uiType === "availability");
      const blockers = events.filter(e => e.extendedProps.uiType !== "availability");

      if (!availability.length) {
        collapsedAvailabilityByField[fieldKey] = [];
        continue;
      }

      const merged = mergeWindows(availability);
      const freeWindows = subtractWindows(merged, blockers);

      if (!freeWindows.length) {
        collapsedAvailabilityByField[fieldKey] = [];
        continue;
      }

      const surfaces = availability.map(a => a.extendedProps.surface).filter(Boolean);

      collapsedAvailabilityByField[fieldKey] = freeWindows.map(win => ({
        title: "Available",
        start: win.start,
        end: win.end,
        backgroundColor: "#6FCF97",
        borderColor: "#4CAF50",
        extendedProps: {
          uiType: "availability",
          fieldKey,
          freeSurfaces: surfaces
        }
      }));
    }
  }

  await loadData();

  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: "timeGridWeek",
    firstDay: 1,
    height: "auto",
    slotMinTime: "08:00:00",
    slotMaxTime: "21:00:00",
    allDaySlot: false,

    events: function (fetchInfo, successCallback) {
      const selectedFields = getSelectedFields();
      const selectedTypes = getSelectedTypes();

      const results = [];

      if (selectedTypes.includes("availability")) {
        for (const fieldKey of selectedFields) {
          const fieldEvents = collapsedAvailabilityByField[fieldKey] || [];
          results.push(...fieldEvents);
        }
      }

      const realEvents = allEvents.filter(e => {
        const fieldKey = e.extendedProps.fieldKey;
        const uiType = e.extendedProps.uiType;
        return selectedFields.includes(fieldKey) && selectedTypes.includes(uiType);
      });

      results.push(...realEvents);

      successCallback(results);
    },

    eventDidMount: function(info) {
      const props = info.event.extendedProps;
      const uiType = props.uiType;

      if (uiType === "availability") {
        const startStr = info.event.start.toLocaleTimeString([], {hour: 'numeric', minute: '2-digit'});
        const endStr = info.event.end.toLocaleTimeString([], {hour: 'numeric', minute: '2-digit'});
        const surfaces = props.freeSurfaces ? props.freeSurfaces.join(", ") : "N/A";

        info.el.title =
          `Available\n${startStr} - ${endStr}\nFree surfaces: ${surfaces}`;
      }
    }
  });

  calendar.render();

  document.querySelectorAll('#field-filters input, #type-filters input').forEach(cb => {
    cb.addEventListener('change', () => calendar.refetchEvents());
  });
});
