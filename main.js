document.addEventListener("DOMContentLoaded", async function () {
  const calendarEl = document.getElementById("calendar");

  // Monday of current week
  const today = new Date();
  const day = today.getDay();
  const diffToMonday = (day === 0 ? -6 : 1 - day);
  const monday = new Date(today);
  monday.setDate(today.getDate() + diffToMonday);

  let events = [];

  try {
    const response = await fetch("https://script.google.com/macros/s/AKfycbwvP6cJtzbPL2-k8GjdyipWj7JWd_PMYpfBL1ItWvYRzehH3GlifErjbyqGQZwz55YRpA/exec");
    const data = await response.json();
    events = data.events || [];
  } catch (err) {
    console.error("Fetch failed:", err);
  }

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
    events: events
  });

  calendar.render();
});
