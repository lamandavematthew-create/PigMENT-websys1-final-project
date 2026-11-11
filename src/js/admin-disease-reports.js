(function () {
  "use strict";
  const list = document.querySelector("#report-list");
  if (!list || !window.PigmentDiseaseStore) return;
  const detailContent = document.querySelector("#detail-content");
  const detailEmpty = document.querySelector("#detail-empty");
  const detailTitle = document.querySelector("#detail-title");
  const confirmationStatus = document.querySelector("#detail-confirmation-status");
  const confirmationDetails = document.querySelector("#detail-confirmation-details");
  const message = document.querySelector("#admin-message");
  const adminCount = document.querySelector("#admin-count");
  const zoneForm = document.querySelector("#zone-form");
  const zoneList = document.querySelector("#zone-list");
  const zoneMessage = document.querySelector("#zone-message");
  const zoneMapElement = document.querySelector("#admin-zone-map");
  let reports = [];
  let zones = [];
  let selectedId = null;
  let zoneMap;
  let draftLayer;

  function dateLabel(value) {
    return value ? new Date(`${value}T00:00:00`).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" }) : "Not provided";
  }
  function statusLabel(value) {
    return { pending: "Pending Review", under_review: "Under Review", confirmed: "Confirmed", rejected: "Rejected" }[value] || value;
  }
  function geometryFromLayer(layer) {
    const editable = layer.getLatLngs ? layer : layer.getLayers()[0];
    const coordinates = editable.getLatLngs()[0].map((point) => [point.lng, point.lat]);
    if (coordinates.length && (coordinates[0][0] !== coordinates[coordinates.length - 1][0] || coordinates[0][1] !== coordinates[coordinates.length - 1][1])) coordinates.push(coordinates[0]);
    return { type: "Polygon", coordinates: [coordinates] };
  }

  function renderReports() {
    list.replaceChildren(...reports.map((report) => {
      const row = document.createElement("tr");
      row.innerHTML = `<td><button class="table-link" type="button" data-report-id="${report.report_id}">Report #${report.report_id}</button></td><td>${report.municipality}, ${report.barangay}</td><td>${dateLabel(report.incident_date)}</td><td><span class="status-label">${statusLabel(report.report_status)}</span></td><td><button class="button button-secondary button-small" type="button" data-report-id="${report.report_id}">Inspect</button></td>`;
      return row;
    }));
    adminCount.textContent = `${reports.length} submitted report${reports.length === 1 ? "" : "s"}`;
  }

  function showReport(id) {
    const report = reports.find((item) => item.report_id === id);
    if (!report) return;
    selectedId = id;
    detailTitle.textContent = `Report #${id} · ${report.disease_type}`;
    detailEmpty.hidden = true;
    detailContent.hidden = false;
    document.querySelector("#detail-location").textContent = `${report.municipality}, ${report.barangay}`;
    document.querySelector("#detail-date").textContent = dateLabel(report.incident_date);
    document.querySelector("#detail-reporter").textContent = report.reporter_name || "Farmer";
    document.querySelector("#detail-description").textContent = report.description;
    confirmationStatus.value = report.report_status === "confirmed" ? "confirmed" : "pending";
    confirmationDetails.value = "";
  }

  async function refresh() {
    try {
      [reports, zones] = await Promise.all([window.PigmentDiseaseStore.loadReports("admin"), window.PigmentDiseaseStore.loadZones("admin")]);
      renderReports();
      renderZones();
    } catch (error) {
      message.textContent = error.message;
    }
  }

  list.addEventListener("click", (event) => {
    const target = event.target.closest("[data-report-id]");
    if (target) showReport(Number(target.dataset.reportId));
  });

  document.querySelector(".admin-actions").addEventListener("click", async (event) => {
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (!action || !selectedId) return;
    const report = reports.find((item) => item.report_id === selectedId);
    if (!report) return;
    const isConfirmed = confirmationStatus.value === "confirmed";
    const confirmation = isConfirmed ? {
      confirmed_by_name: prompt("Confirming personnel or office:") || "",
      designation: prompt("Professional designation:") || "",
      organization: prompt("Confirming organization:") || "",
      confirmation_date: new Date().toISOString().slice(0, 10),
      confirmation_notes: confirmationDetails.value.trim()
    } : null;
    const status = action === "approved" ? "confirmed" : action === "under_review" ? "under_review" : "rejected";
    try {
      await window.PigmentDiseaseStore.updateReport(selectedId, {
        report_status: status,
        admin_remarks: confirmationDetails.value.trim(),
        confirmation,
        is_published: action === "approved"
      });
      message.textContent = action === "approved" ? "Report confirmed and published." : `Report marked ${statusLabel(status)}.`;
      await refresh();
      showReport(selectedId);
    } catch (error) {
      message.textContent = error.message;
    }
  });

  function renderZones() {
    zoneList.replaceChildren(...zones.map((zone) => {
      const row = document.createElement("tr");
      const edit = document.createElement("button");
      edit.className = "button button-secondary button-small";
      edit.type = "button";
      edit.textContent = "Edit";
      edit.addEventListener("click", () => loadZone(zone));
      const cell = document.createElement("td");
      cell.append(edit);
      if (!zone.is_published) {
        const publish = document.createElement("button");
        publish.className = "button button-primary button-small";
        publish.type = "button";
        publish.textContent = "Publish";
        publish.addEventListener("click", () => updateZone(zone, true));
        cell.append(publish);
      }
      row.innerHTML = `<td><strong>${zone.zone_name}</strong></td><td>${zone.municipality}, ${zone.barangay || ""}</td><td>${zone.disease_type}</td><td>${zone.severity}</td><td>${zone.is_published ? "Published" : "Unpublished"}</td>`;
      row.append(cell);
      return row;
    }));
  }

  function loadZone(zone) {
    zoneForm.hidden = false;
    zoneForm.elements.zoneId.value = zone.zone_id;
    zoneForm.elements.name.value = zone.zone_name;
    zoneForm.elements.municipality.value = zone.municipality;
    zoneForm.elements.barangay.value = zone.barangay || "";
    zoneForm.elements.diseaseType.value = zone.disease_type;
    zoneForm.elements.severity.value = zone.severity;
    zoneForm.elements.status.value = zone.zone_status === "suspected" ? "monitoring" : zone.zone_status;
    zoneForm.elements.description.value = zone.description || "";
    zoneForm.elements.geometry.value = JSON.stringify(zone.geometry);
    zoneForm.dataset.published = zone.is_published ? "true" : "false";
    zoneMessage.textContent = "Update the zone details or draw a new boundary before saving.";
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
      await refresh();
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
        is_published: zoneForm.dataset.published === "true"
      });
      zoneForm.hidden = true;
      zoneMessage.textContent = "Zone saved.";
      await refresh();
    } catch (error) {
      zoneMessage.textContent = error.message;
    }
  });

  document.querySelector("#cancel-zone").addEventListener("click", () => {
    zoneForm.reset();
    zoneForm.hidden = true;
    if (draftLayer) {
      zoneMap.removeLayer(draftLayer);
      draftLayer = null;
    }
  });

  if (zoneMapElement && window.L) {
    zoneMap = L.map(zoneMapElement).setView([13.43, 121.96], 10);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: "&copy; OpenStreetMap contributors" }).addTo(zoneMap);
    if (zoneMap.pm) {
      zoneMap.pm.addControls({ position: "topleft", drawText: false, drawCircle: false, drawCircleMarker: false, drawMarker: false, drawPolyline: false, drawRectangle: false });
      zoneMap.on("pm:create", (event) => {
        if (draftLayer) zoneMap.removeLayer(draftLayer);
        draftLayer = event.layer;
        zoneForm.hidden = false;
        zoneForm.elements.geometry.value = JSON.stringify(geometryFromLayer(draftLayer));
        zoneMessage.textContent = "Boundary drawn. Complete the form to save it.";
      });
      zoneMap.on("pm:edit", () => {
        if (draftLayer) zoneForm.elements.geometry.value = JSON.stringify(geometryFromLayer(draftLayer));
      });
    }
  }
  refresh();
}());
