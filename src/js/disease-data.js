(function () {
  "use strict";

  const apiBase = window.location.pathname.includes("/pages/") ? "../../api/" : "../api/";

  async function request(path, options = {}) {
    const response = await fetch(`${apiBase}${path}`, {
      credentials: "same-origin",
      ...options,
      headers: { Accept: "application/json", ...(options.headers || {}) }
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload || payload.status !== "success") {
      const error = new Error(payload?.message || "The disease information request failed.");
      error.status = response.status;
      throw error;
    }
    return payload.data;
  }

  async function secureRequest(path, options = {}) {
    const token = await window.PigmentAuth.getCsrfToken();
    return request(path, { ...options, headers: { "X-CSRF-Token": token, ...(options.headers || {}) } });
  }

  function isPublishable(item) {
    return item.report_status === "confirmed" && Boolean(item.confirmation_details);
  }

  function isPublished(item) {
    return item.is_published === true && item.report_status === "confirmed";
  }

  function isZoneVisible(zone) {
    return zone.is_published === true && ["confirmed", "monitoring", "resolved"].includes(zone.zone_status);
  }

  window.PigmentDiseaseStore = {
    loadReports: (scope = "public") => request(`disease-reports.php?scope=${encodeURIComponent(scope)}`),
    loadZones: (scope = "public") => request(`infected-zones.php?scope=${encodeURIComponent(scope)}`),
    createReport: (data) => secureRequest("disease-reports.php", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
    updateReport: (id, data) => secureRequest(`disease-reports.php?id=${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
    saveZone: (data) => secureRequest("infected-zones.php", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
    isPublishable,
    isPublished,
    isZoneVisible
  };
}());
