// ===== CONFIG =====

const API_URL = 'https://script.google.com/macros/s/AKfycbz14OzCFeMIyWMY6FRLckWwgBBtlLej71cDkYNb-qGEISJVHHWSe57Tp_49wHmwlRTQ/exec';

// Season range
const SEASON_START = '2026-03-15';
const SEASON_END   = '2026-06-30';

// Canonical normalization map
const CANONICAL_MAP = {
  'SUMNER': 'SUMNER/SEAN JOYCE',
  'SEAN JOYCE': 'SUMNER/SEAN JOYCE',
  'SUMNER/SEAN JOYCE': 'SUMNER/SEAN JOYCE'
};


// ===== STATE =====

let calendar = null;
let seasonEvents = [];
let practiceOnly = false;
let selectedFields = new Set();
let allFieldKeys = new Set();

let lastUpdateText = '';       // ICS timestamp from backend
let lastCheckedTime = null;    // when frontend fetched
let previousIcsTimestamp = ''; // to detect real updates


// ===== TIME HELPERS =====

function timeAgo(ts) {
  if (!ts) return '';

  const now = Date.now();
  const then = new Date(ts).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? '' : 's'} ago`;
  if (diffDay === 1) return 'yesterday';

  return new Date(ts).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}


// ===== LAST UPDATE TICKER =====

function startLastUpdateTicker() {
  const el = document.getElementById('lastUpdate');
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
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) overlay.style.display = 'flex';
}

function hideLoading() {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) overlay.style.display = 'none';
}


// ===== DATA LOAD =====

async function fetchSeasonEvents() {
  const params = new URLSearchParams();
  params.append('start', SEASON_START);
  params.append('end', SEASON_END);

  const url = API_URL + (API_URL.includes('?') ? '&' : '?') + params.toString();

  const res = await fetch(url);
  if (!res.ok) {
    console.error('Failed to fetch season events', res.status, res.statusText);
    return { lastUpdate: '', events: [] };
  }

  return await res.json();
}

async function loadSeasonData() {
  showLoading();

  const data = await fetchSeasonEvents();
  const rawEvents = data.events || [];

  previousIcsTimestamp = lastUpdateText;
  lastUpdateText = data.lastUpdate || '';
  lastCheckedTime = Date.now();

  // Normalize canonical values
  seasonEvents = rawEvents.map(ev => {
    const ext = ev.extendedProps || {};
    const rawCanonical = (ext.canonical || '').toUpperCase();
    const normalizedCanonical = CANONICAL_MAP[rawCanonical] || rawCanonical;

    return {
      ...ev,
      extendedProps: {
        ...ext,
        canonical: normalizedCanonical
      }
    };
  });

  // Build field list
  allFieldKeys = new Set();
  seasonEvents.forEach(ev => {
    const ext = ev.extendedProps || {};
    if (ext.canonical) {
      allFieldKeys.add(ext.canonical);
    }
  });

  selectedFields = new Set(allFieldKeys);

  initFieldLayersUI();
  startLastUpdateTicker();

  hideLoading();

  if (calendar) {
    calendar.refetchEvents();
  }
}


// ===== FIELD LAYERS UI =====

function initFieldLayersUI() {
  const container = document.getElementById('fieldLayersContainer');
  if (!container) return;

  container.innerHTML = '';

  allFieldKeys.forEach(canonical => {
    // Remove Sumner/Sean Joyce from UI
    if (canonical === 'SUMNER/SEAN JOYCE') return;

    const labelText = canonicalToLabel(canonical);

    const wrapper = document.createElement('label');
    wrapper.className = 'field-layer-item';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = true;
    checkbox.dataset.canonical = canonical;

    checkbox.addEventListener('change', () => {
      if (checkbox.checked) {
        selectedFields.add(canonical);
      } else {
        selectedFields.delete(canonical);
      }
      if (calendar) calendar.refetchEvents();
    });

    const span = document.createElement('span');
    span.textContent = labelText;

    wrapper.appendChild(checkbox);
    wrapper.appendChild(span);
    container.appendChild(wrapper);
  });
}


// ===== LABEL HELPERS =====

function canonicalToLabel(canonical) {
  if (!canonical) return '';
  const upper = canonical.toUpperCase();
  switch (upper) {
    case 'BROOKVILLE': return 'Brookville';
    case 'BUTLER': return 'Butler';
    case 'TURF': return 'Turf';
    case 'SUMNER/SEAN JOYCE': return 'Sumner/Sean Joyce';
    default:
      return upper.charAt(0) + upper.slice(1).toLowerCase();
  }
}


// ===== CALENDAR =====

function initCalendar() {
  const calendarEl = document.getElementById('calendar');
  if (!calendarEl) return;

  calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'timeGridWeek',
    nowIndicator: true,
    allDaySlot: false,
    slotMinTime: '06:00:00',
    slotMaxTime: '22:00:00',
    height: 'auto',

    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'timeGridWeek,dayGridMonth'
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
      if (info.event.extendedProps?.tooltip) {
        info.el.title = info.event.extendedProps.tooltip;
      }
    }
  });

  calendar.render();
}


// ===== FILTERS =====

function filterByPractice(events) {
  if (!practiceOnly) return events;
  return events.filter(ev => !isAvailabilityEvent(ev) || isPracticeAllowed(ev));
}

function filterByFields(events) {
  if (!selectedFields.size) return [];
  return events.filter(ev => selectedFields.has(ev.extendedProps?.canonical));
}

function filterByDateRange(events, start, end) {
  const s = start.getTime();
  const e = end.getTime();
  return events.filter(ev => {
    const evStart = new Date(ev.start).getTime();
    const evEnd = new Date(ev.end || ev.start).getTime();
    return evEnd > s && evStart < e;
  });
}

function decorateEvents(events) {
  return events.map(ev => ({
    ...ev,
    classNames: (ev.classNames || []).concat(decorateEventClasses(ev)),
    extendedProps: {
      ...ev.extendedProps,
      tooltip: buildTooltip(ev)
    }
  }));
}


// ===== EVENT CLASS HELPERS =====

function isAvailabilityEvent(ev) {
  return ev.extendedProps?.type === 'availability';
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
  if (isAvailabilityEvent(ev)) {
    if (isPracticeAllowed(ev)) classes.push('avail-practice');
    else if (isGameOnlyAvailability(ev)) classes.push('avail-game-only');
  }
  if (ev.extendedProps?.type === 'game') classes.push('game-event');
  if (ev.extendedProps?.reasonType === 'closure') classes.push('block-event');
  return classes;
}

function buildTooltip(ev) {
  const ext = ev.extendedProps || {};
  if (ext.type === 'availability') {
    const ps = ext.practiceSurfaces || [];
    const gs = ext.gameOnlySurfaces || [];
    if (ps.length > 0) {
      return `Practice Available\nPractice Surfaces: ${ps.join(', ')}`;
    }
    return `Available for Games Only\nGame Surfaces: ${gs.join(', ')}`;
  }
  if (ext.tooltip) return ext.tooltip;
  return ev.title || '';
}


// ===== PRACTICE TOGGLE =====

function initPracticeToggle() {
  const toggle = document.getElementById('practiceOnlyToggle');
  if (!toggle) return;

  toggle.addEventListener('change', () => {
    practiceOnly = toggle.checked;
    if (calendar) calendar.refetchEvents();
  });
}


// ===== REFRESH BUTTON =====

function initRefreshButton() {
  const btn = document.getElementById('refreshButton');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    await loadSeasonData();
  });
}


// ===== MOBILE WEEK NAV =====

function initMobileWeekNav() {
  const prevBtn = document.getElementById('mobilePrevWeek');
  const nextBtn = document.getElementById('mobileNextWeek');
  const todayBtn = document.getElementById('mobileToday');

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (calendar) calendar.prev();
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      if (calendar) calendar.next();
    });
  }

  if (todayBtn) {
    todayBtn.addEventListener('click', () => {
      if (calendar) calendar.today();
    });
  }
}


// ===== BOOTSTRAP =====

document.addEventListener('DOMContentLoaded', async () => {
  await loadSeasonData();
  initPracticeToggle();
  initRefreshButton();
  initCalendar();
  initMobileWeekNav();
});
