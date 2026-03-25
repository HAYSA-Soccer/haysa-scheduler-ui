document.addEventListener("DOMContentLoaded", async function () {
  const calendarEl = document.getElementById("calendar");

  // Monday of current week
  const today = new Date();
  const day = today.getDay();
  const diffToMonday = (day === 0 ? -6 : 1 - day);
  const monday = new Date(today);
  monday.setDate(today.getDate() + diffToMonday);

  let events = [];
  let availability = [];
  let unavailable = [];

  const url = "https://api.allorigins.win/raw?url=" +
            encodeURIComponent("https://script.google.com/macros/s/AKfycbzMY8dqa2GxcQMIpLPy7pPVIYACGPmwXsYMyUNpuwC56UFlMpu11KtfLqrJTxEaO0VRmw/exec");

  try {
    console.log("Fetching calendar data from:", url);

    const response = await fetch(url, {
      method: "GET",
      mode: "cors",
      headers: {
        "Content-Type": "application/json"
      }
    });

    const text = await response.text();
    const data = JSON.parse(text);

    // NEW: update timestamp banner
    document.getElementById("last-updated").innerText =
      `Calendar last updated: ${data.lastUpdate}`;

    // NEW: extract all data sets
    events = data.events || [];
    availability = data.availability || [];
    unavailable = data.unavailable || [];

    console.log("Loaded events:", events.length);

  } catch (err) {
    console.error("Fetch failed:", err);
    document.getElementById("last-updated").innerText =
      "Error loading calendar data";
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
