events: function (fetchInfo, successCallback, failureCallback) {
  try {
    const selectedFields = getSelectedFields();
    const selectedTypes = getSelectedTypes();

    // STEP 1 — Group events by field
    const grouped = {};
    for (const ev of allEvents) {
      const field =
        (ev.extendedProps && ev.extendedProps.field) ||
        (ev.extendedProps && ev.extendedProps.canonical) ||
        null;

      if (!field) continue;

      const normField = normalizeFieldName(field);
      if (!grouped[normField]) grouped[normField] = [];
      grouped[normField].push(ev);
    }

    const collapsedEvents = [];

    // STEP 2 — Process each field independently
    for (const field of Object.keys(grouped)) {
      if (selectedFields.length > 0 && !selectedFields.includes(field)) {
        continue;
      }

      const events = grouped[field];

      // Separate availability vs non-availability
      const availability = events.filter(e => e.extendedProps.type === "availability");
      const blockers = events.filter(e => e.extendedProps.type !== "availability");

      if (availability.length === 0) continue;

      // STEP 3 — Merge availability windows
      const merged = mergeWindows(availability);

      // STEP 4 — Subtract blockers (games, blocks, closures)
      const freeWindows = subtractWindows(merged, blockers);

      // STEP 5 — Determine free surfaces
      const surfaces = availability.map(a => a.extendedProps.surface).filter(Boolean);

      for (const win of freeWindows) {
        collapsedEvents.push({
          title: "Available",
          start: win.start,
          end: win.end,
          backgroundColor: "#6FCF97",
          borderColor: "#4CAF50",
          extendedProps: {
            type: "availability",
            field: field,
            fullAvailable: surfaces.length > 1,
            freeSurfaces: surfaces
          }
        });
      }
    }

    // STEP 6 — Add non-availability events normally
    const realEvents = allEvents.filter(e => e.extendedProps.type !== "availability");

    // STEP 7 — Apply type filters
    const filteredReal = realEvents.filter(e =>
      selectedTypes.includes(e.extendedProps.type)
    );

    successCallback([...collapsedEvents, ...filteredReal]);

  } catch (e) {
    console.error("Error in events function:", e);
    if (failureCallback) failureCallback(e);
  }
},
