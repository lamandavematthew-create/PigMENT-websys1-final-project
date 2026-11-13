(function () {
  "use strict";
  const list = document.querySelector("#report-list");
  if (!list || !window.PigmentDiseaseStore) return;
  const dialog = document.querySelector("#report-detail");
  const detailContent = document.querySelector("#detail-content");
  const detailEmpty = document.querySelector("#detail-empty");
  const detailTitle = document.querySelector("#detail-title");
  const adminRemarks = document.querySelector("#detail-admin-remarks");
  const confirmationDetails = document.querySelector("#detail-confirmation-details");
  const message = document.querySelector("#admin-message");
  const adminCount = document.querySelector("#admin-count");
  const zoneForm = document.querySelector("#zone-form");
  const zoneList = document.querySelector("#zone-list");
  const zoneMessage = document.querySelector("#zone-message");
  const zoneMapElement = document.querySelector("#admin-zone-map");
  const zoneView = document.querySelector("#zones");
  const filters = [...document.querySelectorAll("[data-report-filter]")];
  const search = document.querySelector("#review-search");
  const reviewMessage = document.querySelector("#review-message");
  const results = document.querySelector("#review-results");
  const resultsCount = document.querySelector("#review-results-count");
  const reportRetry = document.querySelector("#review-retry");
  const zoneRetry = document.querySelector("#zone-retry");
  const zoneCount = document.querySelector("#zone-count");
  const zoneResults = document.querySelector("#zone-results");
  const zoneListMessage = document.querySelector("#zone-list-message");
  const zoneMapMessage = document.querySelector("#zone-map-message");
  const drawBoundary = document.querySelector("#zone-draw");
  const resetMap = document.querySelector("#zone-reset-map");
  const resetDrawing = document.querySelector("#zone-reset-drawing");
  const zoneCenter = [13.43, 121.96];
  const zoneZoom = 10;
  let filter = "pending";
  let reportsLoaded = false;
  let reportsRequest;
  let zonesLoaded = false;
  let zonesRequest;
  let activeView;
  let reports = [];
  let zones = [];
  let selectedId = null;
  let reportDecisionBusy = false;
  let zoneMap;
  let draftLayer;
  let savedLayers;

  function dateLabel(value) {
    return value ? new Date(`${value}T00:00:00`).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" }) : "Not provided";
  }
  function statusLabel(value) {
    return { pending: "Pending review", under_review: "Under review", confirmed: "Confirmed", rejected: "Rejected" }[value] || value;
  }
  function geometryFromLayer(layer) {
    const editable = layer.getLatLngs ? layer : layer.getLayers()[0];
    const coordinates = editable.getLatLngs()[0].map((point) => [point.lng, point.lat]);
    if (coordinates.length && (coordinates[0][0] !== coordinates[coordinates.length - 1][0] || coordinates[0][1] !== coordinates[coordinates.length - 1][1])) coordinates.push(coordinates[0]);
    return { type: "Polygon", coordinates: [coordinates] };
  }

  function reportLocation(report) {
    return [report.municipality, report.barangay].filter(Boolean).join(", ") || "Not provided";
  }

  function renderReports() {
    if (!reportsLoaded) return;
    const words = search.value.toLowerCase().trim().split(/[\s,#]+/).filter(Boolean);
    const counts = { all: reports.length, pending: 0, under_review: 0, confirmed: 0, rejected: 0 };
    const matching = reports.filter(report => {
      if (Object.hasOwn(counts, report.report_status) && report.report_status !== "all") counts[report.report_status]++;
      const haystack = `report #${report.report_id} ${reportLocation(report)}`.toLowerCase();
      return (filter === "all" || report.report_status === filter) && words.every(word => /^\d+$/.test(word) ? String(report.report_id) === word : haystack.includes(word));
    }).sort((first, second) => Number(second.report_status === "pending") - Number(first.report_status === "pending"));
    for (const button of filters) {
      const key = button.dataset.reportFilter;
      button.querySelector("span").textContent = counts[key];
      button.setAttribute("aria-pressed", String(key === filter));
    }
    list.replaceChildren();
    for (const report of matching) {
      const row = list.insertRow();
      row.classList.toggle("is-selected", dialog.open && Number(report.report_id) === selectedId);
      const cell = (label, value) => {
        const td = row.insertCell();
        td.dataset.label = label;
        if (value) td.textContent = value;
        return td;
      };
      const identity = cell("Report");
      const title = document.createElement("strong");
      title.textContent = `Report #${report.report_id}`;
      const disease = document.createElement("small");
      disease.textContent = report.disease_type || "Not provided";
      identity.append(title, disease);
      cell("Location", reportLocation(report));
      cell("Incident date", dateLabel(report.incident_date));
      const badge = document.createElement("span");
      badge.className = "review-status";
      badge.dataset.status = report.report_status;
      badge.textContent = statusLabel(report.report_status);
      cell("Status").append(badge);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "button button-primary review-open";
      button.dataset.reportId = report.report_id;
      button.textContent = "Review report";
      button.setAttribute("aria-label", `Review report #${report.report_id}`);
      cell("Action").append(button);
    }
    adminCount.textContent = `${reports.length} report${reports.length === 1 ? "" : "s"}`;
    results.hidden = matching.length === 0;
    reviewMessage.textContent = matching.length ? "" : !reports.length ? "No reports have been submitted." : "No reports match these filters.";
    resultsCount.textContent = `Showing ${matching.length} of ${reports.length} reports`;
  }

  filters.forEach(button => button.addEventListener("click", () => {
    filter = button.dataset.reportFilter;
    renderReports();
  }));
  search.addEventListener("input", renderReports);

  function showReport(id) {
    const report = reports.find((item) => Number(item.report_id) === id);
    if (!report) return;
    selectedId = id;
    detailTitle.textContent = `Report #${id} · ${report.disease_type}`;
    const status = document.querySelector("#detail-status");
    status.textContent = statusLabel(report.report_status);
    status.dataset.status = report.report_status;
    list.querySelectorAll("tr").forEach(row => row.classList.toggle("is-selected", Number(row.querySelector("[data-report-id]")?.dataset.reportId) === id));
    document.querySelector("#confirmation-section").open = false;
    document.querySelectorAll("#confirmation-section input, #confirmation-section textarea").forEach(field => field.value = "");
    if (!dialog.open) dialog.showModal();
    detailEmpty.hidden = true;
    detailContent.hidden = false;
    document.querySelector("#detail-location").textContent = reportLocation(report);
    document.querySelector("#detail-date").textContent = dateLabel(report.incident_date);
    document.querySelector("#detail-reporter").textContent = report.reporter_name || "Farmer";
    document.querySelector("#detail-description").textContent = report.description;
    adminRemarks.value = report.admin_remarks || "";
    message.textContent = "";
    confirmationDetails.value = "";
    const buttons = document.querySelectorAll(".admin-actions [data-action]");
    buttons.forEach(button => {
      const action = button.dataset.action;
      button.disabled = action === "under_review" ? report.report_status !== "pending"
        : action === "confirmed" ? !["pending", "under_review", "confirmed"].includes(report.report_status)
        : action === "publish" ? report.report_status !== "confirmed" || Boolean(report.is_published)
        : report.report_status === "rejected";
    });
  }

  document.querySelector("#close-report-detail").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener("close", () => list.querySelectorAll("tr").forEach(row => row.classList.remove("is-selected")));

  function populateIncidentChoices() {
    const select = zoneForm.elements.incidentReportId;
    const current = select.value;
    select.replaceChildren(new Option("None", ""));
    reports.filter(report => report.report_status === "confirmed").forEach(report => {
      select.add(new Option(`Report #${report.report_id} · ${report.municipality}`, report.report_id));
    });
    if ([...select.options].some(option => option.value === current)) select.value = current;
  }

  async function refreshReports() {
    if (reportsRequest) return reportsRequest;
    reviewMessage.textContent = "Loading reports…";
    reportRetry.hidden = true;
    reportsRequest = (async () => {
      try {
        reports = await window.PigmentDiseaseStore.loadReports("admin");
        reportsLoaded = true;
        renderReports();
        populateIncidentChoices();
        if (zonesLoaded) renderZones();
        return true;
      } catch (error) {
        reviewMessage.textContent = error.message || "Reports could not be loaded.";
        reportRetry.hidden = false;
        return false;
      } finally {
        reportsRequest = null;
      }
    })();
    return reportsRequest;
  }

  async function refreshZones() {
    if (zonesRequest) return zonesRequest;
    zoneRetry.hidden = true;
    if (!zonesLoaded) zoneListMessage.textContent = "Loading zones…";
    zonesRequest = (async () => {
      try {
        zones = await window.PigmentDiseaseStore.loadZones("admin");
        zonesLoaded = true;
        renderZones();
        if (zoneMap) {
          if (savedLayers) savedLayers.remove();
          savedLayers = L.geoJSON(zones.filter(zone => zone.geometry).map(zone => ({
            type: "Feature", geometry: zone.geometry, properties: { zone_id: zone.zone_id }
          })), { onEachFeature: (feature, layer) => layer.on("click", () => loadZone(zones.find(zone => zone.zone_id === feature.properties.zone_id))) });
          savedLayers.addTo(zoneMap);
        }

      } catch (error) {
        zoneListMessage.textContent = error.message || "Zones could not be loaded.";
        zoneRetry.hidden = false;
      } finally {
        zonesRequest = null;
      }
    })();
    return zonesRequest;
  }

  reportRetry.addEventListener("click", refreshReports);
  zoneRetry.addEventListener("click", refreshZones);

  list.addEventListener("click", (event) => {
    const target = event.target.closest("[data-report-id]");
    if (target) showReport(Number(target.dataset.reportId));
  });

  document.querySelector(".admin-actions").addEventListener("click", async (event) => {
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (!action || !selectedId || reportDecisionBusy) return;
    const reportId = selectedId;
    const report = reports.find((item) => Number(item.report_id) === reportId);
    if (!report) return;
    const status = action === "publish" || action === "confirmed" ? "confirmed" : action === "under_review" ? "under_review" : "rejected";
    const remarks = adminRemarks.value.trim();
    if (action === "rejected" && remarks.length < 5) { message.textContent = "Provide a reason for rejection (at least five characters)."; return; }
    if (action === "under_review" && !["pending", "under_review"].includes(report.report_status)) {
      message.textContent = "Only pending reports can be accepted for review."; return;
    }
    if (action === "confirmed" && !["pending", "under_review", "confirmed"].includes(report.report_status)) {
      message.textContent = "Rejected reports cannot be confirmed without reopening review."; return;
    }
    let confirmation = null;
    if (action === "confirmed") {
      confirmation = {
        confirmed_by_name: document.querySelector("#confirmed-by").value.trim(),
        designation: document.querySelector("#confirmation-designation").value.trim(),
        organization: document.querySelector("#confirmation-organization").value.trim(),
        confirmation_date: document.querySelector("#confirmation-date").value,
        reference_number: document.querySelector("#confirmation-reference").value.trim(),
        confirmation_notes: confirmationDetails.value.trim()
      };
      if (!confirmation.confirmed_by_name || !confirmation.designation || !confirmation.organization || !confirmation.confirmation_date) {
        document.querySelector("#confirmation-section").open = true;
        message.textContent = "Enter complete authorized veterinary confirmation details."; return;
      }
    }
    if (action === "publish" && report.report_status !== "confirmed") { message.textContent = "Record verified confirmation before publishing."; return; }
    const decisions = {
      under_review: ["Accept for review", "This moves the report to Under review. It does not confirm or publish the incident."],
      rejected: ["Reject report", "This marks the report as rejected and saves your reason."],
      confirmed: ["Record confirmation", "This saves the authorized veterinary confirmation without publishing the incident."],
      publish: ["Publish confirmed incident", "This makes the confirmed incident visible on the farmer map."]
    };
    const [label, explanation] = decisions[action];
    reportDecisionBusy = true;
    try {
      const accepted = await window.PigmentModal.ask({
        title: label + "?",
        message: `Report #${reportId}\n${explanation}`,
        accept: label,
        tone: action === "rejected" ? "danger" : "default"
      });
      if (!accepted || !dialog.open || selectedId !== reportId) return;
      await window.PigmentDiseaseStore.updateReport(reportId, {
        report_status: status,
        admin_remarks: remarks,
        confirmation,
        is_published: action === "publish"
      });
      const refreshed = await refreshReports();
      if (dialog.open && selectedId === reportId) {
        if (refreshed) showReport(reportId);
        message.textContent = refreshed
          ? (action === "publish" ? "Verified report published." : `Report marked ${statusLabel(status)}.`)
          : "Decision saved. Close the report and retry loading the queue.";
      }
    } catch (error) {
      message.textContent = error.message;
    } finally {
      reportDecisionBusy = false;
    }
  });

  function buttonZone(cell, text, handler, label) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "button button-secondary button-small";
    button.textContent = text;
    if (label) button.setAttribute("aria-label", label);
    button.addEventListener("click", handler);
    cell.append(button);
    return button;
  }

  function renderZones() {
    const confirmed = new Set(reports.filter(report => report.report_status === "confirmed").map(report => Number(report.report_id)));
    zoneCount.hidden = false;
    zoneCount.textContent = zones.length;
    zoneResults.hidden = zones.length === 0;
    zoneListMessage.textContent = zones.length ? "" : "No zones have been saved.";
    zoneList.replaceChildren();
    for (const zone of zones) {
      const row = zoneList.insertRow();
      const cell = (label, value) => {
        const td = row.insertCell();
        td.dataset.label = label;
        if (value) td.textContent = value;
        return td;
      };
      const name = document.createElement("strong");
      name.textContent = zone.zone_name;
      cell("Zone").append(name);
      cell("Location", reportLocation(zone));
      cell("Reported disease", zone.disease_type);
      const badge = (state, text) => {
        const el = document.createElement("span");
        el.className = "zone-pill";
        el.dataset.state = state;
        el.textContent = text;
        return el;
      };
      const severity = { low: "Low", moderate: "Moderate", high: "High" }[zone.severity] || "Not provided";
      cell("Severity").append(badge(zone.severity, severity));
      cell("Publication").append(badge(zone.is_published ? "published" : "unpublished", zone.is_published ? "Published" : "Unpublished"));
      const actions = document.createElement("div");
      actions.className = "zone-row-actions";
      cell("Actions").append(actions);
      buttonZone(actions, "Edit", () => loadZone(zone), `Edit ${zone.zone_name}`);
      if (zone.is_published) {
        buttonZone(actions, "Unpublish", () => updateZone(zone, false), `Unpublish ${zone.zone_name}`);
      } else {
        const publish = buttonZone(actions, "Publish", async () => {
          if (await window.PigmentModal.ask({title: "Publish zone?", message: `Show ${zone.zone_name} on the farmer map?`, accept: "Publish zone"}) && !zoneView.hidden) await updateZone(zone, true);
        }, `Publish ${zone.zone_name}`);
        publish.classList.add("zone-publish");
        const eligible = ["confirmed", "monitoring", "resolved"].includes(zone.zone_status);
        publish.disabled = !eligible || !confirmed.has(Number(zone.report_id));
        if (publish.disabled) {
          const hint = document.createElement("small");
          hint.textContent = !eligible ? "Set an eligible zone status first." : "Requires a confirmed linked report.";
          actions.append(hint);
        }
      }
      if (zone.zone_status !== "resolved") {
        buttonZone(actions, "Resolve", async () => {
          if (await window.PigmentModal.ask({title: "Resolve zone?", message: `Mark ${zone.zone_name} as resolved and remove it from the farmer map?`, accept: "Resolve zone"}) && !zoneView.hidden) await updateZone(zone, false, "resolved");
        }, `Resolve ${zone.zone_name}`);
      }
    }
  }

  async function loadZone(zone) {
    if (!zone) return;
    if (!zoneForm.hidden && !(await window.PigmentModal.ask({title: "Discard unsaved changes?", message: "The current zone edits will be lost if you open another zone.", accept: "Discard and edit", tone: "danger"}))) return;
    if (zoneView.hidden) return;
    clearZoneDraft();
    zoneMap?.pm?.disableDraw();
    zoneForm.hidden = false;
    document.querySelector("#zone-editor-title").textContent = "Edit zone";
    zoneMap?.invalidateSize({ pan: false });
    if (zoneMap && window.L && zone.geometry) {
      if (draftLayer) zoneMap.removeLayer(draftLayer);
      draftLayer = L.geoJSON(zone.geometry).getLayers()[0];
      draftLayer.addTo(zoneMap);
      if (draftLayer.pm) draftLayer.pm.enable();
      draftLayer.on('pm:edit',()=>{zoneForm.elements.geometry.value=JSON.stringify(geometryFromLayer(draftLayer));});
      zoneMap.fitBounds(draftLayer.getBounds(), { padding: [30, 30], maxZoom: 15, animate: false });
    }
    zoneForm.elements.zoneId.value = zone.zone_id;
    zoneForm.elements.name.value = zone.zone_name;
    zoneForm.elements.municipality.value = zone.municipality;
    zoneForm.elements.barangay.value = zone.barangay || "";
    zoneForm.elements.diseaseType.value = zone.disease_type;
    zoneForm.elements.severity.value = zone.severity;
    zoneForm.elements.status.value = zone.zone_status;
    zoneForm.elements.description.value = zone.description || "";
    zoneForm.elements.geometry.value = JSON.stringify(zone.geometry);
    zoneForm.elements.isPublished.checked = Boolean(zone.is_published);
    zoneForm.elements.incidentReportId.value = zone.report_id || "";
    zoneMessage.textContent = "Edit the zone details and save your changes.";
    zoneForm.elements.name.focus({ preventScroll: true });
    zoneForm.scrollIntoView({ block: "nearest" });
  }

  async function updateZone(zone, published, status = zone.zone_status) {
    try {
      await window.PigmentDiseaseStore.saveZone({
        zone_id: zone.zone_id,
        zone_name: zone.zone_name,
        disease_type: zone.disease_type,
        municipality: zone.municipality,
        barangay: zone.barangay || "",
        severity: zone.severity,
        zone_status: status,
        description: zone.description || "",
        report_id: zone.report_id,
        geometry: zone.geometry,
        is_published: published
      });
      zoneMessage.textContent = published ? "Zone published." : "Zone updated.";
      await refreshZones();
    } catch (error) {
      zoneMessage.textContent = error.message;
    }
  }

  zoneForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!zoneForm.reportValidity()) return;
    const values = Object.fromEntries(new FormData(zoneForm).entries());
    try {
      await window.PigmentDiseaseStore.saveZone({
        zone_id: values.zoneId || null,
        zone_name: values.name,
        disease_type: values.diseaseType,
        municipality: values.municipality,
        barangay: values.barangay,
        severity: values.severity,
        zone_status: values.status,
        description: values.description,
        geometry: JSON.parse(values.geometry || "null"),
        report_id: values.incidentReportId || null,
        is_published: Boolean(zoneForm.elements.isPublished.checked)
      });
      clearZoneDraft();
      zoneMessage.textContent = "Zone saved.";
      await refreshZones();
    } catch (error) {
      zoneMessage.textContent = error.message;
    }
  });

  function clearZoneDraft() {
    zoneForm.reset();
    zoneForm.hidden = true;
    if (draftLayer) {
      zoneMap.removeLayer(draftLayer);
      draftLayer = null;
    }
    requestAnimationFrame(() => { if (!zoneView.hidden) zoneMap?.invalidateSize({ pan: false }); });
  }

  document.querySelector("#cancel-zone").addEventListener("click", () => {
    clearZoneDraft();
    zoneMessage.textContent = "";
  });

  drawBoundary.addEventListener("click", async () => {
    if (!zoneMap?.pm) return;
    if (!zoneForm.hidden && !(await window.PigmentModal.ask({title: "Discard unsaved changes?", message: "The current zone edits will be lost if you draw a new zone.", accept: "Discard and draw", tone: "danger"}))) return;
    if (zoneView.hidden) return;
    clearZoneDraft();
    zoneMap.invalidateSize();
    zoneMap.pm.enableDraw("Polygon");
    zoneMessage.textContent = "Click on the map to add corners. Click the starting point to finish.";
  });

  resetDrawing.addEventListener("click", () => {
    if (zoneView.hidden || resetDrawing.disabled || !zoneMap?.pm) return;
    // Stop the unfinished Geoman polygon, then start with a fresh one.
    zoneMap.pm.disableDraw("Polygon");
    zoneMap.pm.enableDraw("Polygon");
    zoneMessage.textContent = "Drawing cleared. Click the map to start a new boundary.";
  });

  resetMap.addEventListener("click", () => {
    zoneMap?.invalidateSize({ pan: false });
    zoneMap?.setView(zoneCenter, zoneZoom, { animate: false });
  });

  function initializeZoneMap() {
    if (zoneMap || !zoneMapElement) return;
    if (!window.L) {
      zoneMapMessage.textContent = "The map could not load. Saved zones are still available below.";
      return;
    }
    zoneMap = L.map(zoneMapElement).setView(zoneCenter, zoneZoom);
    resetMap.disabled = false;
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: "&copy; OpenStreetMap contributors" }).addTo(zoneMap);
    if (!zoneMap.pm) {
      zoneMapMessage.textContent = "Boundary drawing tools could not load. Refresh the page to try again.";
      return;
    }
    drawBoundary.disabled = false;
    zoneMap.on("pm:drawstart", ({ shape }) => {
      resetDrawing.disabled = shape !== "Polygon";
    });
    zoneMap.on("pm:drawend", () => {
      resetDrawing.disabled = true;
    });
    zoneMap.on("pm:create", (event) => {
      resetDrawing.disabled = true;
      if (draftLayer) zoneMap.removeLayer(draftLayer);
      draftLayer = event.layer;
      zoneForm.reset();
      zoneForm.hidden = false;
      document.querySelector("#zone-editor-title").textContent = "New zone";
      zoneForm.elements.geometry.value = JSON.stringify(geometryFromLayer(draftLayer));
      zoneMessage.textContent = "Boundary drawn. Complete the form to save the zone.";
      requestAnimationFrame(() => {
        if (zoneView.hidden || draftLayer !== event.layer) return;
        zoneMap.invalidateSize({ pan: false });
        zoneMap.fitBounds(draftLayer.getBounds(), { padding: [30, 30], maxZoom: 15, animate: false });
      });
      zoneForm.elements.name.focus({ preventScroll: true });
    });
  }

  function switchView(section) {
    activeView = section;
    const inZones = section === "zones";
    if (section !== "reports" && dialog.open) dialog.close();
    if (!inZones) zoneMap?.pm?.disableDraw();
    if (section !== "reports" && !inZones) return;
    if (inZones) {
      const firstOpen = !zoneMap;
      initializeZoneMap();
      requestAnimationFrame(() => {
        if (zoneView.hidden || !zoneMap) return;
        zoneMap.invalidateSize({ pan: false });
        if (firstOpen) zoneMap.setView(zoneCenter, zoneZoom, { animate: false });
      });
      if (!zonesLoaded) refreshZones();
      if (!reportsLoaded) refreshReports().then(ok => {
        if (!ok && !zoneView.hidden && zoneRetry.hidden) zoneMessage.textContent = "Confirmed report choices could not be loaded. Open Review disease reports to retry.";
      });
    } else if (!reportsLoaded) refreshReports();
  }

  let inspectedDeepLink = false;
  window.addEventListener("pigment:admin-view", async ({ detail }) => {
    switchView(detail);
    if (detail !== "reports" || inspectedDeepLink) return;
    inspectedDeepLink = true;
    const requested = Number(new URLSearchParams(window.location.search).get("report"));
    if (!Number.isSafeInteger(requested) || requested < 1 || activeView !== "reports") return;
    if (!(reportsLoaded || await refreshReports()) || activeView !== "reports") return;
    const report = reports.find(item => Number(item.report_id) === requested);
    if (report) {
      if (report.report_status !== filter) filter = "all";
      renderReports();
      showReport(requested);
    } else {
      reviewMessage.textContent = `Report #${requested} was not found.`;
    }
  });
}());
