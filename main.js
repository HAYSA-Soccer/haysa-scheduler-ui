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
  // EVENT CLASSIFICATION
  // -----------------------------
  function classifyEvent(ev) {
    const t = (ev.extendedProps && ev.extendedProps.type || "").toLowerCase();
    const title = (ev.title || "").toLowerCase();

    if (t === "availability") return "availability";
    if (t === "practice") return "practice";
    if (t === "game") return "game";

    if (title.includes("practice") || title.includes("prac")) return "practice";
    if (title.includes("vs")) return "game";

    return "block";
  }

  // -----------------------------
  // AVAILABILITY COLLAPSE HELPERS
  // -----------------------------
  function arraysEqualIgnoringOrder(a, b) {
    const aa = (a || []).slice().sort();
    const bb = (b || []).slice().sort();
    if (aa.length !== bb.length) return false;
    for (let i = 0; i < aa.length; i++) {
      if (aa[i] !== bb[i]) return false;
    }
    return true;
  }

  function collapseAvailabilityForField(eventsForField) {
    const availability = eventsForField.filter(e => e.extendedProps.uiType === "availability");
    const others = eventsForField.filter(e => e.extendedProps.uiType !== "availability");

    if (!availability.length) return eventsForField;

    const windows = availability.map(ev => {
      const start = new Date(ev.start);
      const end = new Date(ev.end);
      const props = ev.extendedProps || {};
      return {
        original: ev,
        start,
        end,
        practiceSurfaces: props.practiceSurfaces || [],
        gameOnlySurfaces: props.gameOnlySurfaces || []
      };
    });

    windows.sort((a, b) => a.start - b.start);

    const merged = [];
    let current = windows[0];

    for (let i = 1; i < windows.length; i++) {
      const next = windows[i];

      const samePractice = arraysEqualIgnoringOrder(
        current.practiceSurfaces,
        next.practiceSurfaces
      );
      const sameGameOnly = arraysEqualIgnoringOrder(
        current.gameOnlySurfaces,
        next.gameOnlySurfaces
      );

      if (next.start <= current.end && samePractice && sameGameOnly) {
        if (next.end > current.end) {
          current.end = next.end;
        }
      } else {
        merged.push(current);
        current = next;
      }
    }
    merged.push(current);

    const MIN_DURATION_MS = 60 * 60 * 1000;
    const collapsedEvents = merged
      .filter(w => (w.end - w.start) >= MIN_DURATION_MS)
      .map(w => {
        const base = w.original;
        const props = base.extendedProps || {};
        return {
          title: "Available",
          start: w.start.toISOString(),
          end: w.end.toISOString(),
          backgroundColor: "#6FCF97",
          borderColor: "#4CAF50",
          extendedProps: {
            ...props,
            uiType: "availability",
            practiceSurfaces: w.practiceSurfaces,
            gameOnlySurfaces: w.gameOnlySurfaces
          }
        };
      });

    return others.concat(collapsedEvents);
  }

  function collapseAvailability(allEvents) {
    const grouped = {};
    for (const ev of allEvents) {
      const fieldKey = ev.extendedProps.fieldKey;
      if (!grouped[fieldKey]) grouped[fieldKey] = [];
      grouped[fieldKey].push(ev);
    }

    const result = [];
    for (const fieldKey of Object.keys(grouped)) {
      const collapsed = collapseAvailabilityForField(grouped[fieldKey]);
      result.push(...collapsed);
    }
    return result;
  }

  // -----------------------------
  // LOAD DATA FROM API
  // -----------------------------
  let allEvents = [];

  const url = "https://script.google.com/macros/s/AKfycbz14OzCFeMIyWMY6FRLckWwgBBtlLej71cDkYNb-qGEISJVHHWSe57Tp_49wHmwlRTQ/exec";

  async function loadData() {
    const response = await fetch(url);
    const data = await response.json();

    updateLastUpdatedBanner(data.lastUpdate);

    const rawEvents = (data.events || []).map(ev => {
      const ext = ev.extendedProps || {};
      const fieldKey = normalizeFieldName(ext.canonical || ext.field || "");

      const uiType = classifyEvent(ev);

      return {
        ...ev,
        extendedProps: {
          ...ext,
          fieldKey,
          uiType
        }
      };
    });

    allEvents = collapseAvailability(rawEvents);
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

      const results = allEvents.filter(e => {
        const fieldKey = e.extendedProps.fieldKey;
        const uiType = e.extendedProps.uiType;
        return selectedFields.includes(fieldKey) && selectedTypes.includes(uiType);
      });

      successCallback(results);
    },

    eventDidMount: function(info) {
      const props = info.event.extendedProps;
      const uiType = props.uiType;

      if (uiType === "availability") {
        const startStr = info.event.start.toLocaleTimeString([], {hour: 'numeric', minute: '2-digit'});
        const endStr = info.event.end.toLocaleTimeString([], {hour: 'numeric', minute: '2-digit'});

        const practice = props.practiceSurfaces || [];
        const gameOnly = props.gameOnlySurfaces || [];

        let tooltip = `Available\n${startStr} - ${endStr}`;

        if (practice.length > 0) {
          tooltip += `\nPractice surfaces: ${practice.join(", ")}`;
        }

        if (gameOnly.length > 0) {
          tooltip += `\nGame-only surfaces: ${gameOnly.join(", ")}`;
        }

        info.el.title = tooltip;
      }
    }
  });

  calendar.render();

  document.querySelectorAll('#field-filters input, #type-filters input').forEach(cb => {
    cb.addEventListener('change', () => calendar.refetchEvents());
  });
});
