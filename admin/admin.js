document.addEventListener("DOMContentLoaded", () => {
  const buttons = document.querySelectorAll(".tab-btn");
  const panels = document.querySelectorAll(".tab-panel");

  function showTab(tabName) {
    panels.forEach(panel => {
      panel.classList.toggle("active", panel.id === tabName);
    });
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
