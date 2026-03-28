document.addEventListener("DOMContentLoaded", async function () {
  const calendarEl = document.getElementById("calendar");
  const lastUpdatedEl = document.getElementById("last-updated");

  // -----------------------------
  // LAST UPDATED BANNER HELPERS
  // -----------------------------
  function formatLastUpdated(iso) {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });
  }

  function relativeTime(iso) {
    const diffMs = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diffMs / 60000);

    if (mins < 1) return "just now";
    if (mins < 60) return `${mins} min ago`;

    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} hr ago`;

    const days = Math.floor(hours / 24);
    return `${days} day${days > 1 ? "s" : ""} ago`;
  }

  function updateLastUpdatedBanner(iso) {
    if (!lastUpdatedEl) return;

    const rel = relativeTime(iso);
    const abs = formatLastUpdated(iso);

    lastUpdatedEl.textContent = `Calendar last updated: ${rel} (${abs})`;

    // Color coding
    const diffMs = Date.now() - new Date(iso).getTime();
    const mins = diffMs / 60000;

    lastUpdatedEl.classList.remove("stale", "very-stale");

    if (mins > 30 && mins <= 120) {
      lastUpdatedEl.classList.add("stale");
    } else if (mins > 120) {
      lastUpdatedEl.classList.add("very-stale");
    }
  }

  // -----------------------------
  // FIELD + TYPE FILTER HELPERS
  // -----------------------------
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

  // -----------------------------
  // AVAILABILITY COLLAPSE HELPERS
  // -----------------------------
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

  // -----------------------------
  // LOAD DATA FROM API
  // -----------------------------
  let allEvents = [];
  let collapsedAvailabilityByField = {};

  const url = "https://script.google.com/macros/s/AKfycbz14OzCFeMIyWMY6FRLckWwgBBtlLej71cDkYNb-qGEISJVHHWSe57Tp_49wHmwlRTQ/exec";

  async function loadData() {
    const response = await fetch(url);
    const data = await response.json();

    // Update banner
    updateLastUpdatedBanner(data.lastUpdate);

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

  // -----------------------------
  // CALENDAR
  // -----------------------------
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
