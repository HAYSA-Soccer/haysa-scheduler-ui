document.addEventListener("DOMContentLoaded", () => {
  const buttons = document.querySelectorAll(".tab-btn");
  const panels = document.querySelectorAll(".tab-panel");

  function showTab(tabName) {
    panels.forEach(panel => {
      panel.classList.toggle("active", panel.id === tabName);
    });

    if (tabName === "field-hours") loadFieldRules();
  }

  buttons.forEach(btn => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.tab;
      showTab(tab);
    });
  });

  // Default tab
  showTab("field-hours");
});

// -----------------------------
// FIELD HOURS (RULES) LOGIC
// -----------------------------

const WEBAPP = "https://script.google.com/macros/s/AKfycbz14OzCFeMIyWMY6FRLckWwgBBtlLej71cDkYNb-qGEISJVHHWSe57Tp_49wHmwlRTQ/exec";

async function loadFieldRules() {
  const res = await fetch(`${WEBAPP}?action=getFieldRules`);
  const rules = await res.json();

  const tbody = document.querySelector("#fr-table tbody");
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
        <button class="edit-btn">Edit</button>
        <button onclick="deleteFieldRule(${index})">Delete</button>
      </td>
    `;

    tbody.appendChild(tr);
  });
}

// -----------------------------
// ADD RULE
// -----------------------------

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

  loadFieldRules();

  document.getElementById("fr-field").value = "";
  document.getElementById("fr-start").value = "";
  document.getElementById("fr-end").value = "";
  document.getElementById("fr-practice").value = "Yes";
  document.getElementById("fr-grades").value = "";
}

document.getElementById("fr-add-btn").addEventListener("click", addFieldRule);

// -----------------------------
// DELETE RULE
// -----------------------------

async function deleteFieldRule(index) {
  await fetch(`${WEBAPP}?action=deleteFieldRule&index=${index}`);
  loadFieldRules();
}

// -----------------------------
// EDIT RULE
// -----------------------------

document.addEventListener("click", (e) => {
  if (e.target.classList.contains("edit-btn")) {
    startEditingRow(e.target.closest("tr"));
  }

  if (e.target.classList.contains("save-btn")) {
    saveEditedRow(e.target.closest("tr"));
  }

  if (e.target.classList.contains("cancel-btn")) {
    loadFieldRules();
  }
});

function startEditingRow(row) {
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
    <button class="save-btn">Save</button>
    <button class="cancel-btn">Cancel</button>
  `;
}

async function saveEditedRow(row) {
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

  loadFieldRules();
}
