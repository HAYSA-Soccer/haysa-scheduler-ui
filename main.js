document.addEventListener("DOMContentLoaded", async function () {
  const calendarEl = document.getElementById("calendar");
  const lastUpdatedEl = document.getElementById("last-updated");

  // Normalize field names to match backend canonical style
  function normalizeFieldName(name) {
    if (!name) return "";
    return name.toUpperCase().trim();
  }

  // FIELD FILTERS
  function getSelectedFields() {
    return Array.from(document.querySelectorAll('#field-filters input:checked'))
      .map(cb => normalizeFieldName(cb.value));
  }

  // EVENT TYPE FILTERS
  function getSelectedTypes() {
    return Array.from(document.querySelectorAll('#type-filters input:checked'))
      .map(cb => cb.value.toLowerCase());
  }

  // Compute Monday of current week (fallback)
  const today = new Date();
  const day = today.getDay();
  const diffToMonday = (day === 0 ? -6 : 1 - day);
  const monday = new Date(today);
  monday.setDate(today.getDate() + diffToMonday);

  let allEvents = [];

  const url = "https://script.google.com/macros/s/AKfycbz14OzCFeMIyWMY6FRLckWwgBBtlLej71cDkYNb-qGEISJVHHWSe57Tp_49wHmwlRTQ/exec";

  try {
    console.log("Fetching calendar data from:", url);
    const response = await fetch(url);
    const data = await response.json();

    if (lastUpdatedEl) {
      lastUpdatedEl.innerText = `Calendar last updated: ${data.lastUpdate}`;
    }

    allEvents = data.events || [];
    console.log("Loaded events:", allEvents.length);

  } catch (err) {
    console.error("Fetch failed:", err);
    if (lastUpdatedEl) {
      lastUpdatedEl.innerText = "Error loading calendar data";
    }
  }

  // Start calendar on first event if available
  const initialDate = allEvents.length
    ? allEvents[0].start
    : monday;

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

        const filtered = allEvents.filter(ev => {
          const field =
            (ev.extendedProps && ev.extendedProps.field) ||
            (ev.extendedProps && ev.extendedProps.canonical) ||
            null;

          const type =
            (ev.extendedProps && ev.extendedProps.type) ||
            "unknown";

          const normField = normalizeFieldName(field);

          // Field filter
          if (selectedFields.length > 0 && !selectedFields.includes(normField)) {
            return false;
          }

          // Type filter
          if (!selectedTypes.includes(type.toLowerCase())) {
            return false;
          }

          return true;
        });

        successCallback(filtered);
      } catch (e) {
        console.error("Error in events function:", e);
        if (failureCallback) failureCallback(e);
      }
    }
  });

  calendar.render();

  // Re-filter when checkboxes change
  document.querySelectorAll('#field-filters input, #type-filters input').forEach(cb => {
    cb.addEventListener('change', () => {
      calendar.refetchEvents();
    });
  });

  // Debug helpers
  window._calendar = calendar;
  window._events = allEvents;
});
