(function () {
  "use strict";

  const mapElement = document.querySelector("#disease-map");
  if (!mapElement || !window.PigmentDiseaseStore) return;
  const L = window.L;

  const diseaseView = document.querySelector("#disease-awareness");
  const municipalityFilter = document.querySelector("#municipality-filter");
  const diseaseFilter = document.querySelector("#disease-filter");
  const zoneStatusFilter = document.querySelector("#zone-status-filter");
  const mapCount = document.querySelector("#map-count");
  const emptyMessage = document.querySelector("#map-empty");
  const reportForm = document.querySelector("#disease-report-form");
  const reportMessage = document.querySelector("#report-form-message");
  const reportLocation = document.querySelector("#selected-report-location");
  const reportLatitude = reportForm?.elements.namedItem("latitude");
  const reportLongitude = reportForm?.elements.namedItem("longitude");
  const map = L ? L.map(mapElement).setView([13.43, 121.96], 10) : null;
  const dialog = document.querySelector("#submit-report");
  const reportOpen = document.querySelector("#health-report-open");
  const success = document.querySelector("#health-report-success");
  const tabs = [...diseaseView.querySelectorAll(".health-tabs a")];
  const sections = tabs.map((tab) => document.querySelector(tab.hash));
  const submitButton = reportForm.querySelector("button[type=submit]");
  let returnFocus = null;
  const pickerElement = document.querySelector("#report-location-map");
  const pickerMap = L && pickerElement ? L.map(pickerElement).setView([13.43, 121.96], 10) : null;
  if (pickerMap) L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: "&copy; OpenStreetMap contributors" }).addTo(pickerMap);
  if (map) L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: "&copy; OpenStreetMap contributors" }).addTo(map);
  const markerLayer = map ? L.layerGroup().addTo(map) : null;
  const zoneLayer = map ? L.layerGroup().addTo(map) : null;
  let reports = [];
  let zones = [];
  let pickerLocationMarker = null;

  const zoneStyles = {
    confirmed: { color: "#b42318", fillColor: "#dc2626", fillOpacity: 0.34 },
    monitoring: { color: "#c2410c", fillColor: "#f97316", fillOpacity: 0.28 },
    resolved: { color: "#15803d", fillColor: "#22c55e", fillOpacity: 0.2 }
  };

  function escapeHtml(value) {
    return String(value || "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[character]));
  }

  function dateLabel(date) {
    return date ? new Date(`${date}T00:00:00`).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" }) : "Not provided";
  }

  function statusLabel(status) {
    return { pending: "Pending Review", under_review: "Under Review", confirmed: "Confirmed", rejected: "Rejected" }[status] || status;
  }

  function openReport() {
    if (dialog.open) return;
    returnFocus = document.activeElement === document.body ? reportOpen : document.activeElement;
    dialog.showModal();
    document.body.classList.add("health-report-open");
    window.requestAnimationFrame(() => pickerMap?.invalidateSize());
  }

  function showView(target) {
    const showDisease = document.body.dataset.workspaceRoute === "disease-awareness";
    if (!showDisease) {
      if (dialog.open) dialog.close();
      return;
    }
    const activeId = target === "health-guide" || target === "my-reports" ? target : "disease-map-section";
    sections.forEach((section, index) => {
      section.hidden = section.id !== activeId;
      if (!section.hidden) tabs[index].setAttribute("aria-current", "location");
      else tabs[index].removeAttribute("aria-current");
    });
    if (activeId === "disease-map-section") window.requestAnimationFrame(() => map?.invalidateSize());
    if (target === "submit-report") openReport();
  }

  function navigate(target, replace = false) {
    window.PigmentWorkspace.navigate(target, replace);
  }

  function syncDiseaseViewFromHash() {
    const target = window.location.hash.slice(1);
    if (dialog.open && target !== "submit-report") dialog.close();
    showView(target);
    if (!healthLoaded && document.body.dataset.workspaceRoute === "disease-awareness") {
      healthLoaded = true;
      refresh();
      loadMyReports();
    }
  }
  let healthLoaded = false;
  reportOpen.addEventListener("click", (event) => {
    event.preventDefault();
    openReport();
  });
  dialog.querySelectorAll("[data-close-health-report]").forEach((button) => {
    button.addEventListener("click", () => { if (!submitting) dialog.close(); });
  });
  let submitting = false;
  dialog.addEventListener("cancel", (event) => { if (submitting) event.preventDefault(); });
  dialog.addEventListener("close", () => {
    document.body.classList.remove("health-report-open");
    if (window.location.hash === "#submit-report") navigate("disease-map-section", true);
    if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
    returnFocus = null;
  });
  document.addEventListener("pigment:workspace-route", syncDiseaseViewFromHash);
  syncDiseaseViewFromHash();
  if (!map) {
    mapElement.textContent = "The map could not load. Check your connection and reload the page.";
    pickerElement.textContent = "The location map could not load.";
    reportMessage.textContent = "Reload the page to load the map before submitting.";
    submitButton.disabled = true;
  }

  function matchesFilters(item, isZone) {
    return (!municipalityFilter.value || item.municipality === municipalityFilter.value) &&
      (!diseaseFilter.value || item.disease_type === diseaseFilter.value) &&
      (!isZone || !zoneStatusFilter.value || item.zone_status === zoneStatusFilter.value);
  }

  function populateFilters() {
    const selectedMunicipality = municipalityFilter.value;
    const selectedDisease = diseaseFilter.value;
    const municipalities = [...new Set(reports.concat(zones).map((item) => item.municipality).filter(Boolean))].sort();
    const diseases = [...new Set(reports.concat(zones).map((item) => item.disease_type).filter(Boolean))].sort();
    municipalityFilter.innerHTML = '<option value="">All municipalities</option>' + municipalities.map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join("");
    diseaseFilter.innerHTML = '<option value="">All disease types</option>' + diseases.map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join("");
    if (municipalities.includes(selectedMunicipality)) municipalityFilter.value = selectedMunicipality;
    if (diseases.includes(selectedDisease)) diseaseFilter.value = selectedDisease;
  }

  function renderMap() {
    markerLayer?.clearLayers();
    zoneLayer?.clearLayers();
    const visibleZones = zones.filter(window.PigmentDiseaseStore.isZoneVisible).filter((item) => matchesFilters(item, true));
    const visibleReports = reports.filter(window.PigmentDiseaseStore.isPublished).filter((item) => matchesFilters(item, false));
    if (map) visibleZones.forEach((zone) => L.geoJSON({ type: "Feature", properties: zone, geometry: zone.geometry }, { style: zoneStyles[zone.zone_status] || zoneStyles.monitoring, onEachFeature: (feature, layer) => layer.bindPopup(`<strong>${escapeHtml(zone.zone_name)}</strong><br>Municipality: ${escapeHtml(zone.municipality)}<br>Disease: ${escapeHtml(zone.disease_type)}<br>Status: ${escapeHtml(zone.zone_status)}`) }).addTo(zoneLayer));
    if (map) visibleReports.forEach((report) => L.circleMarker([report.latitude, report.longitude], { radius: 8, color: "#a16207", fillColor: "#facc15", fillOpacity: 0.95, weight: 2 }).bindPopup(`<strong>${escapeHtml(report.disease_type)}</strong><br>Location: ${escapeHtml(report.municipality)}, ${escapeHtml(report.barangay)}<br>Incident date: ${escapeHtml(dateLabel(report.incident_date))}<br>Status: Confirmed`).addTo(markerLayer));
    if (!map) return;
    const total = visibleZones.length + visibleReports.length;
    mapCount.textContent = `${visibleZones.length} zone${visibleZones.length === 1 ? "" : "s"} and ${visibleReports.length} incident marker${visibleReports.length === 1 ? "" : "s"} shown`;
    emptyMessage.hidden = total !== 0;
  }

  async function refresh() {
    try {
      [reports, zones] = await Promise.all([window.PigmentDiseaseStore.loadReports(), window.PigmentDiseaseStore.loadZones()]);
      populateFilters();
      renderMap();
    } catch (error) {
      mapCount.textContent = error.message;
      emptyMessage.hidden = true;
    }

  }

  async function loadMyReports() {
    const list = document.querySelector("#my-reports-list");
    if (!list) return;
    try {
      const user = await window.PigmentAuth.getSession();
      if (!user) return;
      const ownReports = await window.PigmentDiseaseStore.loadReports("mine");
      list.replaceChildren(...(ownReports.length ? ownReports.map((report) => {
        const item = document.createElement("article");
        item.className = "report-summary-card";
        item.innerHTML = `<div><strong>Report #${escapeHtml(report.report_id)}</strong><span>${escapeHtml(report.disease_type)}</span></div><div><strong>${escapeHtml(report.municipality)}, ${escapeHtml(report.barangay)}</strong><span>${escapeHtml(dateLabel(report.incident_date))}</span></div><span class="health-report-status" data-status="${escapeHtml(report.report_status)}">${escapeHtml(statusLabel(report.report_status))}</span>`;
        return item;
      }) : [Object.assign(document.createElement("p"), { className: "small-muted", textContent: "You have not submitted any reports." })]));
    } catch (error) {
      list.textContent = error.message;
    }
  }

  function setSelectedLocation(event) {
    const latitude = event.latlng.lat;
    const longitude = event.latlng.lng;
    if (latitude < 13.10 || latitude > 13.65 || longitude < 121.65 || longitude > 122.25) {
      reportMessage.textContent = "Select a point within the Marinduque reporting area.";
      return;
    }
    reportLatitude.value = latitude.toFixed(7);
    reportLongitude.value = longitude.toFixed(7);
    reportLocation.textContent = `Selected general location: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
    reportMessage.textContent = "";
    if (pickerMap) {
      if (pickerLocationMarker) pickerMap.removeLayer(pickerLocationMarker);
      pickerLocationMarker = L.marker([latitude, longitude], { title: "Selected incident location" }).addTo(pickerMap);
    }
  }

  municipalityFilter.addEventListener("change", renderMap);
  diseaseFilter.addEventListener("change", renderMap);
  zoneStatusFilter.addEventListener("change", renderMap);
  document.querySelector("#health-reset-filters").addEventListener("click", () => {
    [municipalityFilter, diseaseFilter, zoneStatusFilter].forEach((filter) => { filter.value = ""; });
    renderMap();
  });
  pickerMap?.on("click", setSelectedLocation);
  const incidentDateInput = reportForm?.elements.namedItem("incidentDate");
  if (incidentDateInput) {
    const now = new Date();
    const localToday = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    incidentDateInput.max = localToday;
  }

  if (reportForm) {
    reportForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!pickerMap || submitting || !reportForm.reportValidity()) return;
      if (!reportLatitude?.value || !reportLongitude?.value) {
        reportMessage.textContent = "Please select the incident location using the map in this form.";
        pickerElement?.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
      const incidentDate = reportForm.elements.namedItem("incidentDate");
      if (incidentDate?.value && incidentDate.max && incidentDate.value > incidentDate.max) {
        reportMessage.textContent = "The incident date cannot be in the future.";
        return;
      }
      submitting = true;
      submitButton.disabled = true;
      reportMessage.textContent = "Submitting report...";
      try {
        const values = Object.fromEntries(new FormData(reportForm).entries());
        await window.PigmentDiseaseStore.createReport({
          disease_type: values.diseaseType,
          municipality: values.municipality,
          barangay: values.barangay,
          incident_date: values.incidentDate,
          description: values.description,
          latitude: values.latitude,
          longitude: values.longitude
        });
        reportForm.reset();
        reportLocation.textContent = "No location selected. A map point is required.";
        reportMessage.textContent = "";
        success.textContent = "Report sent for review. You can track its status here.";
        success.hidden = false;
        dialog.close();
        navigate("my-reports", window.location.hash === "#submit-report");
        await loadMyReports();
        document.dispatchEvent(new Event("pigment:farm-activity-updated"));
        if (pickerLocationMarker && pickerMap) {
          pickerMap.removeLayer(pickerLocationMarker);
          pickerLocationMarker = null;
        }
      } catch (error) {
        reportMessage.textContent = error.message;
      } finally {
        submitting = false;
        submitButton.disabled = false;
      }
    });
  }
}());
