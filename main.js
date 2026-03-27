document.addEventListener("DOMContentLoaded", async function () {
  const calendarEl = document.getElementById("calendar");
  const lastUpdatedEl = document.getElementById("last-updated");

  // 🔹 Helper: which fields are checked in the UI?
  // Make sure your checkboxes have values like: TURF, BUTLER, SUMNER, BROOKVILLE
  function getSelectedFields() {
    return Array.from(document.querySelectorAll('#field-filters input:checked'))
      .map(cb => cb.value);
  }

  // 🔹 Compute Monday of current week (so we land somewhere sane)
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

  // 🔹 FullCalendar with dynamic filtering
  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: "timeGridWeek",
    firstDay: 1,
    initialDate: monday,
    height: "auto",
    slotMinTime: "08:00:00",
    slotMaxTime: "21:00:00",
    slotDuration: "00:30:00",
    slotLabelInterval: "01:00",
    allDaySlot: false,

    // We use a function source so we can re-filter on checkbox changes
    events: function (fetchInfo, successCallback, failureCallback) {
      try {
        const selectedFields = getSelectedFields();

        // Filter by field (NOT surface)
        const filtered = allEvents.filter(ev => {
          const field =
            (ev.extendedProps && ev.extendedProps.field) ||
            (ev.extendedProps && ev.extendedProps.canonical) ||
            null;

          // If no field info, keep it visible (or change to false if you want to hide)
          if (!field) return true;

          // If no filters selected, show everything
          if (selectedFields.length === 0) return true;

          return selectedFields.includes(field);
        });

        successCallback(filtered);
      } catch (e) {
        console.error("Error in events function:", e);
        if (failureCallback) failureCallback(e);
      }
    },

    // Optional: tweak how events render, but we don’t hide them here anymore
    eventDidMount: function (info) {
      // You can add tooltips, etc., here if you want
      // console.log(info.event.extendedProps);
    }
  });

  calendar.render();

  // 🔹 Re-filter when checkboxes change
  document.querySelectorAll('#field-filters input').forEach(cb => {
    cb.addEventListener('change', () => {
      calendar.refetchEvents();
    });
  });

  // For quick debugging in console:
  window._calendar = calendar;
  window._events = allEvents;
});
