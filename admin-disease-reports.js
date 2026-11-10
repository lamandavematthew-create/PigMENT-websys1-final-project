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
  let reports = [];
  let selectedId = "";

  function dateLabel(date) {
    return new Date(`${date}T00:00:00`).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
  }

  function statusLabel(status) {
    return status.replace("_", " ");
  }

  function renderList() {
    list.innerHTML = reports.map((report) => `<tr class="${report.id === selectedId ? "is-selected" : ""}"><td><button class="table-link" type="button" data-select="${report.id}">${report.diseaseType}</button><small class="fictional-label">Fictional record · ${report.id}</small></td><td>${report.municipality}, ${report.barangay}</td><td>${dateLabel(report.incidentDate)}</td><td><span class="status-label status-label-${report.publicationStatus === "published" ? "success" : report.publicationStatus === "rejected" ? "neutral" : "warning"}">${statusLabel(report.publicationStatus)}</span></td><td><button class="button button-secondary button-small" type="button" data-select="${report.id}">Inspect</button></td></tr>`).join("");
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

  function refresh() {
    reports = window.PigmentDiseaseStore.loadReports();
    if (selectedId && !reports.some((report) => report.id === selectedId)) selectedId = "";
    renderList();
    renderDetail();
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

  window.addEventListener("pigment:disease-reports-updated", refresh);
  refresh();
}());
