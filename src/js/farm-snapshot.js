(() => {
  const fields = {
    total_pigs: document.querySelector("#snapshot-total-pigs"),
    active_pigs: document.querySelector("#snapshot-active-pigs"),
    active_listings: document.querySelector("#snapshot-active-listings"),
    recent_reports: document.querySelector("#snapshot-recent-reports")
  };
  const message = document.querySelector("#farm-snapshot-message");

  if (!message || Object.values(fields).some((node) => !node)) return;

  async function loadFarmSnapshot() {
    try {
      const user = await window.PigmentAuth.getSession();
      if (!user || user.role !== "farmer") {
        message.textContent = "Sign in with a farmer account to view your farm data.";
        return;
      }

      const result = await window.PigmentAuth.authenticatedRequest("farm-snapshot.php");
      const data = result.data;

      for (const [key, node] of Object.entries(fields)) {
        if (!Number.isSafeInteger(data[key]) || data[key] < 0) {
          throw new Error("The farm summary returned invalid data.");
        }
        node.textContent = data[key].toLocaleString("en-PH");
      }
      message.textContent = "Showing records for your account.";
    } catch (error) {
      // Never display sample data as if it came from the database.
      for (const node of Object.values(fields)) node.textContent = "—";
      message.textContent = error.status === 401
        ? "Please sign in to load your farm information."
        : "Farm information is unavailable. Check your connection and refresh the page.";
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    loadFarmSnapshot();
    window.addEventListener("pageshow", (event) => {
      if (event.persisted) loadFarmSnapshot();
    });
  });
})();
