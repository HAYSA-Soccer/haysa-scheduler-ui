// =========================
// CONFIG
// =========================
const API_URL =
  "https://script.google.com/macros/s/AKfycbz14OzCFeMIyWMY6FRLckWwgBBtlLej71cDkYNb-qGEISJVHHWSe57Tp_49wHmwlRTQ/exec";

// Canonical → Display label
const LABELS = {
  "AVON BUTLER": "Butler",
  "TURF": "Turf"
};

// =========================
// COMPLEX MAP DEFINITIONS
// =========================
const COMPLEX_MAPS = {
  "AVON BUTLER": {
  label: "Butler",
  image: "assets/butler-layout.jpg",

  fields: {
    "3": {
      left: 55.8,
      top: 27.0,
      width: 10.5,
      height: 10.4
    },
    "4": {
      left: 71.3,
      top: 27.0,
      width: 10.3,
      height: 10.6
    },
    "1": {
      left: 55.8,
      top: 39.1,
      width: 10.3,
      height: 10.6
    },
    "2": {
      left: 69.8,
      top: 40.1,
      width: 10.3,
      height: 10.6
    },
    "5": {
      left: 55.8,
      top: 57.7,
      width: 10.3,
      height: 10.4
    },
    "6": {
      left: 55.8,
      top: 68.4,
      width: 10.3,
      height: 10.4
    }
  }
},


  "TURF": {
    label: "Turf",
    image: "assets/turf.jpg",
    fields: {
      "FULL": { left: 10, top: 10, width: 80, height: 80 }
    }
  }
}

// =========================
// FETCH BACKEND DATA
// =========================
async function loadBackend() {
  const res = await fetch(API_URL);
  return res.json();
}

// =========================
// BUILD TABS
// =========================
function buildTabs(active) {
  const tabBar = document.getElementById("complex-tabs");
  tabBar.innerHTML = "";

  // All Complexes tab
  const allTab = document.createElement("div");
  allTab.className = "tab active";
  allTab.dataset.complex = "ALL";
  allTab.textContent = "All Complexes";
  tabBar.appendChild(allTab);

  // Individual complex tabs
  active.forEach(c => {
    const tab = document.createElement("div");
    tab.className = "tab";
    tab.dataset.complex = c;
    tab.textContent = LABELS[c] || c;
    tabBar.appendChild(tab);
  });

  tabBar.addEventListener("click", e => {
    if (!e.target.classList.contains("tab")) return;
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    e.target.classList.add("active");

    const selected = e.target.dataset.complex;
    showComplex(selected, active);
  });
}

// =========================
// RENDER ALL COMPLEXES
// =========================
function renderAllComplexes(active, availability) {
  const container = document.getElementById("all-complexes");
  container.innerHTML = "";

  active.forEach(c => {
    const map = COMPLEX_MAPS[c];
    if (!map) return;

    const wrapper = document.createElement("div");
    wrapper.className = "map-wrapper";

    const img = document.createElement("img");
    img.src = map.image;
    img.className = "map-image";
    wrapper.appendChild(img);

    // Add field overlays
    Object.entries(map.fields).forEach(([field, pos]) => {
      const box = document.createElement("div");
      box.className = "field-box";

      // Position
      box.style.left = pos.left + "%";
      box.style.top = pos.top + "%";
      box.style.width = pos.width + "%";
      box.style.height = pos.height + "%";

      // Label
      box.dataset.label = `${map.label} – ${field}`;

      // Availability coloring
      const isAvailable = availability[c]?.includes(field);
      if (!isAvailable) box.classList.add("unavailable");

      wrapper.appendChild(box);
    });

    container.appendChild(wrapper);
  });
}

// =========================
// RENDER SINGLE COMPLEX
// =========================
function renderSingleComplex(canonical, availability) {
  const container = document.getElementById("single-complex");
  container.innerHTML = "";

  const map = COMPLEX_MAPS[canonical];
  if (!map) return;

  const wrapper = document.createElement("div");
  wrapper.className = "map-wrapper";

  const img = document.createElement("img");
  img.src = map.image;
  img.className = "map-image";
  wrapper.appendChild(img);

  Object.entries(map.fields).forEach(([field, pos]) => {
    const box = document.createElement("div");
    box.className = "field-box";

    box.style.left = pos.left + "%";
    box.style.top = pos.top + "%";
    box.style.width = pos.width + "%";
    box.style.height = pos.height + "%";

    box.dataset.label = `${map.label} – ${field}`;

    const isAvailable = availability[canonical]?.includes(field);
    if (!isAvailable) box.classList.add("unavailable");

    wrapper.appendChild(box);
  });

  container.appendChild(wrapper);
}

// =========================
// TAB SWITCHING
// =========================
function showComplex(selected, active) {
  const all = document.getElementById("all-complexes");
  const single = document.getElementById("single-complex");

  if (selected === "ALL") {
    all.classList.remove("hidden");
    single.classList.add("hidden");
  } else {
    all.classList.add("hidden");
    single.classList.remove("hidden");
    renderSingleComplex(selected, window._availability);
  }
}

// =========================
// MAIN INIT
// =========================
async function init() {
  const data = await loadBackend();

  const active = data.activeComplexes || [];
  const events = data.events || [];

  // Build a simple availability snapshot:
  // A field is "available" if it has NO events today.
  const today = new Date().toISOString().split("T")[0];
  const availability = {};

  active.forEach(c => (availability[c] = []));

  events.forEach(ev => {
    const date = ev.start.split("T")[0];
    if (date !== today) return;

    const canonical = ev.extendedProps?.canonical;
    const surface = ev.extendedProps?.surface;

    if (active.includes(canonical)) {
      availability[canonical].push(surface);
    }
  });

  window._availability = availability;

  buildTabs(active);
  renderAllComplexes(active, availability);
}

init();
