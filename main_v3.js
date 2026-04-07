// ===== CONFIG =====

// Hard-coded season dates (kept unless backend provides them)
let SEASON_START = "2026-03-15";
let SEASON_END = "2026-06-30";

const API_URL =
  "https://script.google.com/macros/s/AKfycbz14OzCFeMIyWMY6FRLckWwgBBtlLej71cDkYNb-qGEISJVHHWSe57Tp_49wHmwlRTQ/exec";

const CANONICAL_MAP = {
  SUMNER: "SUMNER/SEAN JOYCE",
  "SEAN JOYCE": "SUMNER/SEAN JOYCE",
  "SUMNER/SEAN JOYCE": "SUMNER/SEAN JOYCE",

  "AVON BUTLER": "AVON BUTLER",
  "AVON BUTLER ELEMENTARY SCHOOL": "AVON BUTLER",
  BUTLER: "AVON BUTLER",
};

// ===== STATE =====

let calendar = null;
let seasonEvents = [];
let practiceOnly = false;
let selectedFields = new Set();
let allFieldKeys = new Set();

let lastUpdateText = "";
let lastCheckedTime = null;
let previousIcsTimestamp = "";

// Popover state
let popoverInitialized = false;

// ===== TIME HELPERS =====

function timeAgo(ts) {
  if (!ts) return "";

  const now = Date.now();
  const then = new Date(ts).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? "" : "s"} ago`;
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? "" : "s"} ago`;
  if (diffDay === 1) return "yesterday";

  return new Date(ts).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// ===== DATA LOAD =====

async function fetchSeasonEvents() {
  const params = new URLSearchParams();
  params.append("start", SEASON_START);
  params.append("end", SEASON_END);

  const url =
    API_URL + (API_URL.includes("?") ? "&" : "?") + params.toString();

  const res = await fetch(url);
  if (!res.ok) {
    console.error("Failed to fetch season events", res.status, res.statusText);
    return { lastUpdate: "", events: [] };
  }

  return await res.json();
}

async function loadSeasonData() {
  const overlay = document.getElementById("loadingOverlay");
  if (overlay) overlay.style.display = "flex";

  const data = await fetchSeasonEvents();

  if (data.seasonStart) SEASON_START = data.seasonStart;
  if (data.seasonEnd) SEASON_END = data.seasonEnd;

  const rawEvents = data.events || [];

  previousIcsTimestamp = lastUpdateText;
  lastUpdateText = data.lastUpdate || "";
  lastCheckedTime = Date.now();

  seasonEvents = rawEvents.map((ev) => {
    const ext = ev.extendedProps || {};
    const rawCanonical = (ext.canonical || "").toUpperCase();
    const normalizedCanonical = CANONICAL_MAP[rawCanonical] || rawCanonical;

    return {
      ...ev,
      extendedProps: {
        ...ext,
        canonical: normalizedCanonical,
      },
    };
  });

  allFieldKeys = new Set();
  seasonEvents.forEach((ev) => {
    const ext = ev.extendedProps || {};
    if (ext.canonical) {
      allFieldKeys.add(ext.canonical);
    }
  });

  selectedFields = new Set(allFieldKeys);

  initFieldLayersUI();

  if (overlay) overlay.style.display = "none";

  if (calendar) {
    calendar.refetchEvents();
  }
}

// ===== FIELD LAYERS UI =====

