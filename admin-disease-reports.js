(function () {
  "use strict";

  const list = document.querySelector("#report-list");
  if (!list || !window.PigmentDiseaseStore) return;

  const detailTitle = document.querySelector("#detail-title");
  const detailEmpty = document.querySelector("#detail-empty");
  const detailContent = document.querySelector("#detail-content");
  const confirmationStatus = document.querySelector("#detail-confirmation-status");
  const confirmationDetails = document.querySelector("#detail-confirmation-details");
  const adminCount = document.querySelector("#admin-count");
  const message = document.querySelector("#admin-message");
  const zoneMapElement = document.querySelector("#admin-zone-map");
  const zoneForm = document.querySelector("#zone-form");
  const zoneList = document.querySelector("#zone-list");
  const zoneMessage = document.querySelector("#zone-message");
  const cancelZone = document.querySelector("#cancel-zone");
  let reports = [];
  let zones = [];
  let selectedId = "";
  let editingZoneId = "";
  let draftLayer = null;
  let zoneLayers = new Map();
  let zoneMap = null;

  function dateLabel(date) {
    if (!date) return "Not provided";
    return new Date(`${date}T00:00:00`).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
  }

  function statusLabel(status) {
    return { under_review: "under review", published: "published", unpublished: "unpublished" }[status] || status.replace("_", " ");
  }

  function escapeHtml(value) {
    return String(value || "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    }[character]));
  }

  function renderList() {
    list.innerHTML = reports.map((report) => `<tr class="${report.id === selectedId ? "is-selected" : ""}">
      <td><button class="table-link" type="button" data-select="${escapeHtml(report.id)}">${escapeHtml(report.diseaseType)}</button><small class="fictional-label">Fictional record · ${escapeHtml(report.id)}</small></td>
      <td>${escapeHtml(report.municipality)}, ${escapeHtml(report.barangay)}</td>
      <td>${dateLabel(report.incidentDate)}</td>
      <td><span class="status-label status-label-${report.publicationStatus === "published" ? "success" : report.publicationStatus === "rejected" ? "neutral" : "warning"}">${escapeHtml(statusLabel(report.publicationStatus))}</span></td>
      <td><button class="button button-secondary button-small" type="button" data-select="${escapeHtml(report.id)}">Inspect</button></td>
    </tr>`).join("");
    adminCount.textContent = `${reports.length} fictional report${reports.length === 1 ? "" : "s"} in shared browser storage`;
  }

  function renderDetail() {
    const report = reports.find((item) => item.id === selectedId);
    if (!report) {
      detailTitle.textContent = "Select a report";
      detailEmpty.hidden = false;
      detailContent.hidden = true;
      return;
    }
    detailTitle.textContent = report.diseaseType;
    detailEmpty.hidden = true;
    detailContent.hidden = false;
    document.querySelector("#detail-location").textContent = `${report.municipality}, ${report.barangay}`;
    document.querySelector("#detail-date").textContent = dateLabel(report.incidentDate);
    document.querySelector("#detail-reporter").textContent = report.reporter;
    document.querySelector("#detail-description").textContent = report.description;
    confirmationStatus.value = report.confirmationStatus;
    confirmationDetails.value = report.confirmationDetails || "";
  }

  function geometryFromLayer(layer) {
    const editableLayer = layer.getLatLngs ? layer : layer.getLayers()[0];
    const coordinates = editableLayer.getLatLngs()[0].map((point) => [point.lng, point.lat]);
    if (coordinates.length && (coordinates[0][0] !== coordinates[coordinates.length - 1][0] ||
      coordinates[0][1] !== coordinates[coordinates.length - 1][1])) {
      coordinates.push(coordinates[0]);
    }
    return { type: "Polygon", coordinates: [coordinates] };
  }

  function layerFromZone(zone) {
    return L.geoJSON({ type: "Feature", properties: zone, geometry: zone.geometry }, {
      style: zone.status === "confirmed" ? { color: "#b42318", fillColor: "#dc2626", fillOpacity: 0.3 } :
        zone.status === "resolved" ? { color: "#15803d", fillColor: "#22c55e", fillOpacity: 0.2 } :
          { color: "#c2410c", fillColor: "#f97316", fillOpacity: 0.25 }
    }).addTo(zoneMap);
  }

  function renderAdminZones() {
    zoneLayers.forEach((layer) => zoneMap.removeLayer(layer));
    zoneLayers = new Map();
    zones.forEach((zone) => {
      const layer = layerFromZone(zone);
      zoneLayers.set(zone.id, layer);
      layer.on("click", () => loadZoneIntoForm(zone.id));
    });
    zoneList.innerHTML = zones.map((zone) => `<tr>
      <td><strong>${escapeHtml(zone.name)}</strong><small class="fictional-label">${escapeHtml(zone.id)}</small></td>
      <td>${escapeHtml(zone.municipality)}, ${escapeHtml(zone.barangay)}</td>
      <td>${escapeHtml(zone.diseaseType)}</td>
      <td>${escapeHtml(zone.severity)}</td>
      <td><span class="status-label status-label-${zone.publicationStatus === "published" ? "success" : "warning"}">${escapeHtml(zone.publicationStatus)}</span></td>
      <td class="zone-actions"><button class="button button-secondary button-small" type="button" data-zone-edit="${escapeHtml(zone.id)}">Edit</button>
      ${zone.publicationStatus !== "published" ? `<button class="button button-primary button-small" type="button" data-zone-publish="${escapeHtml(zone.id)}">Publish</button>` : ""}
      ${zone.status !== "resolved" ? `<button class="button button-secondary button-small" type="button" data-zone-resolve="${escapeHtml(zone.id)}">Resolve</button>` : ""}
      <button class="button button-danger button-small" type="button" data-zone-delete="${escapeHtml(zone.id)}">Delete</button></td>
    </tr>`).join("");
  }

  function populateIncidentOptions(selected) {
    const select = zoneForm.elements.incidentReportId;
    select.innerHTML = '<option value="">None</option>' + reports.map((report) =>
      `<option value="${escapeHtml(report.id)}">${escapeHtml(report.id)} · ${escapeHtml(report.municipality)}</option>`).join("");
    select.value = selected || "";
  }

  function loadZoneIntoForm(id) {
    const zone = zones.find((item) => item.id === id);
    if (!zone) return;
    editingZoneId = id;
    zoneForm.hidden = false;
    Object.keys(zone).forEach((key) => {
      if (zoneForm.elements[key] && key !== "geometry") zoneForm.elements[key].value = zone[key] || "";
    });
    zoneForm.elements.geometry.value = JSON.stringify(zone.geometry);
    populateIncidentOptions(zone.incidentReportId);
    const layer = zoneLayers.get(id);
    const editableLayer = layer && layer.getLayers ? layer.getLayers()[0] : layer;
    if (editableLayer && editableLayer.pm) editableLayer.pm.enable();
    zoneMessage.textContent = "Edit the boundary directly or update the zone details, then save.";
  }

  function resetZoneForm() {
    editingZoneId = "";
    zoneForm.reset();
    zoneForm.hidden = true;
    zoneForm.elements.zoneId.value = "";
    zoneForm.elements.geometry.value = "";
    zoneMessage.textContent = "";
    if (draftLayer) {
      zoneMap.removeLayer(draftLayer);
      draftLayer = null;
    }
    zoneLayers.forEach((layer) => {
      if (layer.pm) layer.pm.disable();
    });
  }

  function refresh() {
    reports = window.PigmentDiseaseStore.loadReports();
    zones = window.PigmentDiseaseStore.loadZones();
    if (selectedId && !reports.some((report) => report.id === selectedId)) selectedId = "";
    renderList();
    renderDetail();
    if (zoneMap) {
      renderAdminZones();
      populateIncidentOptions(zoneForm.elements.incidentReportId.value);
    }
  }

  list.addEventListener("click", (event) => {
    const target = event.target.closest("[data-select]");
    if (!target) return;
    selectedId = target.dataset.select;
    message.textContent = "";
    refresh();
  });

  document.querySelector(".admin-actions").addEventListener("click", (event) => {
    const actionTarget = event.target.closest("[data-action]");
    const action = actionTarget ? actionTarget.dataset.action : "";
    const report = reports.find((item) => item.id === selectedId);
    if (!action || !report) return;
    report.confirmationStatus = confirmationStatus.value;
    report.confirmationDetails = confirmationDetails.value.trim();
    if (action === "approved" && !window.PigmentDiseaseStore.isPublishable(report)) {
      message.textContent = "Cannot publish: official confirmation status and authorized confirmation details are required.";
      return;
    }
    report.publicationStatus = action === "approved" ? "published" : action;
    window.PigmentDiseaseStore.saveReports(reports);
    message.textContent = action === "approved" ? "Approved. This confirmed incident is now visible on the farmer map." : `Report marked ${statusLabel(action)}.`;
    refresh();
  });

  zoneForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!zoneForm.reportValidity()) return;
    const formData = new FormData(zoneForm);
    const existing = zones.find((zone) => zone.id === editingZoneId);
    const geometry = editingZoneId && zoneLayers.get(editingZoneId) ? geometryFromLayer(zoneLayers.get(editingZoneId)) :
      JSON.parse(formData.get("geometry") || "null");
    if (!geometry || !geometry.coordinates[0] || geometry.coordinates[0].length < 4) {
      zoneMessage.textContent = "Draw a closed polygon boundary before saving.";
      return;
    }
    const status = formData.get("status");
    const confirmationDetailsValue = String(formData.get("confirmationDetails") || "").trim();
    if (status === "confirmed" && !confirmationDetailsValue) {
      zoneMessage.textContent = "Confirmed zones require official confirmation details.";
      return;
    }
    const zone = {
      id: editingZoneId || `zone-${Date.now()}`,
      name: formData.get("name"),
      municipality: formData.get("municipality"),
      barangay: formData.get("barangay"),
      diseaseType: formData.get("diseaseType"),
      severity: formData.get("severity"),
      status,
      publicationStatus: existing ? existing.publicationStatus : "unpublished",
      dateReported: formData.get("dateReported"),
      description: formData.get("description"),
      confirmationDetails: confirmationDetailsValue,
      incidentReportId: formData.get("incidentReportId"),
      fictional: true,
      geometry
    };
    zones = existing ? zones.map((item) => item.id === zone.id ? zone : item) : zones.concat(zone);
    window.PigmentDiseaseStore.saveZones(zones);
    zoneMessage.textContent = "Zone saved as unpublished demonstration data.";
    resetZoneForm();
    refresh();
  });

  zoneList.addEventListener("click", (event) => {
    const target = event.target.closest("button");
    if (!target) return;
    const id = target.dataset.zoneEdit || target.dataset.zonePublish || target.dataset.zoneResolve || target.dataset.zoneDelete;
    const zone = zones.find((item) => item.id === id);
    if (!zone) return;
    if (target.dataset.zoneEdit) {
      loadZoneIntoForm(id);
    } else if (target.dataset.zonePublish) {
      if (!window.confirm("Publish this zone on the farmer-facing map?")) return;
      if (zone.status === "confirmed" && !zone.confirmationDetails.trim()) {
        zoneMessage.textContent = "Confirmed zones require official confirmation details before publishing.";
        return;
      }
      zone.publicationStatus = "published";
      window.PigmentDiseaseStore.saveZones(zones);
      refresh();
    } else if (target.dataset.zoneResolve) {
      zone.status = "resolved";
      zone.publicationStatus = "published";
      window.PigmentDiseaseStore.saveZones(zones);
      refresh();
    } else if (target.dataset.zoneDelete) {
      if (!window.confirm("Delete this zone permanently from the demonstration data?")) return;
      zones = zones.filter((item) => item.id !== id);
      window.PigmentDiseaseStore.saveZones(zones);
      refresh();
    }
  });

  cancelZone.addEventListener("click", resetZoneForm);
  window.addEventListener("pigment:disease-data-updated", refresh);
  window.addEventListener("storage", (event) => {
    if (event.key === window.PigmentDiseaseStore.storageKey || event.key === window.PigmentDiseaseStore.zonesKey) refresh();
  });

  if (zoneMapElement && window.L) {
    zoneMap = L.map(zoneMapElement).setView([13.43, 121.96], 10);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: "&copy; OpenStreetMap contributors"
    }).addTo(zoneMap);
    if (zoneMap.pm) {
      zoneMap.pm.addControls({ position: "topleft", drawText: false, drawCircle: false, drawCircleMarker: false, drawMarker: false, drawPolyline: false, drawRectangle: false });
      zoneMap.on("pm:create", (event) => {
        if (draftLayer) zoneMap.removeLayer(draftLayer);
        draftLayer = event.layer;
        zoneForm.hidden = false;
        zoneForm.reset();
        zoneForm.elements.geometry.value = JSON.stringify(geometryFromLayer(draftLayer));
        populateIncidentOptions("");
        zoneMessage.textContent = "Boundary drawn. Complete the form to save it as unpublished.";
        draftLayer.pm.enable();
      });
    } else {
      zoneMessage.textContent = "Drawing controls could not load. Check the Leaflet-Geoman connection.";
    }
    refresh();
  }
}());
