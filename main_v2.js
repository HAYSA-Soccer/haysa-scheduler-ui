// ===== CONFIG =====

const API_URL = 'https://script.google.com/macros/s/AKfycbz14OzCFeMIyWMY6FRLckWwgBBtlLej71cDkYNb-qGEISJVHHWSe57Tp_49wHmwlRTQ/exec';

// Season range (from SeasonSettings)
const SEASON_START = '2026-03-15';
const SEASON_END   = '2026-06-30';


// ===== STATE =====

let calendar = null;
let seasonEvents = [];          // all events for the entire season
let practiceOnly = false;       // practice-only toggle
let selectedFields = new Set(); // canonical field keys currently selected
let allFieldKeys = new Set();   // all canonical field keys seen in the season
let lastUpdateText = '';        // ICS last update from backend


// ===== HELPERS =====

function isAvailabilityEvent(ev) {
  return ev.extendedProps && ev.extendedProps.type === 'availability';
}

function isPracticeAllowed(ev) {
  if (!isAvailabilityEvent(ev)) return false;
  const ps = ev.extendedProps.practiceSurfaces || [];
  return ps.length > 0;
}

function isGameOnlyAvailability(ev) {
  if (!isAvailabilityEvent(ev)) return false;
  const ps = ev.extendedProps.practiceSurfaces || [];
  const gs = ev.extendedProps.gameOnlySurfaces || [];
  return ps.length === 0 && gs.length > 0;
}

function decorateEventClasses(ev) {
  const classes = [];

  if (isAvailabilityEvent(ev)) {
    if (isPracticeAllowed(ev)) {
      classes.push('avail-practice');
    } else if (isGameOnlyAvailability(ev)) {
      classes.push('avail-game-only');
    }
  }

  if (ev.extendedProps && ev.extendedProps.type === 'game') {
    classes.push('game-event');
  }

  if (ev.extendedProps && ev.extendedProps.reasonType === 'closure') {
    classes.push('block-event');
  }

  return classes;
}

function buildTooltip(ev) {
  const ext = ev.extendedProps || {};
  const type = ext.type;

  if (type === 'availability') {
    const ps = ext.practiceSurfaces || [];
    const gs = ext.gameOnlySurfaces || [];

    if (ps.length > 0) {
      return [
        'Practice Available',
        ps.length ? 'Practice Surfaces: ' + ps.join(', ') : ''
      ].filter(Boolean).join('\n');
    } else {
      return [
        'Available for Games Only',
        gs.length ? 'Game Surfaces: ' + gs.join(', ') : ''
      ].filter(Boolean).join('\n');
    }
  }

  if (ext.tooltip) return ext.tooltip;

  const lines = [];
  if (ev.title) lines.push(ev.title);
  if (ext.field) lines.push('Field: ' + ext.field);
  if (ext.status) lines.push('Status: ' + ext.status);
  return lines.join('\n');
}

function filterByPractice(events) {
  if (!practiceOnly) return events;

  return events.filter(ev => {
    if (!isAvailabilityEvent(ev)) return true;
    return isPracticeAllowed(ev);
  });
}

function filterByFields(events) {
  // If no fields selected, show nothing
  if (!selectedFields || selectedFields.size === 0) return [];

  return events.filter(ev => {
    const ext = ev.extendedProps || {};
    const canonical = ext.canonical;
    if (!canonical) return false;
    return selectedFields.has(canonical);
  });
}

function filterByDateRange(events, start, end) {
  const startMs = start.getTime();
  const endMs = end.getTime();

  return events.filter(ev => {
    const evStart = new Date(ev.start).getTime();
    const evEnd = new Date(ev.end || ev.start).getTime();
    return evEnd > startMs && evStart < endMs;
  });
}

function decorateEvents(events) {
  return events.map(ev => {
    const extraClasses = decorateEventClasses(ev);
    const tooltip = buildTooltip(ev);

    return {
      ...ev,
      classNames: (ev.classNames || []).concat(extraClasses),
      extendedProps: {
        ...ev.extendedProps,
        tooltip
      }
    };
  });
}

