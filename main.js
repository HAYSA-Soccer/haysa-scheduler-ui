document.addEventListener("DOMContentLoaded", async function () {
  const calendarEl = document.getElementById("calendar");

  // ⭐ STEP 1: Add this helper function near the top
  function getSelectedFields() {
    return Array.from(document.querySelectorAll('#field-filters input:checked'))
                .map(cb => cb.value);
  }

  // Monday of current week
  const today = new Date();
  const day = today.getDay();
  const diffToMonday = (day === 0 ? -6 : 1 - day);
  const monday = new Date(today);
  monday.setDate(today.getDate() + diffToMonday);

  let events = [];

  // DIRECT CALL — no AllOrigins
  const url = "https://script.google.com/macros/s/AKfycbzPuMevowzuEn18F5j2VDLlC1p8zgjB6RCkN6dHOyHdYQVKRhY-EleGAVtUPS2_oeSZmg/exec";

  try {
    console.log("Fetching calendar data from:", url);

    const response = await fetch(url);
    const data = await response.json();

    document.getElementById("last-updated").innerText =
      `Calendar last updated: ${data.lastUpdate}`;

    events = data.events || [];

    console.log("Loaded events:", events.length);

  } catch (err) {
    console.error("Fetch failed:", err);
    document.getElementById("last-updated").innerText =
      "Error loading calendar data";
  }

  // ⭐ STEP 2: Modify your FullCalendar initialization
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
    events: events,

    // ⭐ This is the filter logic
    eventDidMount: function(info) {
      const selected = getSelectedFields();
      const eventSurface = info.event.extendedProps.surface;

      if (!selected.includes(eventSurface)) {
        info.el.style.display = "none";
      }
    }
  });

  calendar.render();

  // ⭐ STEP 3: Re-render when checkboxes change
  document.querySelectorAll('#field-filters input').forEach(cb => {
    cb.addEventListener('change', () => {
      calendar.refetchEvents();
      calendar.render();
    });
  });
});
