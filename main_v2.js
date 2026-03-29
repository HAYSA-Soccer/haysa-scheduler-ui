// ===== CONFIG =====

const API_URL = 'https://script.google.com/macros/s/AKfycbz14OzCFeMIyWMY6FRLckWwgBBtlLej71cDkYNb-qGEISJVHHWSe57Tp_49wHmwlRTQ/exec';


// ===== STATE =====
let calendar = null;
let allEvents = [];          // raw events from backend
let practiceOnly = false;    // toggle state
let currentFieldComplex = "BROOKVILLE"; // ⭐ NEW


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

function filterEventsForPracticeToggle(events) {
  if (!practiceOnly) return events;

  return events.filter(ev => {
    if (!isAvailabilityEvent(ev)) return true;
    return isPracticeAllowed(ev);
  });
}


// ===== FIELD FILTER PIPELINE =====

function applyFieldFilter(events) {
  return events.filter(ev =>
    ev.extendedProps &&
    ev.extendedProps.canonical === currentFieldComplex
  );
}


// ===== DECORATION PIPELINE =====

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


// ===== FETCH + INIT =====

async function fetchEvents(rangeStart, rangeEnd) {
  const params = new URLSearchParams();
  if (rangeStart) params.append('start', rangeStart.toISOString());
  if (rangeEnd) params.append('end', rangeEnd.toISOString());

  const url = API_URL + (API_URL.includes('?') ? '&' : '?') + params.toString();

  const res = await fetch(url);
  if (!res.ok) {
    console.error('Failed to fetch events', res.status, res.statusText);
    return { lastUpdate: 'Unknown', events: [] };
  }

  return await res.json();
}


// ===== RENDER PIPELINE =====

function renderFilteredEvents() {
  if (!calendar) return;

  // 1. Practice filter
  let filtered = filterEventsForPracticeToggle(allEvents);

  // 2. Field filter
  filtered = applyFieldFilter(filtered);

  // 3. Decorate
  const decorated = decorateEvents(filtered);

  // 4. Replace events
  calendar.removeAllEvents();
  calendar.addEventSource(decorated);
}


// ===== CALENDAR INIT =====

function initCalendar() {
  const calendarEl = document.getElementById('calendar');

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

    events: async (info, successCallback, failureCallback) => {
      try {
        const data = await fetchEvents(info.start, info.end);
        document.getElementById('lastUpdate').textContent =
          data.lastUpdate ? `ICS Last Update: ${data.lastUpdate}` : '';

        allEvents = data.events || [];

        // Apply both filters
        let filtered = filterEventsForPracticeToggle(allEvents);
        filtered = applyFieldFilter(filtered);

        const decorated = decorateEvents(filtered);

        successCallback(decorated);
      } catch (err) {
        console.error('Error loading events', err);
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


// ===== UI INIT =====

function initPracticeToggle() {
  const toggle = document.getElementById('practiceOnlyToggle');
  if (!toggle) return;

  toggle.addEventListener('change', () => {
    practiceOnly = toggle.checked;
    renderFilteredEvents();
  });
}

function initFieldFilter() {
  const select = document.getElementById('fieldFilter');
  if (!select) return;

  select.addEventListener('change', () => {
    currentFieldComplex = select.value;
    renderFilteredEvents();
  });
}


// ===== BOOTSTRAP =====

document.addEventListener('DOMContentLoaded', () => {
  initCalendar();
  initPracticeToggle();
  initFieldFilter();
});
