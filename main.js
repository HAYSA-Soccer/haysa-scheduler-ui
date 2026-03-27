// ------------------------------------------------------------
// Helper functions for merging and subtracting time windows
// ------------------------------------------------------------
function mergeWindows(events) {
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

  const url = "https://script.google.com/macros/s/AKfycbz14OzCFeMIyWMY6FRLckWwgBBtlLej71cDkYNb-qGEISJVHHWSe57Tp_49wHmwlRTQ/exec";

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (lastUpdatedEl) {
      lastUpdatedEl.innerText = `Calendar last updated: ${data.lastUpdate}`;
    }

    allEvents = data.events || [];

  } catch (err) {
    console.error("Fetch failed:", err);
    if (lastUpdatedEl) {
      lastUpdatedEl.innerText = "Error loading calendar data";
    }
  }

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

    // ------------------------------------------------------------
    // COLLAPSING AVAILABILITY LOGIC
    // ------------------------------------------------------------
    events: function (fetchInfo, successCallback, failureCallback) {
      try {
        const selectedFields = getSelectedFields();
        const selectedTypes = getSelectedTypes();

        const grouped = {};
        for (const ev of allEvents) {
          const field =
            (ev.extendedProps && ev.extendedProps.field) ||
            (ev.extendedProps && ev.extendedProps.canonical) ||
            null;

          if (!field) continue;

          const normField = normalizeFieldName(field);
          if (!grouped[normField]) grouped[normField] = [];
          grouped[normField].push(ev);
        }

        const collapsedEvents = [];

        for (const field of Object.keys(grouped)) {
          if (selectedFields.length > 0 && !selectedFields.includes(field)) {
            continue;
          }

          const events = grouped[field];

          const availability = events.filter(e => e.extendedProps.type === "availability");
          const blockers = events.filter(e => e.extendedProps.type !== "availability");

          if (availability.length === 0) continue;

          const merged = mergeWindows(availability);
          const freeWindows = subtractWindows(merged, blockers);

          const surfaces = availability.map(a => a.extendedProps.surface).filter(Boolean);

          for (const win of freeWindows) {
            collapsedEvents.push({
              title: "Available",
              start: win.start,
              end: win.end,
              backgroundColor: "#6FCF97",
              borderColor: "#4CAF50",
              extendedProps: {
                type: "availability",
                field: field,
                freeSurfaces: surfaces
              }
            });
          }
        }

        const realEvents = allEvents.filter(e => e.extendedProps.type !== "availability");
        const filteredReal = realEvents.filter(e =>
          selectedTypes.includes(e.extendedProps.type)
        );

        successCallback([...collapsedEvents, ...filteredReal]);

      } catch (e) {
        console.error("Error in events function:", e);
        if (failureCallback) failureCallback(e);
      }
    },

    // ------------------------------------------------------------
    // TOOLTIP LOGIC
    // ------------------------------------------------------------
    eventDidMount: function(info) {
      if (info.event.extendedProps.type === "availability") {
        const props = info.event.extendedProps;
        const tooltip =
          `${props.field}\n` +
          `Available: ${info.event.start.toLocaleTimeString([], {hour: 'numeric', minute: '2-digit'})} - ${info.event.end.toLocaleTimeString([], {hour: 'numeric', minute: '2-digit'})}\n` +
          `Free surfaces: ${props.freeSurfaces.join(", ")}`;

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
