document.addEventListener("DOMContentLoaded", async function () {
  const calendarEl = document.getElementById("calendar");

  // Monday of current week
  const today = new Date();
  const day = today.getDay();
  const diffToMonday = (day === 0 ? -6 : 1 - day);
  const monday = new Date(today);
  monday.setDate(today.getDate() + diffToMonday);

  let events = [];

  const url = "https://script.google.com/macros/s/AKfycbzirRDr_v6zAzmxaZNnYTXjeV1sTso64SJ-20qe0rrpsYiWSDiXxPYUpcvy7D1eXGjFpA/exec";

  try {
    console.log("Fetching events from:", url);

    const response = await fetch(url, {
      method: "GET",
      mode: "cors",
      headers: {
        "Content-Type": "application/json"
      }
    });

    console.log("Fetch response status:", response.status);

    const text = await response.text();
    console.log("Raw response text:", text);

    const data = JSON.parse(text);
    console.log("Parsed JSON:", data);

    events = data.events || [];
    console.log("Loaded events:", events.length);

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

  console.log("Rendering calendar with events:", events.length);
  calendar.render();
});
