// --------------------------------------
// CONFIG
// --------------------------------------
const WEBAPP = "https://script.google.com/macros/s/AKfycbz14OzCFeMIyWMY6FRLckWwgBBtlLej71cDkYNb-qGEISJVHHWSe57Tp_49wHmwlRTQ/exec";

// --------------------------------------
// TAB HANDLING
// --------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  const buttons = document.querySelectorAll(".tab-btn");
  const panels = document.querySelectorAll(".tab-panel");

  function showTab(tabName) {
    panels.forEach(panel => {
      panel.classList.toggle("active", panel.id === tabName);
    });

    if (tabName === "field-hours") loadFieldRules();
    if (tabName === "blocks") loadBlocks();
    if (tabName === "mapping") loadFieldMapping();
    if (tabName === "season") loadSeasonSettings();
    if (tabName === "extra") loadExtraRequests();
    if (tabName === "tools") initDataTools();
  }

  buttons.forEach(btn => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.tab;
      showTab(tab);
    });
  });

  // Default tab
  showTab("field-hours");

  // Field Hours add button
  const frAddBtn = document.getElementById("fr-add-btn");
  if (frAddBtn) frAddBtn.addEventListener("click", addFieldRule);

  // Blocks add button
  const blAddBtn = document.getElementById("bl-add-btn");
  if (blAddBtn) blAddBtn.addEventListener("click", addBlock);

  // Season Settings save button
  const ssSaveBtn = document.getElementById("ss-save-btn");
  if (ssSaveBtn) ssSaveBtn.addEventListener("click", saveSeasonSettings);
});

// --------------------------------------
// FIELD HOURS (FieldRules)
// --------------------------------------

async function loadFieldRules() {
  const res = await fetch(`${WEBAPP}?action=getFieldRules`);
  const rules = await res.json();

  const tbody = document.querySelector("#fr-table tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  rules.forEach((rule, index) => {
    const tr = document.createElement("tr");
    tr.dataset.index = index;

    tr.innerHTML = `
      <td>${rule.field}</td>
      <td>${rule.day_of_week}</td>
      <td>${rule.start_time}</td>
      <td>${rule.end_time}</td>
      <td>${rule.practice_allowed}</td>
      <td>${rule.travel_game_grades}</td>
      <td>
        <button class="fr-edit-btn">Edit</button>
        <button class="fr-delete-btn" data-index="${index}">Delete</button>
      </td>
    `;

    tbody.appendChild(tr);
  });
}

async function addFieldRule() {
  const payload = {
    field: document.getElementById("fr-field").value,
    day_of_week: document.getElementById("fr-day").value,
    start_time: document.getElementById("fr-start").value,
    end_time: document.getElementById("fr-end").value,
    practice_allowed: document.getElementById("fr-practice").value,
    travel_game_grades: document.getElementById("fr-grades").value
  };

  await fetch(`${WEBAPP}?action=addFieldRule`, {
    method: "POST",
    body: JSON.stringify(payload)
  });

  await loadFieldRules();

  document.getElementById("fr-field").value = "";
  document.getElementById("fr-start").value = "";
  document.getElementById("fr-end").value = "";
  document.getElementById("fr-practice").value = "Yes";
  document.getElementById("fr-grades").value = "";
}

async function deleteFieldRule(index) {
  await fetch(`${WEBAPP}?action=deleteFieldRule&index=${index}`);
  await loadFieldRules();
}

function startEditingFieldRuleRow(row) {
  const cells = row.querySelectorAll("td");
  const field = cells[0].innerText;
  const day = cells[1].innerText;
  const start = cells[2].innerText;
  const end = cells[3].innerText;
  const practice = cells[4].innerText;
  const grades = cells[5].innerText;

  cells[0].innerHTML = `<input value="${field}">`;

  cells[1].innerHTML = `
    <select>
      <option>Sun</option><option>Mon</option><option>Tue</option>
      <option>Wed</option><option>Thu</option><option>Fri</option><option>Sat</option>
    </select>`;
  cells[1].querySelector("select").value = day;

  cells[2].innerHTML = `<input type="time" value="${start}">`;
  cells[3].innerHTML = `<input type="time" value="${end}">`;

  cells[4].innerHTML = `
    <select>
      <option>Yes</option>
      <option>No</option>
    </select>`;
  cells[4].querySelector("select").value = practice;

  cells[5].innerHTML = `<input value="${grades}">`;

  cells[6].innerHTML = `
    <button class="fr-save-btn">Save</button>
    <button class="fr-cancel-btn">Cancel</button>
  `;
}

