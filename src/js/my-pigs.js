(() => {
  const auth = window.PigmentAuth;
  const pigList = document.querySelector("#pig-list");
  const weightEstimator = window.PigmentWeight;
  if (!auth || !pigList || !weightEstimator) return;

  const state = { pigs: [], pens: [], assignments: [], litters: [], weights: new Map(), expandedPen: null, editingPenId: null };
  const $ = (selector) => document.querySelector(selector);
  const message = (text, error = false) => {
    const element = $("#interaction-message");
    element.textContent = text;
    element.className = `interaction-message${error ? " is-error" : ""}`;
    element.hidden = false;
  };
  const penMessage = (text, error = false) => {
    const element = $("#pen-message");
    element.textContent = text;
    element.className = `interaction-message${error ? " is-error" : ""}`;
    element.hidden = false;
  };
  const api = (path, options) => auth.authenticatedRequest(path, options);
  const json = (value) => JSON.stringify(value);
  const text = (element, value) => { element.textContent = value == null || value === "" ? "Not available" : String(value); };
  const formatDate = (value) => value ? new Date(`${value}T00:00:00`).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" }) : "Not recorded";
  const pigName = (pig) => pig.pig_name || pig.pig_code;
  const getPig = (id) => state.pigs.find((pig) => Number(pig.pig_id) === Number(id));
  const getPen = (id) => state.pens.find((pen) => Number(pen.pen_id) === Number(id));
  const assignedPigIds = (penId) => state.assignments
    .filter((item) => Number(item.pen_id) === Number(penId) && item.assignment_status === "active" && !item.date_removed)
    .map((item) => Number(item.pig_id));
  const latestWeight = (pigId) => (state.weights.get(Number(pigId)) || [])[0];

  function option(select, value, label) {
    const item = document.createElement("option");
    item.value = value;
    item.textContent = label;
    select.append(item);
  }

  async function load() {
    try {
      const [pigs, pens, assignments, litters] = await Promise.all([
        api("pigs.php"),
        api("pens.php"),
        api("pen-assignments.php"),
        api("litters.php")
      ]);
      state.pigs = pigs.data || [];
      state.pens = pens.data || [];
      state.assignments = assignments.data || [];
      state.litters = litters.data || [];
      await Promise.all(state.pigs.map(async (pig) => {
        const result = await api(`weight-records.php?pig_id=${encodeURIComponent(pig.pig_id)}`);
        state.weights.set(Number(pig.pig_id), result.data || []);
      }));
      render();
      updateLitterOptions();
    } catch (error) {
      message(error.message || "Farm records could not be loaded. Please refresh and try again.", true);
    }
  }

  function renderPigCard(pig) {
    const card = document.createElement("article");
    card.className = "pig-card";
    const heading = document.createElement("div");
    heading.className = "pig-card-heading";
    const identity = document.createElement("div");
    identity.className = "pig-card-identity";
    const name = document.createElement("h3");
    text(name, pigName(pig));
    const sub = document.createElement("p");
    text(sub, `${pig.pig_code} · ${pig.breed} · ${pig.sex}`);
    identity.append(name, sub);
    const status = document.createElement("span");
    status.className = "status-label status-label-monitoring";
    text(status, pig.pig_status || "active");
    heading.append(identity, status);
    const facts = document.createElement("dl");
    facts.className = "pig-card-facts";
    [["Birth date", formatDate(pig.birth_date)], ["Age", pig.estimated_age_months ? `${pig.estimated_age_months} months` : "Not recorded"],
      ["Latest estimate", latestWeight(pig.pig_id)?.estimated_weight ? `${latestWeight(pig.pig_id).estimated_weight} kg` : "Unavailable"],
      ["Pen", (() => { const assignment = state.assignments.find((item) => Number(item.pig_id) === Number(pig.pig_id) && item.assignment_status === "active"); return getPen(assignment?.pen_id)?.pen_name || "Not assigned"; })()]
    ].forEach(([label, value]) => {
      const fact = document.createElement("div");
      fact.className = "pig-card-fact";
      const term = document.createElement("dt");
      text(term, label);
      const detail = document.createElement("dd");
      text(detail, value);
      fact.append(term, detail);
      facts.append(fact);
    });
    const actions = document.createElement("div");
    actions.className = "pen-card-actions";
    const detailsButton = document.createElement("button");
    detailsButton.className = "button button-secondary";
    detailsButton.type = "button";
    detailsButton.textContent = "View Details";
    detailsButton.addEventListener("click", () => showPigDetails(pig, card, detailsButton));
    actions.append(detailsButton);
    card.append(heading, facts, actions);
    return card;
  }

  function renderPigs() {
    const search = ($("#pig-search").value || "").trim().toLowerCase();
    const status = $("#status-filter").value;
    const filtered = state.pigs.filter((pig) => {
      const haystack = `${pigName(pig)} ${pig.pig_code} ${pig.breed}`.toLowerCase();
      return haystack.includes(search) && (status === "all" || pig.pig_status === status);
    });
    pigList.replaceChildren(...filtered.map(renderPigCard));
    $("#record-count").textContent = `${filtered.length} of ${state.pigs.length} pigs shown`;
    $("#empty-state").hidden = filtered.length !== 0;
    $("#empty-title").textContent = state.pigs.length ? "No pigs found" : "No pigs registered yet";
    $("#empty-description").textContent = state.pigs.length ? "Try another search or status filter." : "Register your first pig to start a farm record.";
  }

  function showPigDetails(pig, card, button) {
    const existing = card.querySelector(".pig-profile");
    if (existing) { existing.remove(); button.textContent = "View Details"; return; }
    const panel = document.createElement("section");
    panel.className = "pig-profile";
    const title = document.createElement("h4");
    title.textContent = "Pig details";
    const details = document.createElement("p");
    text(details, `${pigName(pig)} · ${pig.pig_code} · ${pig.breed} · ${pig.sex}`);
    const weightTitle = document.createElement("strong");
    weightTitle.textContent = "Growth history";
    const weights = document.createElement("ul");
    (state.weights.get(Number(pig.pig_id)) || []).forEach((record) => {
      const item = document.createElement("li");
      text(item, `${formatDate(record.measurement_date)} · ${record.heart_girth} cm girth · ${record.body_length} cm length · ${record.estimated_weight ? `${record.estimated_weight} kg` : "Weight unavailable"}`);
      weights.append(item);
    });
    if (!weights.children.length) { const item = document.createElement("li"); item.textContent = "No measurements recorded yet."; weights.append(item); }
    const litterTitle = document.createElement("strong");
    litterTitle.textContent = "Litter records";
    const litters = document.createElement("ul");
    state.litters.filter((litter) => Number(litter.mother_pig_id) === Number(pig.pig_id)).forEach((litter) => {
      const item = document.createElement("li");
      text(item, `${formatDate(litter.birth_date)} · ${litter.total_born} born · ${litter.born_alive} alive · ${litter.stillborn} stillborn`);
      litters.append(item);
    });
    if (!litters.children.length) { const item = document.createElement("li"); item.textContent = "No litter records."; litters.append(item); }
    const weightForm = document.createElement("form");
    weightForm.className = "inline-record-form";
    weightForm.innerHTML = `<label>Heart girth (cm)<input name="girth" type="number" min="0.01" step="0.01" required></label>
      <label>Body length (cm)<input name="length" type="number" min="0.01" step="0.01" required></label>
      <label>Date<input name="date" type="date" required></label>
      <label>Estimated weight (kg, optional)<input name="weight" type="number" min="0.01" step="0.01"></label>
      <button class="button button-primary" type="submit">Record Weight</button>`;
    weightForm.elements.date.value = new Date().toISOString().slice(0, 10);
    const updateWeight = () => {
      const estimate = weightEstimator.calculateWeight(weightForm.elements.girth.value, weightForm.elements.namedItem("length").value, "cm");
      weightForm.elements.weight.value = estimate ? estimate.kilograms.toFixed(2) : "";
    };
    weightForm.elements.girth.addEventListener("input", updateWeight);
    weightForm.elements.namedItem("length").addEventListener("input", updateWeight);
    weightForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = new FormData(weightForm);
      try {
        await api("weight-records.php", { method: "POST", body: json({ pig_id: pig.pig_id, heart_girth: form.get("girth"), body_length: form.get("length"), estimated_weight: form.get("weight"), measurement_date: form.get("date"), notes: "" }) });
        message("Measurement saved.");
        await load();
      } catch (error) { message(error.message, true); }
    });
    panel.append(title, details, weightTitle, weights, litterTitle, litters, weightForm);
    card.append(panel);
    button.textContent = "Hide Details";
  }

  function renderPens() {
    const list = $("#pen-list");
    list.replaceChildren();
    $("#pens-empty").hidden = state.pens.length > 0;
    list.hidden = state.pens.length === 0;
    state.pens.forEach((pen) => {
      const ids = assignedPigIds(pen.pen_id);
      const card = document.createElement("article");
      card.className = "pen-card";
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "pen-card-toggle";
      toggle.setAttribute("aria-expanded", String(state.expandedPen === pen.pen_id));
      toggle.innerHTML = `<span class="pen-card-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 13v-2a2 2 0 0 1 2-2h1l2-3h6l2 3h1a2 2 0 0 1 2 2v2"/><path d="M5 13h14l1 3a2 2 0 0 1-2 2h-1M6 17H5a2 2 0 0 1-2-2l1-2"/><circle cx="8" cy="15" r="1"/><circle cx="16" cy="15" r="1"/></svg></span><span class="pen-card-details"><strong></strong><small></small></span><span class="pen-card-count"></span><span aria-hidden="true">⌄</span>`;
      text(toggle.querySelector("strong"), pen.pen_name);
      text(toggle.querySelector("small"), `Pen ID: ${pen.pen_id} · ${pen.pen_type || "General"}`);
      text(toggle.querySelector(".pen-card-count"), `${ids.length}${pen.capacity ? ` / ${pen.capacity}` : ""} pigs`);
      toggle.addEventListener("click", () => { state.expandedPen = state.expandedPen === pen.pen_id ? null : pen.pen_id; renderPens(); });
      card.append(toggle);
      if (state.expandedPen === pen.pen_id) {
        const content = document.createElement("div");
        content.className = "pen-member-section";
        const heading = document.createElement("h4");
        heading.textContent = "Pigs inside";
        content.append(heading);
        if (!ids.length) { const empty = document.createElement("p"); empty.textContent = "No pigs assigned to this pen yet."; content.append(empty); }
        ids.map(getPig).filter(Boolean).forEach((pig) => content.append(renderPigCard(pig)));
        const assign = document.createElement("form");
        assign.className = "inline-record-form";
        const select = document.createElement("select");
        option(select, "", "Choose a pig to assign or transfer");
        state.pigs.filter((pig) => pig.pig_status === "active").forEach((pig) => option(select, pig.pig_id, `${pigName(pig)} · ${pig.pig_code}`));
        const save = document.createElement("button");
        save.className = "button button-secondary";
        save.type = "submit";
        save.textContent = "Assign Pig";
        assign.append(select, save);
        assign.addEventListener("submit", async (event) => {
          event.preventDefault();
          if (!select.value) return;
          const current = state.assignments.find((item) => Number(item.pig_id) === Number(select.value) && item.assignment_status === "active");
          try {
            await api("pen-assignments.php", { method: "POST", body: json({ action: current ? "transfer" : "assign", pig_id: Number(select.value), pen_id: Number(pen.pen_id), notes: "" }) });
            penMessage("Pig assignment saved.");
            await load();
          } catch (error) { penMessage(error.message, true); }
        });
        const actions = document.createElement("div");
        actions.className = "pen-card-actions";
        const edit = document.createElement("button");
        edit.className = "button button-secondary";
        edit.type = "button";
        edit.textContent = "Edit Pen";
        edit.addEventListener("click", () => openPenForm(pen));
        const remove = document.createElement("button");
        remove.className = "button button-danger";
        remove.type = "button";
        remove.textContent = "Delete Pen";
        remove.addEventListener("click", async () => {
          if (!window.confirm(`Delete ${pen.pen_name}? This cannot be undone.`)) return;
          try {
            await api(`pens.php?id=${encodeURIComponent(pen.pen_id)}`, { method: "DELETE" });
            state.expandedPen = null;
            penMessage(`${pen.pen_name} was deleted.`);
            await load();
          } catch (error) {
            penMessage(error.message || "This pen could not be deleted.", true);
          }
        });
        actions.append(edit, remove);
        content.append(assign, actions);
        card.append(content);
      }
      list.append(card);
    });
  }

  function render() { renderPigs(); renderPens(); }

  function updateLitterOptions() {
    const select = $("#litter-mother");
    select.replaceChildren();
    option(select, "", state.pigs.some((pig) => pig.sex === "female") ? "Choose a mother sow" : "Register a female pig first");
    state.pigs.filter((pig) => pig.sex === "female" && pig.pig_status === "active").forEach((pig) => option(select, pig.pig_id, `${pigName(pig)} · ${pig.pig_code}`));
  }

  $("#pig-search").addEventListener("input", renderPigs);
  $("#status-filter").addEventListener("change", renderPigs);
  $("#open-registration").addEventListener("click", () => { $("#registration-panel").hidden = false; $("#registration-panel").scrollIntoView({ behavior: "smooth" }); });
  $("#empty-register").addEventListener("click", () => { $("#registration-panel").hidden = false; });
  $("#close-registration").addEventListener("click", () => { $("#registration-panel").hidden = true; });
  $("#cancel-registration").addEventListener("click", () => { $("#registration-panel").hidden = true; });
  function openPenForm(pen = null) {
    state.editingPenId = pen ? Number(pen.pen_id) : null;
    const form = $("#pen-form");
    form.reset();
    $("#pen-form-title").textContent = pen ? "Edit Pig Pen" : "Create a Pig Pen";
    $("#pen-form-submit").textContent = pen ? "Save Pen Changes" : "Create Pig Pen";
    if (pen) {
      form.elements.penName.value = pen.pen_name || "";
      form.elements.penType.value = pen.pen_type || "General";
      form.elements.penStatus.value = pen.pen_status || "active";
      form.elements.capacity.value = pen.capacity || "";
      form.elements.description.value = pen.description || "";
    }
    form.hidden = false;
    form.scrollIntoView({ behavior: "smooth", block: "start" });
    form.elements.penName.focus();
  }
  function closePenForm() {
    state.editingPenId = null;
    $("#pen-form").reset();
    $("#pen-form-title").textContent = "Create a Pig Pen";
    $("#pen-form-submit").textContent = "Create Pig Pen";
    $("#pen-form").hidden = true;
  }
  $("#open-pen-form").addEventListener("click", () => openPenForm());
  $("#empty-create-pen").addEventListener("click", () => openPenForm());
  $("#close-pen-form").addEventListener("click", closePenForm);
  $("#cancel-pen-form").addEventListener("click", closePenForm);
  $("#open-litter-form").addEventListener("click", () => { updateLitterOptions(); $("#litter-form").hidden = false; });
  $("#close-litter-form").addEventListener("click", () => { $("#litter-form").hidden = true; });
  $("#cancel-litter-form").addEventListener("click", () => { $("#litter-form").hidden = true; });

  const registrationForm = $("#pig-form");
  const updateRegistrationEstimate = () => {
    const estimate = weightEstimator.calculateWeight(registrationForm.elements.girth.value, registrationForm.elements.namedItem("length").value, "cm");
    registrationForm.elements.estimatedWeight.value = estimate ? estimate.kilograms.toFixed(2) : "";
    $("#weight-entry-message").textContent = estimate
      ? `Estimated weight: ${estimate.kilograms.toFixed(2)} kg (${estimate.pounds.toFixed(2)} lb).`
      : "Enter heart girth and body length to calculate an estimate.";
    const price = registrationForm.elements.pricePerKg.value;
    const value = estimate && weightEstimator.calculateSellingValue(estimate.kilograms, price);
    const valueElement = $("#weight-entry-value");
    valueElement.textContent = value === null ? "" : `Estimated gross selling value: ₱${value.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    valueElement.hidden = value === null;
  };
  [registrationForm.elements.girth, registrationForm.elements.namedItem("length"), registrationForm.elements.pricePerKg]
    .forEach((input) => input.addEventListener("input", updateRegistrationEstimate));

  registrationForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      const pigResponse = await api("pigs.php", { method: "POST", body: json({ pig_code: form.get("pigCode").trim(), pig_name: form.get("pigName").trim(), breed: form.get("breed").trim(), sex: form.get("sex"), birth_date: form.get("birthDate"), estimated_age_months: form.get("ageMonths"), notes: form.get("notes").trim() }) });
      const girth = form.get("girth");
      const bodyLength = form.get("length");
      if (girth && bodyLength) {
        const estimate = weightEstimator.calculateWeight(girth, bodyLength, "cm");
        if (estimate && pigResponse.data && pigResponse.data.pig_id) {
          try {
            await api("weight-records.php", {
              method: "POST",
              body: json({
                pig_id: pigResponse.data.pig_id,
                heart_girth: girth,
                body_length: bodyLength,
                estimated_weight: estimate.kilograms.toFixed(2),
                measurement_date: new Date().toISOString().slice(0, 10),
                notes: "Estimated using the approved heart girth and body length formula."
              })
            });
          } catch (error) {
            formElement.reset();
            $("#registration-panel").hidden = true;
            message(`Pig registered, but the initial measurement was not saved: ${error.message}`, true);
            await load();
            return;
          }
        }
      }
      formElement.reset();
      $("#registration-panel").hidden = true;
      message("Pig registered successfully.");
      await load();
    } catch (error) {
      message(error.message || "Pig registration could not be completed.", true);
    }
  });

  $("#pen-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const penName = form.get("penName").trim();
    const editingId = state.editingPenId;
    const duplicate = state.pens.some((pen) =>
      Number(pen.pen_id) !== Number(editingId) &&
      String(pen.pen_name).trim().toLowerCase() === penName.toLowerCase()
    );
    if (duplicate) {
      penMessage("A pen with this name already exists. Choose a different name.", true);
      return;
    }
    try {
      const payload = { pen_name: penName, pen_type: form.get("penType"), capacity: form.get("capacity"), description: form.get("description").trim(), pen_status: form.get("penStatus") };
      await api(editingId ? `pens.php?id=${encodeURIComponent(editingId)}` : "pens.php", { method: editingId ? "PUT" : "POST", body: json(payload) });
      closePenForm();
      penMessage(editingId ? "Pen changes saved successfully." : "Pen created successfully.");
      await load();
    } catch (error) { penMessage(error.message, true); }
  });

  $("#litter-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const total = Number(form.get("totalBorn"));
    const alive = Number(form.get("bornAlive"));
    const stillborn = Number(form.get("stillborn"));
    if (total !== alive + stillborn) { $("#litter-error").textContent = "Total born must equal born alive plus stillborn."; $("#litter-error").hidden = false; return; }
    try {
      await api("litters.php", { method: "POST", body: json({ mother_pig_id: form.get("motherPigId"), birth_date: form.get("birthDate"), total_born: total, born_alive: alive, stillborn, notes: form.get("notes").trim() }) });
      formElement.reset();
      $("#litter-form").hidden = true;
      penMessage("Litter record saved.");
      await load();
    } catch (error) { $("#litter-error").textContent = error.message; $("#litter-error").hidden = false; }
  });

  load();
})();
