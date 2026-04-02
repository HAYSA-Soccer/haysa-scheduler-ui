async function loadFieldRules() {
  const res = await fetch(`${WEBAPP}?action=getFieldRules`);
  const rules = await res.json();

  const tbody = document.querySelector("#fr-table tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  rules.forEach((rule, index) => {
    const tr = document.createElement("tr");
    tr.dataset.index = index;

    // Detect fully closed field hours
    const isClosed =
      (rule.start_time === "12:00" && rule.end_time === "12:00") ||
      (rule.start_time === "" && rule.end_time === "");

    if (isClosed) {
      tr.classList.add("fh-closed");
    }

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
