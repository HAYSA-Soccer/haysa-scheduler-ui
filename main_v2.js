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

  // ⭐ Normalize all Butler variants
  "AVON BUTLER": "BUTLER",
  "AVON BUTLER ELEMENTARY SCHOOL": "BUTLER",
  BUTLER: "BUTLER",
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

// ===== LAST UPDATE TICKER =====

function startLastUpdateTicker() {
  const el = document.getElementById("lastUpdate");
  if (!el) return;

  function refresh() {
    if (!lastCheckedTime) return;

    const checkedAgo = timeAgo(lastCheckedTime);
    const updatedAgo = lastUpdateText ? timeAgo(lastUpdateText) : null;

    if (!lastUpdateText) {
      el.textContent = `Last checked ${checkedAgo}`;
      return;
    }

    const icsChanged = lastUpdateText !== previousIcsTimestamp;

    if (icsChanged) {
      el.textContent = `Data updated ${updatedAgo}`;
    } else {
      el.textContent = `Last checked ${checkedAgo}`;
    }
  }

  refresh();
  setInterval(refresh, 60000);
}

// ===== LOADING OVERLAY =====

function showLoading() {
  const overlay = document.getElementById("loadingOverlay");
  if (overlay) overlay.style.display = "flex";
}

function hideLoading() {
  const overlay = document.getElementById("loadingOverlay");
  if (overlay) overlay.style.display = "none";
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
  showLoading();

  const data = await fetchSeasonEvents();

  // ⭐ Only overwrite if backend provides values
  if (data.seasonStart) SEASON_START = data.seasonStart;
  if (data.seasonEnd) SEASON_END = data.seasonEnd;

  const rawEvents = data.events || [];

  previousIcsTimestamp = lastUpdateText;
  lastUpdateText = data.lastUpdate || "";
  lastCheckedTime = Date.now();

  // Normalize canonical values BEFORE building field list
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

  // Build field list using normalized canonical names
  allFieldKeys = new Set();
  seasonEvents.forEach((ev) => {
    const ext = ev.extendedProps || {};
    if (ext.canonical) {
      allFieldKeys.add(ext.canonical);
    }
  });

  // Default: all fields ON
  selectedFields = new Set(allFieldKeys);

  initFieldLayersUI();
  startLastUpdateTicker();

  hideLoading();

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
    if (canonical === "SUMNER/SEAN JOYCE") {
      createFieldCheckbox(canonical, "Sumner / Sean Joyce");
      return;
    }

    const labelText = canonicalToLabel(canonical);
    createFieldCheckbox(canonical, labelText);
  });
}

// ===== LABEL HELPERS =====

function canonicalToLabel(canonical) {
  if (!canonical) return "";
  const upper = canonical.toUpperCase();
  switch (upper) {
    case "BROOKVILLE":
      return "Brookville";
    case "BUTLER":
      return "Butler";
    case "TURF":
      return "Turf";
    case "SUMNER/SEAN JOYCE":
      return "Sumner / Sean Joyce";
    default:
      return upper.charAt(0) + upper.slice(1).toLowerCase();
  }
}

// ===== DEVICE DETECTION =====

function isMobile() {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

// ===== PRACTICE CHANGE PANEL LOGIC =====

document.addEventListener("DOMContentLoaded", () => {
  const panel = document.getElementById("practiceActionPanel");
  const closeBtn = document.getElementById("closePracticePanel");

  const desktopBtn = document.getElementById("practiceActionFab");
  const mobileBtn = document.getElementById("practiceActionFabMobile");

  function openPanel() {
    panel.style.bottom = "20px";
  }

  if (desktopBtn) desktopBtn.addEventListener("click", openPanel);
  if (mobileBtn) mobileBtn.addEventListener("click", openPanel);

  closeBtn.addEventListener("click", () => {
    panel.style.bottom = "-350px";
  });
});

// ===== CUSTOM POPOVER HELPERS =====

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

  // Close button behavior
  closeBtn.addEventListener("click", () => {
    pop.classList.add("fc-popover-hidden");
  });

  // Click outside to close
  document.addEventListener("click", (e) => {
    if (!pop.contains(e.target) && !e.target.classList.contains("fc-event")) {
      pop.classList.add("fc-popover-hidden");
    }
  });

  popoverInitialized = true;
}

function getPopoverHeaderColor(ext) {
  const type = (ext.type || "").toLowerCase();
  const reasonType = (ext.reasonType || "").toLowerCase();

  if (type === "game") return "#3D7FB1";
  if (type === "practice") return "#757575";
  if (type === "availability") return "#4CAF50";
  if (reasonType === "closure") return "#B03A2E";
  if (reasonType === "admin_block" || type === "block") return "#C89F2A";

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

function decorateEvents(events) {
  return events.map((ev) => {
    ev = stripBackendColors(ev);

    const ext = ev.extendedProps || {};

    let newTitle = ev.title;
    if (ext.type === "game") {
      const home = ext.homeTeam || "";
      const away = ext.awayTeam || "";
      if (home || away) {
        newTitle = `${home} vs ${away}`.trim();
      }
    }

    return {
      ...ev,
      title: newTitle,
      classNames: (ev.classNames || []).concat(decorateEventClasses(ev)),
      extendedProps: {
        ...ext,
        tooltip: buildTooltip({
          ...ev,
          title: newTitle,
          extendedProps: ext,
        }),
      },
    };
  });
}

// ===== EVENT CLASS HELPERS =====

function isAvailabilityEvent(ev) {
  return ev.extendedProps?.type === "availability";
}

function isPracticeAllowed(ev) {
  return (ev.extendedProps?.practiceSurfaces || []).length > 0;
}

function isGameOnlyAvailability(ev) {
  const ps = ev.extendedProps?.practiceSurfaces || [];
  const gs = ev.extendedProps?.gameOnlySurfaces || [];
  return ps.length === 0 && gs.length > 0;
}

function decorateEventClasses(ev) {
  const classes = [];
  const ext = ev.extendedProps || {};

  if (isAvailabilityEvent(ev)) {
    if (isPracticeAllowed(ev)) classes.push("avail-practice");
    else if (isGameOnlyAvailability(ev)) classes.push("avail-game-only");
  }

  if (ext.type === "game") classes.push("game-event");
  if (ext.type === "practice") classes.push("practice-event");

  if (ext.reasonType === "closure") {
    classes.push("closure-event");
  } else if (ext.reasonType === "admin_block" || ext.type === "block") {
    classes.push("block-event");
  }

  return classes;
}

// ===== TOOLTIP BUILDER =====

function buildTooltip(ev) {
  const ext = ev.extendedProps || {};

  if (ext.type === "availability") {
    const ps = ext.practiceSurfaces || [];
    const gs = ext.gameOnlySurfaces || [];
    if (ps.length > 0) {
      return `Practice Available\nPractice Surfaces: ${ps.join(", ")}`;
    }
    return `Available for Games Only\nGame Surfaces: ${gs.join(", ")}`;
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
