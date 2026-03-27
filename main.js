document.addEventListener("DOMContentLoaded", async function () {
  const calendarEl = document.getElementById("calendar");
  const lastUpdatedEl = document.getElementById("last-updated");

  // Normalize field names to match backend canonical style
  function normalizeFieldName(name) {
    if (!name) return "";
    return name.toUpperCase().trim();
  }

  // Which fields are checked in the UI?
  function getSelectedFields() {
    return Array.from(document.querySelectorAll('#field-filters input:checked'))
      .map(cb => normalizeFieldName(cb.value));
  }

  // Compute Monday of current week (fallback if no events)
  const today = new Date();
  const day = today.getDay(); // 0 = Sun, 1 = Mon, ...
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

  // Decide initial date: first event if available, otherwise current week Monday
  const initialDate = allEvents.length
    ? allEvents[0].start
    : monday;

  // FullCalendar with dynamic filtering
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

    // Function source so we can re-filter on checkbox changes
    events: function (fetchInfo, successCallback, failureCallback) {
      try {
        const selectedFields = getSelectedFields();

        const filtered = allEvents.filter(ev => {
          const field =
            (ev.extendedProps && ev.extendedProps.field) ||
            (ev.extendedProps && ev.extendedProps.canonical) ||
            null;

          const normField = normalizeFieldName(field);

          // If no field info, keep it visible
          if (!normField) return true;

          // If no filters selected, show everything
          if (selectedFields.length === 0) return true;

          return selectedFields.includes(normField);
        });

        successCallback(filtered);
      } catch (e) {
        console.error("Error in events function:", e);
        if (failureCallback) failureCallback(e);
      }
    },

    eventDidMount: function (info) {
      // Hook for future tooltips or debugging
      // console.log(info.event.extendedProps);
    }
  });

  calendar.render();

  // Re-filter when checkboxes change
  document.querySelectorAll('#field-filters input').forEach(cb => {
    cb.addEventListener('change', () => {
      calendar.refetchEvents();
    });
  });

  // For quick debugging in console:
  window._calendar = calendar;
  window._events = allEvents;
});
