(function () {
  "use strict";

  const storageKey = "pigment-disease-reports-v1";
  const sampleReports = [
    {
      id: "demo-report-001",
      diseaseType: "African Swine Fever (ASF)",
      municipality: "Boac",
      barangay: "Isok I",
      incidentDate: "2026-10-28",
      submittedDate: "2026-10-29",
      publicationStatus: "published",
      confirmationStatus: "confirmed",
      confirmationDetails: "Fictional demo confirmation by Municipal Veterinary Office",
      description: "Fictional demonstration incident for map testing.",
      reporter: "Demo farmer record",
      latitude: 13.445,
      longitude: 121.834
    },
    {
      id: "demo-report-002",
      diseaseType: "Suspected ASF",
      municipality: "Mogpog",
      barangay: "Anapog-Sapa",
      incidentDate: "2026-11-02",
      submittedDate: "2026-11-03",
      publicationStatus: "published",
      confirmationStatus: "confirmed",
      confirmationDetails: "Fictional demo confirmation by Provincial Veterinary Office",
      description: "Fictional demonstration incident for map testing.",
      reporter: "Demo farmer record",
      latitude: 13.471,
      longitude: 121.861
    },
    {
      id: "demo-report-003",
      diseaseType: "Suspected ASF",
      municipality: "Gasan",
      barangay: "Bagtong",
      incidentDate: "2026-11-05",
      submittedDate: "2026-11-06",
      publicationStatus: "under_review",
      confirmationStatus: "pending",
      confirmationDetails: "",
      description: "Fictional demonstration report awaiting official assessment.",
      reporter: "Demo farmer record",
      latitude: 13.321,
      longitude: 121.846
    },
    {
      id: "demo-report-004",
      diseaseType: "Other swine illness",
      municipality: "Santa Cruz",
      barangay: "Lusok",
      incidentDate: "2026-11-01",
      submittedDate: "2026-11-02",
      publicationStatus: "rejected",
      confirmationStatus: "not_confirmed",
      confirmationDetails: "",
      description: "Fictional demonstration report that was not confirmed.",
      reporter: "Demo farmer record",
      latitude: 13.47,
      longitude: 122.02
    },
    {
      id: "demo-report-005",
      diseaseType: "African Swine Fever (ASF)",
      municipality: "Torrijos",
      barangay: "Payan",
      incidentDate: "2026-11-07",
      submittedDate: "2026-11-08",
      publicationStatus: "under_review",
      confirmationStatus: "confirmed",
      confirmationDetails: "Fictional demo confirmation by authorized veterinary officer",
      description: "Fictional approved report. Publish it to test the workflow.",
      reporter: "Demo farmer record",
      latitude: 13.32,
      longitude: 122.08
    }
  ];

  function copyReports() {
    return JSON.parse(JSON.stringify(sampleReports));
  }

  function loadReports() {
    try {
      const saved = localStorage.getItem(storageKey);
      if (!saved) return copyReports();
      const reports = JSON.parse(saved);
      if (!Array.isArray(reports)) throw new Error("Disease reports have an unexpected format.");
      return reports;
    } catch (error) {
      return copyReports();
    }
  }

  function saveReports(reports) {
    localStorage.setItem(storageKey, JSON.stringify(reports));
    window.dispatchEvent(new CustomEvent("pigment:disease-reports-updated"));
  }

  function isPublishable(report) {
    return report.confirmationStatus === "confirmed" &&
      Boolean(report.confirmationDetails && report.confirmationDetails.trim());
  }

  function isPublished(report) {
    return report.publicationStatus === "published" && isPublishable(report);
  }

  window.PigmentDiseaseStore = {
    loadReports,
    saveReports,
    isPublishable,
    isPublished,
    storageKey
  };
}());
