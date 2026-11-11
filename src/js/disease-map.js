(function () {
  "use strict";

  const mapElement = document.querySelector("#disease-map");
  if (!mapElement || !window.PigmentDiseaseStore || !window.L) return;

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
  const map = L.map(mapElement).setView([13.43, 121.96], 10);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(map);
  const markerLayer = L.layerGroup().addTo(map);
  const zoneLayer = L.layerGroup().addTo(map);
  let reports = [];
  let zones = [];

  const zoneStyles = {
    confirmed: { color: "#b42318", fillColor: "#dc2626", fillOpacity: 0.34 },
    monitoring: { color: "#c2410c", fillColor: "#f97316", fillOpacity: 0.28 },
    resolved: { color: "#15803d", fillColor: "#22c55e", fillOpacity: 0.2 }
  };

  function escapeHtml(value) {
    return String(value || "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    }[character]));
  }

  function dateLabel(date) {
    if (!date) return "Not provided";
    return new Date(`${date}T00:00:00`).toLocaleDateString("en-PH", {
      year: "numeric", month: "short", day: "numeric"
    });
  }

  function statusLabel(status) {
    return { confirmed: "Officially confirmed", monitoring: "Under monitoring", resolved: "Resolved" }[status] || status;
  }

  function showView(view) {
    const showDisease = view === "disease";
    if (dashboardView) dashboardView.hidden = showDisease;
    if (diseaseView) diseaseView.hidden = !showDisease;
    if (healthNavLink) {
      healthNavLink.classList.toggle("active", showDisease);
      healthNavLink.setAttribute("aria-current", showDisease ? "page" : "false");
    }
    if (homeNavLink) {
      homeNavLink.classList.toggle("active", !showDisease);
      homeNavLink.setAttribute("aria-current", showDisease ? "false" : "page");
    }
    if (workspaceLabel) workspaceLabel.textContent = showDisease ? "Pig Health" : "Farm workspace";
    if (showDisease) window.setTimeout(() => map.invalidateSize(), 0);
  }

  if (healthNavLink && dashboardView && diseaseView) {
    healthNavLink.addEventListener("click", (event) => {
      event.preventDefault();
      window.history.replaceState(null, "", "#disease-awareness");
      showView("disease");
    });
    homeNavLink.addEventListener("click", (event) => {
      event.preventDefault();
      window.history.replaceState(null, "", "#dashboard");
      showView("dashboard");
    });
    if (window.location.hash === "#disease-awareness") showView("disease");
  }

  function matchesFilters(item, isZone) {
    return (!municipalityFilter.value || item.municipality === municipalityFilter.value) &&
      (!diseaseFilter.value || item.diseaseType === diseaseFilter.value) &&
      (!isZone || !zoneStatusFilter.value || item.status === zoneStatusFilter.value);
  }

  function populateFilters() {
    const municipalities = [...new Set(reports.concat(zones).map((item) => item.municipality))].sort();
    const diseases = [...new Set(reports.concat(zones).map((item) => item.diseaseType))].sort();
    municipalityFilter.innerHTML = '<option value="">All municipalities</option>' +
      municipalities.map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join("");
    diseaseFilter.innerHTML = '<option value="">All disease types</option>' +
      diseases.map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join("");
  }

  function zonePopup(zone) {
    return `<strong>${escapeHtml(zone.name)}</strong><br>
      Municipality: ${escapeHtml(zone.municipality)}<br>
      Affected location: ${escapeHtml(zone.barangay)}<br>
      Disease: ${escapeHtml(zone.diseaseType)}<br>
      Severity: ${escapeHtml(zone.severity)}<br>
      Date reported: ${escapeHtml(dateLabel(zone.dateReported))}<br>
      Status: ${escapeHtml(statusLabel(zone.status))}<br>
      ${zone.confirmationDetails ? `Confirmation: ${escapeHtml(zone.confirmationDetails)}<br>` : ""}
      <small>FICTIONAL DEMONSTRATION DATA</small>`;
  }

  function renderMap() {
    markerLayer.clearLayers();
    zoneLayer.clearLayers();
    const visibleZones = zones.filter((zone) => window.PigmentDiseaseStore.isZoneVisible(zone))
      .filter((zone) => matchesFilters(zone, true));
    const visibleReports = reports.filter((report) => window.PigmentDiseaseStore.isPublished(report))
      .filter((report) => matchesFilters(report, false));

    visibleZones.forEach((zone) => {
      const style = zoneStyles[zone.status] || zoneStyles.monitoring;
      L.geoJSON({ type: "Feature", properties: zone, geometry: zone.geometry }, {
        style,
        onEachFeature: (feature, layer) => layer.bindPopup(zonePopup(feature.properties))
      }).addTo(zoneLayer);
    });
    visibleReports.forEach((report) => {
      const isSuspected = report.confirmationStatus !== "confirmed";
      const marker = L.circleMarker([report.latitude, report.longitude], {
        radius: 8,
        color: isSuspected ? "#a16207" : "#b42318",
        fillColor: isSuspected ? "#facc15" : "#dc2626",
        fillOpacity: 0.95,
        weight: 2
      });
      marker.bindPopup(`<strong>${escapeHtml(report.diseaseType)}</strong><br>
        Location: ${escapeHtml(report.municipality)}, ${escapeHtml(report.barangay)}<br>
        Incident date: ${escapeHtml(dateLabel(report.incidentDate))}<br>
        Publication: Published fictional report<br><small>FICTIONAL DEMONSTRATION DATA</small>`);
      marker.addTo(markerLayer);
    });

    const total = visibleZones.length + visibleReports.length;
    mapCount.textContent = `${visibleZones.length} zone${visibleZones.length === 1 ? "" : "s"} and ${visibleReports.length} incident marker${visibleReports.length === 1 ? "" : "s"} shown`;
    emptyMessage.hidden = total !== 0;
  }

  function refresh() {
    reports = window.PigmentDiseaseStore.loadReports();
    zones = window.PigmentDiseaseStore.loadZones();
    populateFilters();
    renderMap();
  }

  municipalityFilter.addEventListener("change", renderMap);
  diseaseFilter.addEventListener("change", renderMap);
  zoneStatusFilter.addEventListener("change", renderMap);
  window.addEventListener("pigment:disease-data-updated", refresh);
  window.addEventListener("storage", (event) => {
    if (event.key === window.PigmentDiseaseStore.storageKey || event.key === window.PigmentDiseaseStore.zonesKey) refresh();
  });
  refresh();

  if (reportForm) {
    reportForm.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!reportForm.reportValidity()) return;
      const formData = new FormData(reportForm);
      const updatedReports = window.PigmentDiseaseStore.loadReports();
      updatedReports.push({
        id: `report-${Date.now()}`,
        diseaseType: formData.get("diseaseType"),
        municipality: formData.get("municipality"),
        barangay: formData.get("barangay"),
        incidentDate: formData.get("incidentDate"),
        submittedDate: new Date().toISOString().slice(0, 10),
        publicationStatus: "submitted",
        confirmationStatus: "pending",
        confirmationDetails: "",
        description: formData.get("description"),
        reporter: "Fictional farmer submission",
        latitude: 13.43,
        longitude: 121.96
      });
      window.PigmentDiseaseStore.saveReports(updatedReports);
      reportForm.reset();
      reportMessage.textContent = "Demonstration report submitted for admin review.";
    });
  }
}());
