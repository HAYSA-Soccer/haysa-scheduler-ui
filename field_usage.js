const API_URL = "https://script.google.com/macros/s/AKfycbz14OzCFeMIyWMY6FRLckWwgBBtlLej71cDkYNb-qGEISJVHHWSe57Tp_49wHmwlRTQ/exec";

let SNAPSHOT = null;

async function loadSnapshot() {
  const res = await fetch(`${API_URL}?action=getSnapshot`);
  SNAPSHOT = await res.json();
}

function renderRawEventTable() {
  const container = document.getElementById("fieldUsageGrid");
  if (!SNAPSHOT || !SNAPSHOT.events) {
    container.innerHTML = "<p>No events found.</p>";
    return;
  }

  let html = `
    <table class="field-usage-table">
      <tr>
        <th>Canonical</th>
        <th>Surface</th>
        <th>Title</th>
        <th>Start</th>
        <th>End</th>
        <th>Type</th>
      </tr>
  `;

  SNAPSHOT.events.forEach(ev => {
    const ext = ev.extendedProps || {};

    html += `
      <tr>
        <td>${ext.canonical || ""}</td>
        <td>${ext.surface || ""}</td>
        <td>${ev.title || ""}</td>
        <td>${ev.start || ""}</td>
        <td>${ev.end || ""}</td>
        <td>${ext.type || ""}</td>
      </tr>
    `;
  });

  html += "</table>";
  container.innerHTML = html;
}

document.addEventListener("DOMContentLoaded", async () => {
  await loadSnapshot();
  renderRawEventTable();
});