async function saveEditedFieldRuleRow(row) {
  const index = Number(row.dataset.index);
  const cells = row.querySelectorAll("td");

  const payload = {
    index,
    field: cells[0].querySelector("input").value,
    day_of_week: cells[1].querySelector("select").value,
    start_time: cells[2].querySelector("input").value,
    end_time: cells[3].querySelector("input").value,
    practice_allowed: cells[4].querySelector("select").value,
    travel_game_grades: cells[5].querySelector("input").value
  };

  await fetch(`${WEBAPP}?action=updateFieldRule`, {
    method: "POST",
    body: JSON.stringify(payload)
  });

  await loadFieldRules();
}

// --------------------------------------
// BLOCKS / CLOSURES
// --------------------------------------

async function loadBlocks() {
  const res = await fetch(`${WEBAPP}?action=getBlocks`);
  const blocks = await res.json();

  const tbody = document.querySelector("#bl-table tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  blocks.forEach((block, index) => {
    const tr = document.createElement("tr");
    tr.dataset.index = index;

    tr.innerHTML = `
      <td>${block.field}</td>
      <td>${block.date}</td>
      <td>${block.start_time}</td>
      <td>${block.end_time}</td>
      <td>${block.type}</td>
      <td>${block.reason || ""}</td>
      <td>
        <button class="bl-edit-btn">Edit</button>
        <button class="bl-delete-btn" data-index="${index}">Delete</button>
      </td>
    `;

    tbody.appendChild(tr);
  });
}

async function addBlock() {
  const payload = {
    field: document.getElementById("bl-field").value,
    date: document.getElementById("bl-date").value,
    start_time: document.getElementById("bl-start").value,
    end_time: document.getElementById("bl-end").value,
    type: document.getElementById("bl-type").value,
    reason: document.getElementById("bl-reason").value
  };

  await fetch(`${WEBAPP}?action=addBlock`, {
    method: "POST",
    body: JSON.stringify(payload)
  });

  await loadBlocks();

  document.getElementById("bl-field").value = "";
  document.getElementById("bl-date").value = "";
  document.getElementById("bl-start").value = "";
  document.getElementById("bl-end").value = "";
  document.getElementById("bl-type").value = "Block";
  document.getElementById("bl-reason").value = "";
}

async function deleteBlock(index) {
  await fetch(`${WEBAPP}?action=deleteBlock&index=${index}`);
  await loadBlocks();
}

function startEditingBlockRow(row) {
  const cells = row.querySelectorAll("td");
  const field = cells[0].innerText;
  const date = cells[1].innerText;
  const start = cells[2].innerText;
  const end = cells[3].innerText;
  const type = cells[4].innerText;
  const reason = cells[5].innerText;

  cells[0].innerHTML = `<input value="${field}">`;
  cells[1].innerHTML = `<input type="date" value="${date}">`;
  cells[2].innerHTML = `<input type="time" value="${start}">`;
  cells[3].innerHTML = `<input type="time" value="${end}">`;

  cells[4].innerHTML = `
    <select>
      <option>Block</option>
      <option>Closure</option>
      <option>Weather</option>
      <option>Maintenance</option>
    </select>`;
  cells[4].querySelector("select").value = type;

  cells[5].innerHTML = `<input value="${reason}">`;

  cells[6].innerHTML = `
    <button class="bl-save-btn">Save</button>
    <button class="bl-cancel-btn">Cancel</button>
  `;
}

async function saveEditedBlockRow(row) {
  const index = Number(row.dataset.index);
  const cells = row.querySelectorAll("td");

  const payload = {
    index,
    field: cells[0].querySelector("input").value,
    date: cells[1].querySelector("input").value,
    start_time: cells[2].querySelector("input").value,
    end_time: cells[3].querySelector("input").value,
    type: cells[4].querySelector("select").value,
    reason: cells[5].querySelector("input").value
  };

  await fetch(`${WEBAPP}?action=updateBlock`, {
    method: "POST",
    body: JSON.stringify(payload)
  });

  await loadBlocks();
}

// --------------------------------------
// FIELD MAPPING (partial edit)
// --------------------------------------

