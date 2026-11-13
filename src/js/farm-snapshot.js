(() => {
  const fields = {
    total_pigs: document.querySelector("#snapshot-total-pigs"),
    active_pigs: document.querySelector("#snapshot-active-pigs"),
    active_listings: document.querySelector("#snapshot-active-listings"),
    recent_reports: document.querySelector("#snapshot-recent-reports")
  };
  const message = document.querySelector("#farm-snapshot-message");
  const reminder = document.querySelector("#farm-reminder");
  const reminderText = document.querySelector("#farm-reminder-text");
  let requestId = 0;

  if (!message || Object.values(fields).some((node) => !node)) return;

  async function loadFarmSnapshot() {
    const request = ++requestId;
    if (reminder) reminder.hidden = true;
    if (reminderText) reminderText.textContent = "";
    try {
      const user = await window.PigmentAuth.getSession();
      if (request !== requestId) return;
      if (!user || user.role !== "farmer") {
        message.textContent = "Sign in with a farmer account to view your farm data.";
        return;
      }

      const result = await window.PigmentAuth.authenticatedRequest("farm-snapshot.php", {cache: "no-store"});
      if (request !== requestId) return;
      const data = result.data;

      for (const [key, node] of Object.entries(fields)) {
        if (!Number.isSafeInteger(data[key]) || data[key] < 0) {
          throw new Error("The farm summary returned invalid data.");
        }
        node.textContent = data[key].toLocaleString("en-PH");
      }
      message.textContent = "Showing records for your account.";
      const open = data.open_reports;
      if (reminder && reminderText && Number.isSafeInteger(open) && open > 0) {
        const count = open.toLocaleString("en-PH");
        reminderText.textContent = open === 1
          ? "You have 1 submitted health report pending or under review."
          : `You have ${count} submitted health reports pending or under review.`;
        reminder.hidden = false;
      }
    } catch (error) {
      if (request !== requestId) return;
      // Never display sample data as if it came from the database.
      for (const node of Object.values(fields)) node.textContent = "—";
      message.textContent = error.status === 401
        ? "Please sign in to load your farm information."
        : "Farm information is unavailable. Check your connection and refresh the page.";
    }
  }

  document.addEventListener("pigment:workspace-route", (event) => {
    if (event.detail.route === "home" && event.detail.previous && event.detail.previous !== "home") loadFarmSnapshot();
  });

  document.addEventListener("DOMContentLoaded", () => {
    loadFarmSnapshot();
    window.addEventListener("pageshow", (event) => {
      if (event.persisted) loadFarmSnapshot();
    });
  });
})();
