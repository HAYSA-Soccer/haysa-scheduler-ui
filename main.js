document.addEventListener("DOMContentLoaded", async function () {
  const calendarEl = document.getElementById("calendar");

  // --- Calculate the Monday of the current week ---
  const today = new Date();
  const day = today.getDay(); // 0 = Sunday, 1 = Monday, ...
  const diffToMonday = (day === 0 ? -6 : 1 - day);
  const monday = new Date(today);
  monday.setDate(today.getDate() + diffToMonday);

  // --- Fetch events from your standalone Apps Script ---
  let events = [];

  try {
    const response = await fetch("https://script.google.com/macros/s/AKfycbwvP6cJtzbPL2-k8GjdyipWj7JWd_PMYpfBL1ItWvYRzehH3GlifErjbyqGQZwz55YRpA/exec");
    const data = await response.json();
    events = data.events || [];
  } catch (err) {
    console.error("Fetch failed:", err);
  }

  // --- Initialize FullCalendar ---
  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: "timeGridWeek",   // Weekly view
    firstDay: 1,                   // Monday start
    initialDate: monday,           // Always show this week's Monday
    height: "auto",
    events: events
  });

  calendar.render();
});
