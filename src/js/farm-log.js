(() => {
  const labels = {
    pig: { title: "Pig record added", mark: "+", markClass: "activity-mark-green", status: "Recorded", statusClass: "status-label-success" },
    listing: { title: "Marketplace listing posted", mark: "↗", markClass: "activity-mark-earth", status: "Listed", statusClass: "status-label-neutral" },
    report: { title: "Health report submitted", mark: "+", markClass: "activity-mark-amber", status: "Submitted", statusClass: "status-label-warning" },
    weight: { title: "Weight measurement recorded", mark: "↗", markClass: "activity-mark-gray", status: "Measured", statusClass: "status-label-neutral" }
  };
  const list = document.querySelector("#farm-log-list");
  if (!list) return;

  function showMessage(message) {
    list.replaceChildren();
    const paragraph = document.createElement("p");
    paragraph.className = "small-muted";
    paragraph.textContent = message;
    list.append(paragraph);
  }

  function renderActivity(entry) {
    const kind = labels[entry.activity_type];
    if (!kind) return null;
    const article = document.createElement("article");
    article.className = "activity-item";
    const mark = document.createElement("span");
    mark.className = `activity-mark ${kind.markClass}`;
    mark.setAttribute("aria-hidden", "true");
    mark.textContent = kind.mark;
    const details = document.createElement("div");
    details.className = "activity-details";
    const title = document.createElement("h3");
    title.textContent = kind.title;
    const description = document.createElement("p");
    const text = [entry.item_label, entry.detail].filter(Boolean);
    description.textContent = text.join(" · ");
    details.append(title, description);
    const meta = document.createElement("div");
    meta.className = "activity-meta";
    const date = document.createElement("time");
    const datePart = String(entry.activity_date || "").slice(0, 10);
    const parsed = /^\d{4}-\d{2}-\d{2}$/.test(datePart) ? new Date(`${datePart}T12:00:00`) : null;
    if (parsed && !Number.isNaN(parsed.getTime())) {
      date.dateTime = datePart;
      date.textContent = new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric" }).format(parsed);
    } else {
      date.textContent = "Date unavailable";
    }
    const status = document.createElement("span");
    status.className = `status-label ${kind.statusClass}`;
    status.textContent = kind.status;
    meta.append(date, status);
    article.append(mark, details, meta);
    return article;
  }

  async function loadFarmLog() {
    list.setAttribute("aria-busy", "true");
    try {
      const user = await window.PigmentAuth.getSession();
      if (!user || user.role !== "farmer") {
        showMessage("Sign in with a farmer account to see your recent activity.");
        return;
      }
      const result = await window.PigmentAuth.authenticatedRequest("farm-log.php");
      if (!Array.isArray(result.data)) throw new Error("Invalid farm log response.");
      const entries = result.data.map(renderActivity).filter(Boolean);
      if (!entries.length) {
        showMessage("No farm activity yet. Add a pig, record a weight, post a listing, or submit a health report to get started.");
        return;
      }
      list.replaceChildren(...entries);
    } catch (error) {
      showMessage(error.status === 401
        ? "Please sign in to view your farm log."
        : "Recent farm activity is unavailable. Check your connection and refresh the page.");
    } finally {
      list.setAttribute("aria-busy", "false");
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    loadFarmLog();
    document.addEventListener("pigment:farm-activity-updated", loadFarmLog);
    window.addEventListener("pageshow", (event) => {
      if (event.persisted) loadFarmLog();
    });
    window.addEventListener("focus", loadFarmLog);
  });
})();