async function loadFieldMapping() {
  const res = await fetch(`${WEBAPP}?action=getFieldMapping`);
  const rows = await res.json();

  const tbody = document.querySelector("#fm-table tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  rows.forEach((row, index) => {
    const tr = document.createElement("tr");
    tr.dataset.index = index;

    tr.innerHTML = `
      <td>${row.abbreviation}</td>
      <td>${row.canonical_field}</td>
      <td>${row.surface}</td>
      <td>${row.ics_match}</td>
      <td>${row.practiceAllowed}</td>
      <td>${row.gameAllowed}</td>
      <td>${row.enabled}</td>
      <td>
        <button class="fm-edit-btn">Edit</button>
      </td>
    `;

    tbody.appendChild(tr);
  });
}

function startEditingFieldMappingRow(row) {
  const cells = row.querySelectorAll("td");
  const practice = cells[4].innerText;
  const game = cells[5].innerText;
  const enabled = cells[6].innerText;

  cells[4].innerHTML = `
    <select>
      <option>Yes</option>
      <option>No</option>
    </select>`;
  cells[4].querySelector("select").value = practice;

  cells[5].innerHTML = `
    <select>
      <option>Yes</option>
      <option>No</option>
    </select>`;
  cells[5].querySelector("select").value = game;

  cells[6].innerHTML = `
    <select>
      <option>Yes</option>
      <option>No</option>
    </select>`;
  cells[6].querySelector("select").value = enabled;

  cells[7].innerHTML = `
    <button class="fm-save-btn">Save</button>
    <button class="fm-cancel-btn">Cancel</button>
  `;
}

async function saveEditedFieldMappingRow(row) {
  const index = Number(row.dataset.index);
  const cells = row.querySelectorAll("td");

  const payload = {
    index,
    abbreviation: cells[0].innerText,
    canonical_field: cells[1].innerText,
    surface: cells[2].innerText,
    ics_match: cells[3].innerText,
    practiceAllowed: cells[4].querySelector("select").value,
    gameAllowed: cells[5].querySelector("select").value,
    enabled: cells[6].querySelector("select").value
  };

  await fetch(`${WEBAPP}?action=updateFieldMapping`, {
    method: "POST",
    body: JSON.stringify(payload)
  });

  await loadFieldMapping();
}

// --------------------------------------
// SEASON SETTINGS
// --------------------------------------

async function loadSeasonSettings() {
  const res = await fetch(`${WEBAPP}?action=getSeasonSettings`);
  const settings = await res.json(); // { season_start, season_end }

  const startInput = document.getElementById("ss-start");
  const endInput = document.getElementById("ss-end");
  if (!startInput || !endInput) return;

  startInput.value = settings.season_start || "";
  endInput.value = settings.season_end || "";
}

async function saveSeasonSettings() {
  const payload = {
    season_start: document.getElementById("ss-start").value,
    season_end: document.getElementById("ss-end").value
  };

  await fetch(`${WEBAPP}?action=updateSeasonSettings`, {
    method: "POST",
    body: JSON.stringify(payload)
  });

  await loadSeasonSettings();
}

// --------------------------------------
// EXTRA PRACTICE REQUESTS
// --------------------------------------

async function loadExtraRequests() {
  const res = await fetch(`${WEBAPP}?action=getExtraRequests`);
  const requests = await res.json();

  const tbody = document.querySelector("#ep-table tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  requests.forEach((req, index) => {
    const tr = document.createElement("tr");
    tr.dataset.index = index;

    tr.innerHTML = `
      <td>${req.timestamp}</td>
      <td>${req.coach}</td>
      <td>${req.team}</td>
      <td>${req.field}</td>
      <td>${req.date}</td>
      <td>${req.start}</td>
      <td>${req.end}</td>
      <td>${req.status}</td>
      <td>${req.notes || ""}</td>
      <td>
        <button class="ep-approve-btn">Approve</button>
        <button class="ep-deny-btn">Deny</button>
        <button class="ep-edit-btn">Edit</button>
        <button class="ep-delete-btn" data-index="${index}">Delete</button>
      </td>
    `;

    tbody.appendChild(tr);
  });
}

async function deleteExtraRequest(index) {
  await fetch(`${WEBAPP}?action=deleteExtraRequest&index=${index}`);
  await loadExtraRequests();
}

function startEditingExtraRequestRow(row) {
  const cells = row.querySelectorAll("td");

  const field = cells[3].innerText;
  const date = cells[4].innerText;
  const start = cells[5].innerText;
  const end = cells[6].innerText;
  const status = cells[7].innerText;
  const notes = cells[8].innerText;

  cells[3].innerHTML = `<input value="${field}">`;
  cells[4].innerHTML = `<input type="date" value="${date}">`;
  cells[5].innerHTML = `<input type="time" value="${start}">`;
  cells[6].innerHTML = `<input type="time" value="${end}">`;

  cells[7].innerHTML = `
    <select>
      <option>Pending</option>
      <option>Approved</option>
      <option>Denied</option>
    </select>`;
  cells[7].querySelector("select").value = status;

  cells[8].innerHTML = `<input value="${notes}">`;

  cells[9].innerHTML = `
    <button class="ep-save-btn">Save</button>
    <button class="ep-cancel-btn">Cancel</button>
  `;
}

