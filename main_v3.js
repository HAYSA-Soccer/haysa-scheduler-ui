document.addEventListener("DOMContentLoaded", async () => {

  // === ADMIN MODE VIA URL FLAG ===
  const params = new URLSearchParams(window.location.search);
  const isAdmin = params.get("admin") === "1";

  if (isAdmin) {
    document.getElementById("refreshButton").style.display = "inline-block";
  }

  // ===== ADMIN WHITELIST =====
const ADMIN_EMAILS = [
  "haysa.manager@gmail.com",
  "president@haysa.org",
  "treasurer@haysa.org",
  "secretary@haysa.org",
  "riskmanager@haysa.org",
  "registrar@haysa.org",
  "webmaster@haysa.org",
  "volunteercoordinator.haysa@gmail.com",
  "assistanttreasurer.haysa@gmail.com",
  "coachcoordinator.haysa@gmail.com",
  "refereecoordinator.haysa@gmail.com",
  "minikickerdirector.haysa@gmail.com",
  "recdirector.haysa@gmail.com",
  "traveldirector.haysa@gmail.com",
  "brian.green88@yahoo.com"
];


// ===== CONFIG =====

let SEASON_START = "2026-03-15";
let SEASON_END   = "2026-06-30";

const API_URL =
  "https://script.google.com/macros/s/AKfycbz14OzCFeMIyWMY6FRLckWwgBBtlLej71cDkYNb-qGEISJVHHWSe57Tp_49wHmwlRTQ/exec";

// ===== STATE =====

let calendar = null;
let practiceOnly = false;
let selectedFields = new Set();
let allFieldKeys = new Set();

let lastUpdateText = "";
let lastCheckedTime = null;
let previousIcsTimestamp = "";

let popoverInitialized = false;

// Full-season snapshot
let SNAPSHOT = null;

// ===== SNAPSHOT LOADER =====

async function loadSnapshot(force = false) {
  const url = `${API_URL}?action=getSnapshot${force ? "&force=true" : ""}`;
  const res = await fetch(url);

  if (!res.ok) {
    console.error("Snapshot load failed", res.status, res.statusText);
    return SNAPSHOT;
  }

  SNAPSHOT = await res.json();
  return SNAPSHOT;
}

// ===== INITIAL FIELD LIST =====

async function loadSeasonMeta() {
  const overlay = document.getElementById("loadingOverlay");
  if (overlay) overlay.style.display = "flex";

  await loadSnapshot();

  if (!SNAPSHOT) {
    if (overlay) overlay.style.display = "none";
    return;
  }

  SEASON_START = SNAPSHOT.seasonStart;
  SEASON_END   = SNAPSHOT.seasonEnd;

  previousIcsTimestamp = lastUpdateText;
  lastUpdateText = SNAPSHOT.lastUpdate || "";
  lastCheckedTime = Date.now();

  allFieldKeys = new Set();
  (SNAPSHOT.events || []).forEach(ev => {
    const ext = ev.extendedProps || {};
    if (ext.canonical) allFieldKeys.add(ext.canonical);
  });

  selectedFields = new Set(allFieldKeys);

  initFieldLayersUI();

  if (overlay) overlay.style.display = "none";
}

// ===== FIELD LAYERS UI =====

function createFieldCheckbox(canonical, labelText) {
  const container = document.getElementById("fieldLayersContainer");
  if (!container) return;

  const wrapper = document.createElement("label");
  wrapper.className = "field-layer-item";

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = true;
  checkbox.dataset.canonical = canonical;

  checkbox.addEventListener("change", () => {
    if (checkbox.checked) selectedFields.add(canonical);
    else selectedFields.delete(canonical);
    if (calendar) calendar.refetchEvents();
  });

  const span = document.createElement("span");
  span.textContent = labelText;

  wrapper.appendChild(checkbox);
  wrapper.appendChild(span);
  container.appendChild(wrapper);
}

function initFieldLayersUI() {
  const container = document.getElementById("fieldLayersContainer");
  if (!container) return;

  container.innerHTML = "";

  allFieldKeys.forEach(canonical => {
    let label = canonical;
    if (canonical === "SUMNER/SEAN JOYCE") label = "Sumner / Sean Joyce";
    else label = canonical.charAt(0) + canonical.slice(1).toLowerCase();

    createFieldCheckbox(canonical, label);
  });
}

// ===== PRACTICE PANEL =====

document.addEventListener("DOMContentLoaded", () => {
  const panel = document.getElementById("practiceActionPanel");
  const closeBtn = document.getElementById("closePracticePanel");
  const desktopBtn = document.getElementById("practiceActionFab");
  const mobileBtn = document.getElementById("practiceActionFabMobile");

  function togglePanel() {
    if (!panel) return;
    panel.classList.toggle("open");
  }

  if (desktopBtn) desktopBtn.addEventListener("click", togglePanel);
  if (mobileBtn) mobileBtn.addEventListener("click", togglePanel);
  if (closeBtn) closeBtn.addEventListener("click", () => panel.classList.remove("open"));
});

// ===== DEVICE DETECTION =====

function isMobile() {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

// ===== CUSTOM POPOVER =====

function ensurePopoverInitialized() {
  if (popoverInitialized) return;

  const pop = document.createElement("div");
  pop.id = "fc-custom-popover";
  pop.className = "fc-popover-hidden";

  const header = document.createElement("div");
  header.className = "fc-popover-header";

  const titleSpan = document.createElement("span");
  titleSpan.id = "fc-popover-title";

  const closeBtn = document.createElement("button");
  closeBtn.id = "fc-popover-close";
  closeBtn.textContent = "×";

  header.appendChild(titleSpan);
  header.appendChild(closeBtn);

  const body = document.createElement("div");
  body.id = "fc-popover-body";

  pop.appendChild(header);
  pop.appendChild(body);

  document.body.appendChild(pop);

  closeBtn.addEventListener("click", () => {
    pop.classList.add("fc-popover-hidden");
  });

  document.addEventListener("click", e => {
    if (!pop.contains(e.target) && !e.target.classList.contains("fc-event")) {
      pop.classList.add("fc-popover-hidden");
    }
  });

  popoverInitialized = true;
}

function getPopoverHeaderColor(ext) {
  const type = (ext.type || "").toLowerCase();
  const reason = (ext.reasonType || "").toLowerCase();

  if (type === "game") return "#3D7FB1";
  if (type === "practice") return "#757575";
  if (type.startsWith("availability")) return "#4CAF50";
  if (reason === "closure") return "#B03A2E";
  if (reason === "admin_block" || type === "block") return "#C89F2A";

  return "#3D7FB1";
}

// ===== EVENT HELPERS =====

function isAvailabilityEvent(ev) {
  const t = (ev.extendedProps?.type || "").toLowerCase();
  return t === "availability-practice" || t === "availability-game-only";
}

function isPracticeAllowed(ev) {
  return (ev.extendedProps?.type || "").toLowerCase() === "availability-practice";
}

function decorateEventClasses(ev) {
  const classes = [];
  const ext = ev.extendedProps || {};
  const type = (ext.type || "").toLowerCase();

  switch (type) {
    case "availability-practice":
      classes.push("avail-practice");
      break;
    case "availability-game-only":
      classes.push("avail-game-only");
      break;
    case "practice":
      classes.push("practice-event");
      break;
    case "game":
      classes.push("game-event");
      break;
    case "block":
    case "admin_block":
      classes.push("block-event");
      break;
    case "closure":
      classes.push("closure-event");
      break;
  }

  return classes;
}

function stripBackendColors(ev) {
  const clone = { ...ev };
  delete clone.backgroundColor;
  delete clone.borderColor;
  delete clone.textColor;
  delete clone.color;
  return clone;
}

function buildTooltip(ev) {
  const ext = ev.extendedProps || {};

  if (isAvailabilityEvent(ev)) {
    if (isPracticeAllowed(ev)) return ext.tooltip || "Practice Available";
    return ext.tooltip || "Available for Games Only";
  }

  if (ext.type === "game") {
    const parts = [];
    if (ev.title) parts.push(ev.title);
    if (ext.surface) parts.push(`Surface: ${ext.surface}`);
    if (ext.canonical) parts.push(`Field: ${ext.canonical}`);
    return parts.join("\n");
  }

  if (ext.type === "practice") {
    const parts = [];
    if (ev.title) parts.push(ev.title);
    if (ext.surface) parts.push(`Surface: ${ext.surface}`);
    if (ext.canonical) parts.push(`Field: ${ext.canonical}`);
    return parts.join("\n");
  }

  return ev.title || "";
}

function decorateEvents(events) {
  return events.map(ev => {
    ev = stripBackendColors(ev);

    const ext = ev.extendedProps || {};

    let newTitle = ev.title;
    if (ext.type === "game") {
      const home = ext.homeTeam || "";
      const away = ext.awayTeam || "";
      if (home || away) newTitle = `${home} vs ${away}`.trim();
    }

    const backendTooltip = ext.tooltip;
    const computedTooltip = buildTooltip({
      ...ev,
      title: newTitle,
      extendedProps: ext,
    });

    return {
      ...ev,
      title: newTitle,
      classNames: (ev.classNames || []).concat(decorateEventClasses(ev)),
      extendedProps: {
        ...ext,
        tooltip: backendTooltip || computedTooltip,
      },
    };
  });
}

// ===== FILTERS =====

function filterByPractice(events) {
  if (!practiceOnly) return events;
  return events.filter(ev => !isAvailabilityEvent(ev) || isPracticeAllowed(ev));
}

function filterByFields(events) {
  if (!selectedFields.size) return [];
  return events.filter(ev =>
    selectedFields.has(ev.extendedProps?.canonical)
  );
}

// ===== CALENDAR =====

function initCalendar() {
  const calendarEl = document.getElementById("calendar");
  if (!calendarEl) return;

  ensurePopoverInitialized();

  calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: "timeGridWeek",
    nowIndicator: true,
    allDaySlot: false,
    slotMinTime: "06:00:00",
    slotMaxTime: "22:00:00",
    height: "auto",

    headerToolbar: {
      left: "prev,next today",
      center: "title",
      right: "timeGridWeek,dayGridMonth",
    },

    events: (info, success) => {
      if (!SNAPSHOT) {
        success([]);
        return;
      }

      let events = (SNAPSHOT.events || []).filter(ev => {
        const evStart = new Date(ev.start);
        return evStart >= info.start && evStart <= info.end;
      });

      events = filterByPractice(events);
      events = filterByFields(events);
      events = decorateEvents(events);

      success(events);
    },

    eventDidMount(info) {
      const tooltip = info.event.extendedProps?.tooltip;
      if (!isMobile() && tooltip) info.el.title = tooltip;
    },

    eventClick(info) {
      const tooltip = info.event.extendedProps?.tooltip;
      if (!tooltip) return;
      if (!isMobile()) return;

      info.jsEvent.preventDefault();
      info.jsEvent.stopPropagation();

      ensurePopoverInitialized();

      const pop = document.getElementById("fc-custom-popover");
      const titleEl = document.getElementById("fc-popover-title");
      const bodyEl = document.getElementById("fc-popover-body");
      const headerEl = pop.querySelector(".fc-popover-header");

      const ext = info.event.extendedProps || {};

      titleEl.textContent = info.event.title || "";
      bodyEl.textContent = tooltip;

      const headerColor = getPopoverHeaderColor(ext);
      headerEl.style.backgroundColor = headerColor;
      headerEl.style.color = "#ffffff";

      const rect = info.el.getBoundingClientRect();
      pop.style.left = rect.left + rect.width / 2 + "px";
      pop.style.top = rect.top + window.scrollY + rect.height + 8 + "px";

      pop.classList.remove("fc-popover-hidden");
    },
  });

  calendar.render();
}

// ===== PRACTICE TOGGLE =====

function initPracticeToggle() {
  const toggle = document.getElementById("practiceOnlyToggle");
  if (!toggle) return;

  toggle.addEventListener("change", () => {
    practiceOnly = toggle.checked;
    if (calendar) calendar.refetchEvents();
  });
}

// ===== REFRESH BUTTON =====

function initRefreshButton() {
  const btn = document.getElementById("refreshButton");
  if (!btn) return;

  btn.addEventListener("click", async () => {

    // If admin mode is active, call backend refresh
    const params = new URLSearchParams(window.location.search);
    const isAdmin = params.get("admin") === "1";

    if (isAdmin) {
      try {
        const url = `${API_URL}?action=refreshSnapshot&key=HAYSA_REFRESH`;
        const res = await fetch(url);
        const data = await res.json();

        if (data.success) {
          alert("Backend refreshed successfully!");
          await loadSnapshot(true);
          if (calendar) calendar.refetchEvents();
          return;
        } else {
          alert("Backend refresh failed or unauthorized.");
        }
      } catch (err) {
        console.error(err);
        alert("Error contacting backend.");
      }
    }

    // Non-admin fallback: local refresh only
    await loadSnapshot(true);
    if (calendar) calendar.refetchEvents();
  });
}


// ===== MOBILE WEEK NAV =====

function initMobileWeekNav() {
  const prevBtn = document.getElementById("mobilePrevWeek");
  const nextBtn = document.getElementById("mobileNextWeek");
  const todayBtn = document.getElementById("mobileToday");

  if (prevBtn) prevBtn.addEventListener("click", () => calendar && calendar.prev());
  if (nextBtn) nextBtn.addEventListener("click", () => calendar && calendar.next());
  if (todayBtn) todayBtn.addEventListener("click", () => calendar && calendar.today());
}

// ===== AUTO-REFRESH SNAPSHOT =====

function initAutoRefresh() {
  setInterval(async () => {
    const newSnap = await loadSnapshot();
    if (!newSnap || !SNAPSHOT) return;

    if (newSnap.lastUpdate !== SNAPSHOT.lastUpdate) {
      SNAPSHOT = newSnap;
      if (calendar) calendar.refetchEvents();
    }
  }, 5 * 60 * 1000);
}

// ===== BOOTSTRAP =====

document.addEventListener("DOMContentLoaded", async () => {
  await loadSeasonMeta();
  initPracticeToggle();
  initRefreshButton();
  initCalendar();
  initMobileWeekNav();
  initAutoRefresh();
});