function createFieldCheckbox(canonical, labelText) {
  const container = document.getElementById("fieldLayersContainer");

  const wrapper = document.createElement("label");
  wrapper.className = "field-layer-item";

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = true;
  checkbox.dataset.canonical = canonical;

  checkbox.addEventListener("change", () => {
    if (checkbox.checked) {
      selectedFields.add(canonical);
    } else {
      selectedFields.delete(canonical);
    }
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

  allFieldKeys.forEach((canonical) => {
    let label = canonical;
    if (canonical === "SUMNER/SEAN JOYCE") label = "Sumner / Sean Joyce";
    else label = canonical.charAt(0) + canonical.slice(1).toLowerCase();

    createFieldCheckbox(canonical, label);
  });
}

// ===== PRACTICE CHANGE PANEL (TOGGLE + POLISHED UI) =====

document.addEventListener("DOMContentLoaded", () => {
  const panel = document.getElementById("practiceActionPanel");
  const closeBtn = document.getElementById("closePracticePanel");
  const desktopBtn = document.getElementById("practiceActionFab");
  const mobileBtn = document.getElementById("practiceActionFabMobile");

  function togglePanel() {
    panel.classList.toggle("open");
  }

  if (desktopBtn) desktopBtn.addEventListener("click", togglePanel);
  if (mobileBtn) mobileBtn.addEventListener("click", togglePanel);

  closeBtn.addEventListener("click", () => {
    panel.classList.remove("open");
  });
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

  document.addEventListener("click", (e) => {
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

    events: (info, success, fail) => {
      try {
        let filtered = filterByDateRange(seasonEvents, info.start, info.end);
        filtered = filterByPractice(filtered);
        filtered = filterByFields(filtered);
        filtered = decorateEvents(filtered);
        success(filtered);
      } catch (err) {
        console.error(err);
        fail(err);
      }
    },

    eventDidMount(info) {
      const tooltip = info.event.extendedProps?.tooltip;
      if (!isMobile() && tooltip) {
        info.el.title = tooltip;
      }
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

// ===== FILTERS =====

function filterByPractice(events) {
  if (!practiceOnly) return events;
  return events.filter(
    (ev) => !isAvailabilityEvent(ev) || isPracticeAllowed(ev)
  );
}

function filterByFields(events) {
  if (!selectedFields.size) return [];
  return events.filter((ev) =>
    selectedFields.has(ev.extendedProps?.canonical)
  );
}

function filterByDateRange(events, start, end) {
  const s = start.getTime();
  const e = end.getTime();
  return events.filter((ev) => {
    const evStart = new Date(ev.start).getTime();
    const evEnd = new Date(ev.end || ev.start).getTime();
    return evEnd > s && evStart < e;
  });
}

// ===== DECORATE EVENTS =====

function stripBackendColors(ev) {
  const clone = { ...ev };
  delete clone.backgroundColor;
  delete clone.borderColor;
  delete clone.textColor;
  delete clone.color;
  return clone;
}


// ===== EVENT CLASS HELPERS =====

function isAvailabilityEvent(ev) {
  const t = (ev.extendedProps?.type || "").toLowerCase();
  return t === "availability-practice" || t === "availability-game-only";
}

function isPracticeAllowed(ev) {
  return (ev.extendedProps?.type || "").toLowerCase() === "availability-practice";
}

function isGameOnlyAvailability(ev) {
  return (ev.extendedProps?.type || "").toLowerCase() === "availability-game-only";
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
      classes.push("block-event");
      break;

    case "closure":
      classes.push("closure-event");
      break;
  }

  return classes;
}


// ===== TOOLTIP BUILDER =====

function buildTooltip(ev) {
  const ext = ev.extendedProps || {};

  if (isAvailabilityEvent(ev)) {
    if (isPracticeAllowed(ev)) {
      return ext.tooltip || "Practice Available";
    }
    return ext.tooltip || "Available for Games Only";
  }


  if (ext.type === "game") {
    const parts = [];

    if (ev.title) parts.push(ev.title);
    if (ext.division) parts.push(`Division: ${ext.division}`);
    if (ext.ageGroup) parts.push(`Age Group: ${ext.ageGroup}`);
    if (ext.surface) parts.push(`Surface: ${ext.surface}`);
    if (ext.canonical) parts.push(`Field: ${ext.canonical}`);
    if (ext.gameId) parts.push(`Game ID: ${ext.gameId}`);

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
    await loadSeasonData();
  });
}

// ===== MOBILE WEEK NAV =====

function initMobileWeekNav() {
  const prevBtn = document.getElementById("mobilePrevWeek");
  const nextBtn = document.getElementById("mobileNextWeek");
  const todayBtn = document.getElementById("mobileToday");

  if (prevBtn) {
    prevBtn.addEventListener("click", () => {
      if (calendar) calendar.prev();
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      if (calendar) calendar.next();
    });
  }

  if (todayBtn) {
    todayBtn.addEventListener("click", () => {
      if (calendar) calendar.today();
    });
  }
}

// ===== BOOTSTRAP =====

document.addEventListener("DOMContentLoaded", async () => {
  await loadSeasonData();
  initPracticeToggle();
  initRefreshButton();
  initCalendar();
  initMobileWeekNav();
});
