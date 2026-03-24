document.addEventListener("DOMContentLoaded", async function () {
  const calendarEl = document.getElementById("calendar");

  // 1. Fetch events from Apps Script
  const response = await fetch("https://script.google.com/macros/s/AKfycbwvP6cJtzbPL2-k8GjdyipWj7JWd_PMYpfBL1ItWvYRzehH3GlifErjbyqGQZwz55YRpA/exec");
  const data = await response.json();

  // 2. Initialize the calendar with real events
  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: "dayGridMonth",
    height: "auto",
    events: data.events || []
  });

  calendar.render();
});
