document.addEventListener("DOMContentLoaded", () => {
  const buttons = document.querySelectorAll(".tab-btn");
  const panels = document.querySelectorAll(".tab-panel");

  function showTab(tabName) {
    panels.forEach(panel => {
      panel.classList.toggle("active", panel.id === tabName);
    });

    if (tabName === "rules") loadFieldRules();
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
// FIELD RULES TAB LOGIC
// -----------------------------

const WEBAPP = "https://script.google.com/macros/s/AKfycbz14OzCFeMIyWMY6FRLckWwgBBtlLej71cDkYNb-qGEISJVHHWSe57Tp_49wHmwlRTQ/exec";

async function loadFieldRules() {
  const res = await fetch(`${WEBAPP}?action=getFieldRules`);
  const rules = await res.json();

  const tbody = document.querySelector("#fr-table tbody");
  tbody.innerHTML = "";

  rules.forEach((rule, index) => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${rule.field}</td>
      <td>${rule.day_of_week}</td>
      <td>${rule.start_time}</td>
      <td>${rule.end_time}</td>
      <td>${rule.practice_allowed}</td>
      <td>${rule.travel_game_grades}</td>
      <td>
        <button onclick="deleteFieldRule(${index})">Delete</button>
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

  // reload table
  loadFieldRules();

  // optional: clear form
  document.getElementById("fr-field").value = "";
  document.getElementById("fr-start").value = "";
  document.getElementById("fr-end").value = "";
  document.getElementById("fr-practice").value = "Yes";
  document.getElementById("fr-grades").value = "";
}

async function deleteFieldRule(index) {
  await fetch(`${WEBAPP}?action=deleteFieldRule&index=${index}`);
  loadFieldRules();
}

document.getElementById("fr-add-btn").addEventListener("click", addFieldRule);
