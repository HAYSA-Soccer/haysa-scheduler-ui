async function loadSeasonMeta() {
  const today = new Date();
  const params = new URLSearchParams();
  params.append("start", today.toISOString());
  params.append("end", SEASON_END);

  const url =
    API_URL + (API_URL.includes("?") ? "&" : "?") + params.toString();

  const res = await fetch(url);
  if (!res.ok) {
    console.error("Failed to fetch season meta", res.status, res.statusText);
    return;
  }

  const data = await res.json();

  if (data.seasonStart) SEASON_START = data.seasonStart;
  if (data.seasonEnd) SEASON_END = data.seasonEnd;

  previousIcsTimestamp = lastUpdateText;
  lastUpdateText = data.lastUpdate || "";
  lastCheckedTime = Date.now();

  // Build field list from whatever events exist today → end of season
  allFieldKeys = new Set();
  (data.events || []).forEach((ev) => {
    const ext = ev.extendedProps || {};
    if (ext.canonical) {
      allFieldKeys.add(ext.canonical);
    }
  });

  selectedFields = new Set(allFieldKeys);
  initFieldLayersUI();
}