// Canonical -> human label
function canonicalToLabel(canonical) {
  if (!canonical) return '';
  const upper = String(canonical).toUpperCase();
  switch (upper) {
    case 'BROOKVILLE': return 'Brookville';
    case 'SUMNER':     return 'Sumner';
    case 'BUTLER':     return 'Butler';
    case 'TURF':       return 'Turf';
    default:
      // Fallback: capitalize first letter, lower the rest
      return upper.charAt(0) + upper.slice(1).toLowerCase();
  }
}


// ===== DATA LOAD (SEASON ONCE) =====

async function fetchSeasonEvents() {
  const params = new URLSearchParams();
  params.append('start', SEASON_START);
  params.append('end', SEASON_END);

  const url = API_URL + (API_URL.includes('?') ? '&' : '?') + params.toString();

  const res = await fetch(url);
  if (!res.ok) {
    console.error('Failed to fetch season events', res.status, res.statusText);
    return { lastUpdate: 'Unknown', events: [] };
  }

  const data = await res.json();
  return data;
}

async function loadSeasonData() {
  const data = await fetchSeasonEvents();
  seasonEvents = data.events || [];
  lastUpdateText = data.lastUpdate || '';

  // Build field list from entire season
  allFieldKeys = new Set();
  seasonEvents.forEach(ev => {
    const ext = ev.extendedProps || {};
    if (ext.canonical) {
      allFieldKeys.add(ext.canonical);
    }
  });

  // Default: all fields ON
  selectedFields = new Set(allFieldKeys);

  // Update last update label
  const lastUpdateEl = document.getElementById('lastUpdate');
  if (lastUpdateEl) {
    lastUpdateEl.textContent = lastUpdateText
      ? `ICS Last Update: ${lastUpdateText}`
      : '';
  }

  // Build field layer checkboxes
  initFieldLayersUI();
}


// ===== UI: FIELD LAYERS =====

function initFieldLayersUI() {
  const container = document.getElementById('fieldLayersContainer');
  if (!container) return;

  container.innerHTML = '';

  allFieldKeys.forEach(canonical => {
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
      if (calendar) {
        calendar.refetchEvents();
      }
    });

    const span = document.createElement('span');
    span.textContent = labelText;

    wrapper.appendChild(checkbox);
    wrapper.appendChild(span);
    container.appendChild(wrapper);
  });
}


// ===== CALENDAR INIT =====

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

    // Use cached seasonEvents; filter per view
    events: (info, successCallback, failureCallback) => {
      try {
        // 1) Filter by date range
        let filtered = filterByDateRange(seasonEvents, info.start, info.end);

        // 2) Practice filter
        filtered = filterByPractice(filtered);

        // 3) Field filter
        filtered = filterByFields(filtered);

        // 4) Decorate
        const decorated = decorateEvents(filtered);

        successCallback(decorated);
      } catch (err) {
        console.error('Error building events', err);
        failureCallback(err);
      }
    },

    eventDidMount(info) {
      if (info.event.extendedProps && info.event.extendedProps.tooltip) {
        info.el.title = info.event.extendedProps.tooltip;
      }
    }
  });

  calendar.render();
}


// ===== UI: PRACTICE TOGGLE =====

function initPracticeToggle() {
  const toggle = document.getElementById('practiceOnlyToggle');
  if (!toggle) return;

  toggle.addEventListener('change', () => {
    practiceOnly = toggle.checked;
    if (calendar) {
      calendar.refetchEvents();
    }
  });
}


// ===== BOOTSTRAP =====

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await loadSeasonData();   // fetch entire season once
    initPracticeToggle();     // wire practice toggle
    initCalendar();           // start calendar using cached data
  } catch (err) {
    console.error('Error during initialization', err);
  }
});
