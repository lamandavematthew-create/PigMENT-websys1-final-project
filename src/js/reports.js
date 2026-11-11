(() => {
  const auth = window.PigmentAuth;
  const message = document.querySelector("#reports-message");
  if (!auth || !message) return;

  const $ = (selector) => document.querySelector(selector);
  const api = (path) => auth.authenticatedRequest(path);
  const setText = (selector, value) => { $(selector).textContent = value == null ? "Unavailable" : String(value); };
  const formatDate = (value) => value ? new Date(`${value}T00:00:00`).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" }) : "Date not recorded";
  const showMessage = (text, error = false) => {
    message.textContent = text;
    message.className = `form-message${error ? " is-error" : ""}`;
    message.hidden = !text;
  };
  const emptyRow = (element, text, columns) => {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = columns;
    cell.className = "report-empty";
    cell.textContent = text;
    row.append(cell);
    element.replaceChildren(row);
  };

  function renderPigs(pigs, weights) {
    setText("#total-pigs", pigs.length);
    setText("#active-pigs", pigs.filter((pig) => pig.pig_status === "active").length);
    setText("#sold-pigs", pigs.filter((pig) => pig.pig_status === "sold").length);
    setText("#deceased-pigs", pigs.filter((pig) => pig.pig_status === "deceased").length);

    const body = $("#growth-summary");
    body.replaceChildren();
    if (!pigs.length) {
      emptyRow(body, "No pig records have been registered yet.", 3);
      return;
    }
    pigs.forEach((pig) => {
      const latest = weights.get(Number(pig.pig_id))?.[0];
      const row = document.createElement("tr");
      [pig.pig_name || pig.pig_code, latest?.estimated_weight ? `${latest.estimated_weight} ${latest.weight_unit || "kg"} (estimate)` : "Unavailable", latest ? formatDate(latest.measurement_date) : "No measurement recorded"].forEach((value) => {
        const cell = document.createElement("td");
        cell.textContent = value;
        row.append(cell);
      });
      body.append(row);
    });
  }

  function renderPens(pens, assignments) {
    const current = assignments.filter((item) => item.assignment_status === "active" && !item.date_removed);
    const container = $("#pen-summary");
    container.replaceChildren();
    const activePens = pens.filter((pen) => pen.pen_status === "active");
    setText("#active-pen-count", activePens.length);
    if (!activePens.length) {
      const empty = document.createElement("p");
      empty.className = "small-muted report-empty-copy";
      empty.textContent = "No active pens have been recorded.";
      container.append(empty);
      return;
    }
    activePens.forEach((pen) => {
      const occupancy = current.filter((item) => Number(item.pen_id) === Number(pen.pen_id)).length;
      const card = document.createElement("article");
      card.className = "report-stat-card";
      const name = document.createElement("span");
      name.textContent = pen.pen_name;
      const value = document.createElement("strong");
      value.textContent = `${occupancy} / ${pen.capacity} pigs`;
      const detail = document.createElement("small");
      detail.textContent = `${occupancy} assigned · capacity ${pen.capacity}`;
      card.append(name, value, detail);
      container.append(card);
    });
  }

  function renderLitters(litters) {
    setText("#total-litters", litters.length);
    const container = $("#litter-summary");
    container.replaceChildren();
    if (!litters.length) {
      container.textContent = "No litter records have been recorded.";
      return;
    }
    litters.forEach((litter) => {
      const item = document.createElement("div");
      item.className = "litter-summary-item";
      item.textContent = `${formatDate(litter.birth_date)} · ${litter.total_born} born (${litter.born_alive} alive, ${litter.stillborn} stillborn)`;
      container.append(item);
    });
  }

  function renderListings(listings) {
    const count = (status) => listings.filter((listing) => listing.listing_status === status).length;
    setText("#active-listings", count("active"));
    setText("#sold-listings", count("sold"));
    setText("#inactive-listings", count("inactive"));
  }

  async function load() {
    try {
      const [pigResponse, penResponse, assignmentResponse, litterResponse, listingResponse] = await Promise.all([
        api("pigs.php"),
        api("pens.php"),
        api("pen-assignments.php"),
        api("litters.php"),
        api("marketplace.php?mine=1")
      ]);
      const pigs = pigResponse.data || [];
      const weights = new Map();
      await Promise.all(pigs.map(async (pig) => {
        const response = await api(`weight-records.php?pig_id=${encodeURIComponent(pig.pig_id)}`);
        weights.set(Number(pig.pig_id), response.data || []);
      }));
      renderPigs(pigs, weights);
      renderPens(penResponse.data || [], assignmentResponse.data || []);
      renderLitters(litterResponse.data || []);
      renderListings(listingResponse.data || []);
    } catch (error) {
      if (error.status === 401) {
        window.location.assign(`login.html?next=${encodeURIComponent("reports.html")}&message=Your session has ended. Please sign in again.`);
        return;
      }
      showMessage(error.message || "Reports could not be loaded. Please try again.", true);
    }
  }

  $("#print-report").addEventListener("click", () => window.print());
  auth.requireAuth().then((user) => { if (user) load(); });
})();
