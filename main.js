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
      // no overlap
      if (block.end <= w.start || block.start >= w.end) {
        updated.push(w);
        continue;
      }

      // left piece
      if (block.start > w.start) {
        updated.push({ start: w.start, end: block.start });
      }

      // right piece
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
// Main UI logic
// ------------------------------------------------------------
document.addEventListener("DOMContentLoaded", async function () {
  const calendarEl = document.getElementById("calendar");
  const lastUpdatedEl = document.getElementById("last-updated");

  function normalizeFieldName(name) {
    if (!name) return "";
    return name.toUpperCase().trim();
  }

  function getSelectedFields() {
    return Array.from(document.querySelectorAll('#field-filters input:checked'))
      .map(cb => normalizeFieldName(cb.value));
  }

  function getSelectedTypes() {
    return Array.from(document.querySelectorAll('#type-filters input:checked'))
      .map(cb => cb.value.toLowerCase());
  }

  const today = new Date();
  const day = today.getDay();
  const diffToMonday = (day === 0 ? -6 : 1 - day);
  const monday = new Date(today);
  monday.setDate(today.getDate() + diffToMonday);

  let allEvents = [];
  let collapsedAvailabilityByField = {}; // field -> collapsed availability events

  const url = "https://script.google.com/macros/s/AKfycbz14OzCFeMIyWMY6FRLckWwgBBtlLej71cDkYNb-qGEISJVHHWSe57Tp_49wHmwlRTQ/exec";

  async function loadData() {
    try {
      const response = await fetch(url);
      const data = await response.json();

      if (lastUpdatedEl) {
        lastUpdatedEl.innerText = `Calendar last updated: ${data.lastUpdate}`;
      }

      allEvents = (data.events || []).map(ev => {
        const ext = ev.extendedProps || {};

        // Normalize type: only "availability" vs "game"
        let t = (ext.type || "").toLowerCase();
        if (t !== "availability") {
          t = "game"; // ICS games, practices, blocks tab, closures → all treated as "game"
        }

        // Normalize field key once
        const fieldRaw = ext.field || ext.canonical || "";
        const fieldKey = normalizeFieldName(fieldRaw);

        return {
          ...ev,
          extendedProps: {
            ...ext,
            type: t,
            field: fieldRaw,
            fieldKey: fieldKey
          }
        };
      });

      precomputeCollapsedAvailability();

    } catch (err) {
      console.error("Fetch failed:", err);
      if (lastUpdatedEl) {
        lastUpdatedEl.innerText = "Error loading calendar data";
      }
    }
  }

  function precomputeCollapsedAvailability() {
    collapsedAvailabilityByField = {};

    // Group by canonical fieldKey
    const grouped = {};
    for (const ev of allEvents) {
      const fieldKey = ev.extendedProps.fieldKey;
      if (!fieldKey) continue;
      if (!grouped[fieldKey]) grouped[fieldKey] = [];
      grouped[fieldKey].push(ev);
    }

    for (const fieldKey of Object.keys(grouped)) {
      const events = grouped[fieldKey];

      const availability = events.filter(e => e.extendedProps.type === "availability");
      const blockers = events.filter(e => e.extendedProps.type === "game");

      if (!availability.length) {
        collapsedAvailabilityByField[fieldKey] = [];
        continue;
      }

      // Merge all availability windows for this complex
      const merged = mergeWindows(availability);

      // Any "game" (ICS, practice, block tab, closure) removes availability in that window
      const freeWindows = subtractWindows(merged, blockers);

      if (!freeWindows.length) {
        collapsedAvailabilityByField[fieldKey] = [];
        continue;
      }

      // Collect surfaces just for tooltip detail
      const surfaces = availability
        .map(a => a.extendedProps.surface)
        .filter(Boolean);

      const collapsed = freeWindows.map(win => ({
        title: "Available",
        start: win.start,
        end: win.end,
        backgroundColor: "#6FCF97",
        borderColor: "#4CAF50",
        extendedProps: {
          type: "availability",
          field: events[0].extendedProps.field, // any representative
          fieldKey: fieldKey,
          freeSurfaces: surfaces
        }
      }));

      collapsedAvailabilityByField[fieldKey] = collapsed;
    }
  }

  await loadData();

  const initialDate = allEvents.length ? allEvents[0].start : monday;

  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: "timeGridWeek",
    firstDay: 1,
    initialDate: initialDate,
    height: "auto",
    slotMinTime: "08:00:00",
    slotMaxTime: "21:00:00",
    slotDuration: "00:30:00",
    slotLabelInterval: "01:00",
    allDaySlot: false,

    events: function (fetchInfo, successCallback, failureCallback) {
      try {
        const selectedFields = getSelectedFields();
        const selectedTypes = getSelectedTypes();

        // If no fields selected, show nothing
        if (!selectedFields.length) {
          successCallback([]);
          return;
        }

        const results = [];

        // Collapsed availability for selected fields
        if (selectedTypes.includes("availability")) {
          for (const fieldKey of selectedFields) {
            const fieldEvents = collapsedAvailabilityByField[fieldKey] || [];
            const inRange = fieldEvents.filter(e =>
              new Date(e.end) > fetchInfo.start && new Date(e.start) < fetchInfo.end
            );
            results.push(...inRange);
          }
        }

        // Real "game" events (ICS, practices, blocks tab, closures)
        if (selectedTypes.includes("game")) {
          const realEvents = allEvents.filter(e => e.extendedProps.type === "game");

          const filteredReal = realEvents.filter(e => {
            const fieldKey = e.extendedProps.fieldKey;
            if (!selectedFields.includes(fieldKey)) return false;

            const start = new Date(e.start);
            const end = new Date(e.end);
            return end > fetchInfo.start && start < fetchInfo.end;
          });

          results.push(...filteredReal);
        }

        successCallback(results);

      } catch (e) {
        console.error("Error in events function:", e);
        if (failureCallback) failureCallback(e);
      }
    },

    eventDidMount: function(info) {
      if (info.event.extendedProps.type === "availability") {
        const props = info.event.extendedProps;
        const startStr = info.event.start.toLocaleTimeString([], {hour: 'numeric', minute: '2-digit'});
        const endStr = info.event.end.toLocaleTimeString([], {hour: 'numeric', minute: '2-digit'});
        const surfaces = (props.freeSurfaces && props.freeSurfaces.length)
          ? props.freeSurfaces.join(", ")
          : "N/A";

        const tooltip =
          `${props.field}\n` +
          `Available: ${startStr} - ${endStr}\n` +
          `Free surfaces: ${surfaces}`;

        info.el.title = tooltip;
      }
    }
  });

  calendar.render();

  document.querySelectorAll('#field-filters input, #type-filters input').forEach(cb => {
    cb.addEventListener('change', () => {
      calendar.refetchEvents();
    });
  });

  window._calendar = calendar;
  window._events = allEvents;
});