async function saveEditedExtraRequestRow(row) {
  const index = Number(row.dataset.index);
  const cells = row.querySelectorAll("td");

  const payload = {
    index,
    field: cells[3].querySelector("input").value,
    date: cells[4].querySelector("input").value,
    start: cells[5].querySelector("input").value,
    end: cells[6].querySelector("input").value,
    status: cells[7].querySelector("select").value,
    notes: cells[8].querySelector("input").value
  };

  await fetch(`${WEBAPP}?action=updateExtraRequest`, {
    method: "POST",
    body: JSON.stringify(payload)
  });

  await loadExtraRequests();
}

async function approveExtraRequest(row) {
  const index = Number(row.dataset.index);
  const cells = row.querySelectorAll("td");

  const payload = {
    index,
    status: "Approved",
    notes: cells[8].innerText
  };

  await fetch(`${WEBAPP}?action=updateExtraRequest`, {
    method: "POST",
    body: JSON.stringify(payload)
  });

  await loadExtraRequests();
}

async function denyExtraRequest(row) {
  const index = Number(row.dataset.index);
  const cells = row.querySelectorAll("td");

  const payload = {
    index,
    status: "Denied",
    notes: cells[8].innerText
  };

  await fetch(`${WEBAPP}?action=updateExtraRequest`, {
    method: "POST",
    body: JSON.stringify(payload)
  });

  await loadExtraRequests();
}

// --------------------------------------
// DATA TOOLS
// --------------------------------------

function initDataTools() {
  const buttons = document.querySelectorAll(".data-tool-btn");
  buttons.forEach(btn => {
    btn.addEventListener("click", async () => {
      const tool = btn.dataset.tool;
      if (!tool) return;

      await fetch(`${WEBAPP}?action=runDataTool`, {
        method: "POST",
        body: JSON.stringify({ tool })
      });
    });
  });
}

// --------------------------------------
// GLOBAL CLICK HANDLER
// --------------------------------------

document.addEventListener("click", (e) => {
  const target = e.target;

  // Field Hours
  if (target.classList.contains("fr-edit-btn")) {
    startEditingFieldRuleRow(target.closest("tr"));
  }
  if (target.classList.contains("fr-save-btn")) {
    saveEditedFieldRuleRow(target.closest("tr"));
  }
  if (target.classList.contains("fr-cancel-btn")) {
    loadFieldRules();
  }
  if (target.classList.contains("fr-delete-btn")) {
    const index = Number(target.dataset.index);
    deleteFieldRule(index);
  }

  // Blocks
  if (target.classList.contains("bl-edit-btn")) {
    startEditingBlockRow(target.closest("tr"));
  }
  if (target.classList.contains("bl-save-btn")) {
    saveEditedBlockRow(target.closest("tr"));
  }
  if (target.classList.contains("bl-cancel-btn")) {
    loadBlocks();
  }
  if (target.classList.contains("bl-delete-btn")) {
    const index = Number(target.dataset.index);
    deleteBlock(index);
  }

  // Field Mapping
  if (target.classList.contains("fm-edit-btn")) {
    startEditingFieldMappingRow(target.closest("tr"));
  }
  if (target.classList.contains("fm-save-btn")) {
    saveEditedFieldMappingRow(target.closest("tr"));
  }
  if (target.classList.contains("fm-cancel-btn")) {
    loadFieldMapping();
  }

  // Extra Practice Requests
  if (target.classList.contains("ep-edit-btn")) {
    startEditingExtraRequestRow(target.closest("tr"));
  }
  if (target.classList.contains("ep-save-btn")) {
    saveEditedExtraRequestRow(target.closest("tr"));
  }
  if (target.classList.contains("ep-cancel-btn")) {
    loadExtraRequests();
  }
  if (target.classList.contains("ep-delete-btn")) {
    const index = Number(target.dataset.index);
    deleteExtraRequest(index);
  }
  if (target.classList.contains("ep-approve-btn")) {
    approveExtraRequest(target.closest("tr"));
  }
  if (target.classList.contains("ep-deny-btn")) {
    denyExtraRequest(target.closest("tr"));
  }
});
