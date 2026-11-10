(function () {
  "use strict";

  const reportsKey = "pigment-disease-reports-v1";
  const zonesKey = "pigment-infected-zones-v1";
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

  const sampleZones = [
    {
      id: "demo-zone-001",
      name: "Boac North Demonstration Zone",
      municipality: "Boac",
      barangay: "Isok I and nearby farms",
      diseaseType: "African Swine Fever (ASF)",
      severity: "high",
      status: "confirmed",
      publicationStatus: "published",
      dateReported: "2026-10-28",
      description: "Fictional demonstration boundary for confirmed infection.",
      confirmationDetails: "Fictional demo confirmation by Municipal Veterinary Office",
      incidentReportId: "demo-report-001",
      fictional: true,
      geometry: {
        type: "Polygon",
        coordinates: [[[121.82, 13.455], [121.85, 13.455], [121.86, 13.435], [121.84, 13.418], [121.815, 13.43], [121.82, 13.455]]]
      }
    },
    {
      id: "demo-zone-002",
      name: "Mogpog Monitoring Area",
      municipality: "Mogpog",
      barangay: "Anapog-Sapa",
      diseaseType: "Suspected ASF",
      severity: "medium",
      status: "monitoring",
      publicationStatus: "published",
      dateReported: "2026-11-02",
      description: "Fictional demonstration area under monitoring.",
      confirmationDetails: "",
      incidentReportId: "demo-report-002",
      fictional: true,
      geometry: {
        type: "Polygon",
        coordinates: [[[121.845, 13.485], [121.88, 13.49], [121.89, 13.465], [121.86, 13.45], [121.84, 13.465], [121.845, 13.485]]]
      }
    },
    {
      id: "demo-zone-003",
      name: "Torrijos Resolved Demonstration Zone",
      municipality: "Torrijos",
      barangay: "Payan",
      diseaseType: "African Swine Fever (ASF)",
      severity: "low",
      status: "resolved",
      publicationStatus: "published",
      dateReported: "2026-10-15",
      description: "Fictional demonstration area retained for historical reference.",
      confirmationDetails: "Fictional demo resolution by authorized veterinary officer",
      incidentReportId: "demo-report-005",
      fictional: true,
      geometry: {
        type: "Polygon",
        coordinates: [[[122.06, 13.34], [122.095, 13.34], [122.105, 13.315], [122.08, 13.295], [122.055, 13.31], [122.06, 13.34]]]
      }
    }
  ];

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function loadCollection(key, fallback, label) {
    try {
      const saved = localStorage.getItem(key);
      if (!saved) return clone(fallback);
      const value = JSON.parse(saved);
      if (!Array.isArray(value)) throw new Error(`${label} have an unexpected format.`);
      return value;
    } catch (error) {
      console.warn(`Unable to load ${label}; using fictional demonstration data.`, error);
      return clone(fallback);
    }
  }

  function saveCollection(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent("pigment:disease-data-updated"));
  }

  function loadReports() {
    return loadCollection(reportsKey, sampleReports, "disease reports");
  }

  function saveReports(reports) {
    saveCollection(reportsKey, reports);
  }

  function loadZones() {
    return loadCollection(zonesKey, sampleZones, "infected zones");
  }

  function saveZones(zones) {
    saveCollection(zonesKey, zones);
  }

  function isPublishable(item) {
    return item.confirmationStatus === "confirmed" &&
      Boolean(item.confirmationDetails && item.confirmationDetails.trim());
  }

  function isPublished(report) {
    return report.publicationStatus === "published" && isPublishable(report);
  }

  function isZoneVisible(zone) {
    if (zone.publicationStatus !== "published") return false;
    if (zone.status === "confirmed") return Boolean(zone.confirmationDetails && zone.confirmationDetails.trim());
    return zone.status === "monitoring" || zone.status === "resolved";
  }

  window.PigmentDiseaseStore = {
    loadReports,
    saveReports,
    loadZones,
    saveZones,
    isPublishable,
    isPublished,
    isZoneVisible,
    storageKey: reportsKey,
    zonesKey
  };
}());
