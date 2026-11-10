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
  const mapCount = document.querySelector("#map-count");
  const reportForm = document.querySelector("#disease-report-form");
  const reportMessage = document.querySelector("#report-form-message");
  const map = L.map(mapElement).setView([13.43, 121.96], 10);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: "&copy; OpenStreetMap contributors" }).addTo(map);
  const markerLayer = L.layerGroup().addTo(map);
  let reports = [];

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
      showView("disease");
    });
    homeNavLink.addEventListener("click", (event) => {
      event.preventDefault();
      showView("dashboard");
    });
    if (window.location.hash === "#disease-awareness") showView("disease");
  }

  function dateLabel(date) {
    return new Date(`${date}T00:00:00`).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
  }

  function populateFilters() {
    const municipalities = [...new Set(reports.map((report) => report.municipality))].sort();
    const diseases = [...new Set(reports.map((report) => report.diseaseType))].sort();
    municipalityFilter.innerHTML = '<option value="">All municipalities</option>' + municipalities.map((item) => `<option>${item}</option>`).join("");
    diseaseFilter.innerHTML = '<option value="">All disease types</option>' + diseases.map((item) => `<option>${item}</option>`).join("");
  }

  function renderMarkers() {
    markerLayer.clearLayers();
    const visible = reports.filter((report) => window.PigmentDiseaseStore.isPublished(report))
      .filter((report) => !municipalityFilter.value || report.municipality === municipalityFilter.value)
      .filter((report) => !diseaseFilter.value || report.diseaseType === diseaseFilter.value);
    visible.forEach((report) => {
      L.marker([report.latitude, report.longitude]).bindPopup(`<strong>${report.diseaseType}</strong><br>Location: ${report.municipality}, ${report.barangay}<br>Incident date: ${dateLabel(report.incidentDate)}<br>Publication: Officially confirmed and published<br><small>Fictional demonstration record</small>`).addTo(markerLayer);
    });
    mapCount.textContent = `${visible.length} published fictional incident${visible.length === 1 ? "" : "s"} shown`;
  }

  function refresh() {
    reports = window.PigmentDiseaseStore.loadReports();
    populateFilters();
    renderMarkers();
  }

  municipalityFilter.addEventListener("change", renderMarkers);
  diseaseFilter.addEventListener("change", renderMarkers);
  window.addEventListener("pigment:disease-reports-updated", refresh);
  refresh();

  reportForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(reportForm);
    const report = {
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
    };
    const updatedReports = window.PigmentDiseaseStore.loadReports();
    updatedReports.push(report);
    window.PigmentDiseaseStore.saveReports(updatedReports);
    reportForm.reset();
    reportMessage.textContent = "Demonstration report submitted for admin review.";
  });
}());
