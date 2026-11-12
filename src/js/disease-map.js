(function () {
  "use strict";

  const mapElement = document.querySelector("#disease-map");
  if (!mapElement || !window.PigmentDiseaseStore) return;
  if (!window.L) {
    const message = document.querySelector("#report-form-message");
    const submit = document.querySelector('#disease-report-form button[type="submit"]');
    if (message) message.textContent = "The location map could not load. Check your internet connection and reload the page to report an illness.";
    if (submit) submit.disabled = true;
    return;
  }

  const dashboardView = document.querySelector("#dashboard-view");
  const diseaseView = document.querySelector("#disease-awareness");
  const healthNavLink = document.querySelector("#pig-health-nav-link");
  const homeNavLink = document.querySelector("#home-nav-link");
  const workspaceLabel = document.querySelector("#workspace-label");
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
  const map = L.map(mapElement).setView([13.43, 121.96], 10);
  const pickerElement = document.querySelector("#report-location-map");
  const pickerMap = pickerElement ? L.map(pickerElement).setView([13.43, 121.96], 10) : null;
  if (pickerMap) L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: "&copy; OpenStreetMap contributors" }).addTo(pickerMap);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: "&copy; OpenStreetMap contributors" }).addTo(map);
  const markerLayer = L.layerGroup().addTo(map);
  const zoneLayer = L.layerGroup().addTo(map);
  let reports = [];
  let zones = [];
  let selectedLocationMarker = null;
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

  function showView(view) {
    const showDisease = view === "disease";
    if (dashboardView) dashboardView.hidden = showDisease;
    if (diseaseView) diseaseView.hidden = !showDisease;
    healthNavLink?.classList.toggle("active", showDisease);
    homeNavLink?.classList.toggle("active", !showDisease);
    if (workspaceLabel) workspaceLabel.textContent = showDisease ? "Pig Health" : "Farm workspace";
    if (showDisease) window.setTimeout(() => {
      map.invalidateSize();
      pickerMap?.invalidateSize();
    }, 0);
  }

  function shouldShowDiseaseView(hash) {
    const target = (hash || window.location.hash || "").replace(/^#/, "");
    return ["disease-awareness", "health-guide", "disease-map-section", "submit-report", "my-reports"].includes(target);
  }

  function syncDiseaseViewFromHash() {
    showView(shouldShowDiseaseView(window.location.hash) ? "disease" : "dashboard");
  }

  healthNavLink?.addEventListener("click", (event) => {
    event.preventDefault();
    window.history.replaceState(null, "", "#disease-awareness");
    showView("disease");
  });
  homeNavLink?.addEventListener("click", (event) => {
    event.preventDefault();
    window.history.replaceState(null, "", "#dashboard");
    showView("dashboard");
  });
  window.addEventListener("hashchange", syncDiseaseViewFromHash);
  syncDiseaseViewFromHash();

  function matchesFilters(item, isZone) {
    return (!municipalityFilter.value || item.municipality === municipalityFilter.value) &&
      (!diseaseFilter.value || item.disease_type === diseaseFilter.value) &&
      (!isZone || !zoneStatusFilter.value || item.zone_status === zoneStatusFilter.value);
  }

  function populateFilters() {
    const municipalities = [...new Set(reports.concat(zones).map((item) => item.municipality).filter(Boolean))].sort();
    const diseases = [...new Set(reports.concat(zones).map((item) => item.disease_type).filter(Boolean))].sort();
    municipalityFilter.innerHTML = '<option value="">All municipalities</option>' + municipalities.map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join("");
    diseaseFilter.innerHTML = '<option value="">All disease types</option>' + diseases.map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join("");
  }

  function renderMap() {
    markerLayer.clearLayers();
    zoneLayer.clearLayers();
    const visibleZones = zones.filter(window.PigmentDiseaseStore.isZoneVisible).filter((item) => matchesFilters(item, true));
    const visibleReports = reports.filter(window.PigmentDiseaseStore.isPublished).filter((item) => matchesFilters(item, false));
    visibleZones.forEach((zone) => L.geoJSON({ type: "Feature", properties: zone, geometry: zone.geometry }, { style: zoneStyles[zone.zone_status] || zoneStyles.monitoring, onEachFeature: (feature, layer) => layer.bindPopup(`<strong>${escapeHtml(zone.zone_name)}</strong><br>Municipality: ${escapeHtml(zone.municipality)}<br>Disease: ${escapeHtml(zone.disease_type)}<br>Status: ${escapeHtml(zone.zone_status)}`) }).addTo(zoneLayer));
    visibleReports.forEach((report) => L.circleMarker([report.latitude, report.longitude], { radius: 8, color: "#b42318", fillColor: "#dc2626", fillOpacity: 0.95, weight: 2 }).bindPopup(`<strong>${escapeHtml(report.disease_type)}</strong><br>Location: ${escapeHtml(report.municipality)}, ${escapeHtml(report.barangay)}<br>Incident date: ${escapeHtml(dateLabel(report.incident_date))}<br>Status: Confirmed`).addTo(markerLayer));
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
      emptyMessage.hidden = false;
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
        item.innerHTML = `<strong>Report #${report.report_id}</strong><span>${escapeHtml(report.disease_type)} · ${escapeHtml(report.municipality)}, ${escapeHtml(report.barangay)}</span><span>${escapeHtml(statusLabel(report.report_status))} · ${escapeHtml(dateLabel(report.incident_date))}</span>`;
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
    if (selectedLocationMarker) map.removeLayer(selectedLocationMarker);
    selectedLocationMarker = L.marker([latitude, longitude], { title: "Selected report location" }).addTo(map);
    if (pickerMap) {
      if (pickerLocationMarker) pickerMap.removeLayer(pickerLocationMarker);
      pickerLocationMarker = L.marker([latitude, longitude], { title: "Selected incident location" }).addTo(pickerMap);
    }
  }

  municipalityFilter.addEventListener("change", renderMap);
  diseaseFilter.addEventListener("change", renderMap);
  zoneStatusFilter.addEventListener("change", renderMap);
  map.on("click", setSelectedLocation);
  pickerMap?.on("click", setSelectedLocation);
  refresh();
  loadMyReports();
  const incidentDateInput = reportForm?.elements.namedItem("incidentDate");
  if (incidentDateInput) {
    const now = new Date();
    const localToday = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    incidentDateInput.max = localToday;
  }

  if (reportForm) {
    reportForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!reportForm.reportValidity()) return;
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
      const submit = reportForm.querySelector("button[type=submit]");
      submit.disabled = true;
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
        reportMessage.textContent = "Report sent successfully. It is now pending administrator review and will appear in My Reports.";
        await loadMyReports().catch(() => {});
        document.dispatchEvent(new Event("pigment:farm-activity-updated"));
        if (selectedLocationMarker) {
          map.removeLayer(selectedLocationMarker);
          selectedLocationMarker = null;
        }
        if (pickerLocationMarker && pickerMap) {
          pickerMap.removeLayer(pickerLocationMarker);
          pickerLocationMarker = null;
        }
      } catch (error) {
        reportMessage.textContent = error.message;
      } finally {
        submit.disabled = false;
      }
    });
  }
}());
