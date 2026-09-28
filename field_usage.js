const API_URL = "https://script.google.com/macros/s/AKfycbz14OzCFeMIyWMY6FRLckWwgBBtlLej71cDkYNb-qGEISJVHHWSe57Tp_49wHmwlRTQ/exec";

let SNAPSHOT = null;
let FIELD_BLOCK_MAP = {};

async function loadSnapshot() {
  const res = await fetch(`${API_URL}?action=getSnapshot`);
  SNAPSHOT = await res.json();
}

async function loadFieldMap() {
  const res = await fetch(`${API_URL}?action=getCanonicalMap`);
  FIELD_BLOCK_MAP = await res.json();
}

function getFieldUsageAtTime(targetDate) {
  if (!SNAPSHOT || !SNAPSHOT.events) return {};

  const ts = targetDate.getTime();
  const usage = {};

  SNAPSHOT.events.forEach(ev => {
    const ext = ev.extendedProps || {};
    const canonical = ext.canonical;
    const surface   = ext.surface;

    if (!canonical || !surface) return;

    const start = new Date(ev.start).getTime();
    const end   = new Date(ev.end).getTime();

    if (ts < start || ts >= end) return;

    if (!usage[canonical]) usage[canonical] = {};
    usage[canonical][surface] = {
      status: "booked",
      by: surface,
      event: ev
    };
  });

  Object.keys(FIELD_BLOCK_MAP).forEach(canonical => {
    const surfaces = FIELD_BLOCK_MAP[canonical];
    if (!surfaces) return;

    Object.keys(surfaces).forEach(surface => {
      if (usage[canonical] && usage[canonical][surface]) {
        const blocks = surfaces[surface];
        blocks.forEach(blockedSurface => {
          if (!usage[canonical][blockedSurface]) {
            usage[canonical][blockedSurface] = {
              status: "blocked",
              by: surface,
              event: usage[canonical][surface].event
            };
          }
        });
      }
    });
  });

  return usage;
}

function renderFieldUsageGrid(targetDate) {
  const container = document.getElementById("fieldUsageGrid");
  const usage = getFieldUsageAtTime(targetDate);

  let html = `
    <table class="field-usage-table">
      <tr>
        <th>Canonical</th>
        <th>Surface</th>
        <th>Status</th>
        <th>Event</th>
      </tr>
  `;

  Object.keys(usage).forEach(canonical => {
    Object.keys(usage[canonical]).forEach(surface => {
      const u = usage[canonical][surface];
      html += `
        <tr class="${u.status}">
          <td>${canonical}</td>
          <td>${surface}</td>
          <td>${u.status}</td>
          <td>${u.event?.title || ""}</td>
        </tr>
      `;
    });
  });

  html += "</table>";
  container.innerHTML = html;
}

document.addEventListener("DOMContentLoaded", async () => {
  await loadSnapshot();
  await loadFieldMap();

