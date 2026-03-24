document.addEventListener("DOMContentLoaded", async function () {
  const calendarEl = document.getElementById("calendar");

  let events = [];

  try {
    const response = await fetch("https://script.google.com/macros/s/AKfycbwvP6cJtzbPL2-k8GjdyipWj7JWd_PMYpfBL1ItWvYRzehH3GlifErjbyqGQZwz55YRpA/exec");
    const data = await response.json();
    events = data.events || [];
  } catch (err) {
    console.error("Fetch failed:", err);
  }

  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: "dayGridMonth",
    height: "auto",
    events: events
  });

  calendar.render();
});
