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

  const priceArtwork = "../../public/assets/registered-pigs-price";
  const wholePeso = new Intl.NumberFormat("en-PH", {style:"currency", currency:"PHP", maximumFractionDigits:0});
  const decimalPeso = new Intl.NumberFormat("en-PH", {style:"currency", currency:"PHP"});
  const money = (amount) => (Number.isInteger(amount) ? wholePeso : decimalPeso).format(amount);
  const openDetails = new Set();

  function renderPrice(pig) {
    const panel = document.createElement("div");
    panel.className = "pig-price";
    const rate = Number(pig.price_per_kg);
    const value = weightEstimator.calculateSellingValue(Number(latestWeight(pig.pig_id)?.estimated_weight), rate);
    panel.innerHTML = `<div class="pig-price-rate"><img src="${priceArtwork}/price-tag-badge.svg" alt="" width="32" height="32"><div><span>Price per kg</span><strong></strong></div></div>
      <div class="pig-price-total"><span>Estimated value</span><strong></strong></div>`;
    panel.querySelector(".pig-price-rate strong").textContent = rate > 0 ? `${money(rate)}/kg` : "Not set";
    panel.querySelector(".pig-price-total strong").textContent = value !== null ? money(value) : "Unavailable";
    return panel;
  }

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

  let editingPigId = null;
  let editPigPreviousFocus = null;
  document.body.append($("#edit-pig-backdrop"), $("#edit-pig-panel"));
  function closeEditPig(force = false) {
    if (force !== true && $("#edit-pig-form button[type=submit]").disabled) return;
    editingPigId = null;
    $("#edit-pig-form").reset();
    $("#edit-pig-error").hidden = true;
    $("#edit-pig-panel").hidden = true;
    $("#edit-pig-backdrop").hidden = true;
    document.body.classList.remove("edit-pig-modal-open");
    if (editPigPreviousFocus && editPigPreviousFocus.isConnected) editPigPreviousFocus.focus({preventScroll:true});
    editPigPreviousFocus = null;
  }
  function openEditPig(pig) {
    const panel = $("#edit-pig-panel");
    const form = $("#edit-pig-form");
    editPigPreviousFocus = document.activeElement;
    editingPigId = pig.pig_id;
    form.elements.pigCode.value = pig.pig_code || "";
    form.elements.pigName.value = pig.pig_name || "";
    form.elements.breed.value = pig.breed || "";
    form.elements.sex.value = pig.sex || "male";
    form.elements.birthDate.value = pig.birth_date || "";
    form.elements.ageMonths.value = pig.estimated_age_months || "";
    form.elements.pigStatus.value = pig.pig_status || "active";
    form.elements.notes.value = pig.notes || "";
    $("#edit-pig-title").textContent = `Edit ${pigName(pig)}`;
    $("#edit-pig-error").hidden = true;
    $("#edit-pig-backdrop").hidden = false;
    panel.hidden = false;
    document.body.classList.add("edit-pig-modal-open");
    panel.scrollTop = 0;
    form.elements.pigName.focus({preventScroll:true});
  }
  $("#edit-pig-backdrop").addEventListener("click", closeEditPig);
  document.addEventListener("keydown", (event) => {
    const panel = $("#edit-pig-panel");
    if (panel.hidden) return;
    if (event.key === "Escape") {
      if (panel.querySelector('button[type="submit"]').disabled) return;
      event.preventDefault();
      closeEditPig();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = [...panel.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]')].filter((element) => element.getClientRects().length > 0);
    if (!focusable.length) {event.preventDefault();panel.focus();return;}
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === panel)) {event.preventDefault();last.focus();}
    else if (!event.shiftKey && document.activeElement === last) {event.preventDefault();first.focus();}
  });

  function renderPigCard(pig, scope = "registered") {
    const card = document.createElement("article");
    card.className = "pig-card";
    const detailId = `pig-details-${scope}-${pig.pig_id}`;
    card.dataset.pigCard = detailId;
    card.dataset.pigRecordId = pig.pig_id;
    const heading = document.createElement("div");
    heading.className = "pig-card-heading";
    const identity = document.createElement("div");
    identity.className = "pig-card-identity";
    const name = document.createElement("h3");
    text(name, pigName(pig));
    const sub = document.createElement("p");
    text(sub, `ID: ${pig.pig_code}`);
    const attributes = document.createElement("p");
    attributes.className = "pig-attributes";
    const breedItem = document.createElement("span");
    breedItem.className = "pig-breed-item";
    const breedText = document.createElement("span");
    text(breedText, `Breed: ${pig.breed || "Not recorded"}`);
    breedItem.append(breedText);
    const sexItem = document.createElement("span");
    sexItem.className = `pig-sex-item${pig.sex === "female" ? " is-female" : ""}`;
    const sexText = document.createElement("span");
    text(sexText, `Sex: ${pig.sex || "Not recorded"}`);
    sexItem.append(sexText);
    attributes.append(breedItem, sexItem);
    const status = document.createElement("span");
    status.className = "status-label status-label-monitoring";
    text(status, pig.pig_status || "active");
    status.dataset.status = pig.pig_status || "active";
    const titleRow = document.createElement("div");
    titleRow.className = "pig-title-row";
    titleRow.append(name, status);
    identity.append(titleRow, sub, attributes);
    heading.append(identity);
    const facts = document.createElement("dl");
    facts.className = "pig-card-facts";
    [["Birth date", formatDate(pig.birth_date)], ["Age", pig.estimated_age_months ? `${pig.estimated_age_months} months` : "Not recorded"],
      ["Latest estimate", latestWeight(pig.pig_id)?.estimated_weight ? `${latestWeight(pig.pig_id).estimated_weight} kg` : "Unavailable"],
      ["Pen", (() => { const assignment = state.assignments.find((item) => Number(item.pig_id) === Number(pig.pig_id) && item.assignment_status === "active" && !item.date_removed); return getPen(assignment?.pen_id)?.pen_name || "Not assigned"; })()]
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
    detailsButton.dataset.pigDetails = "";
    detailsButton.setAttribute("aria-expanded", "false");
    detailsButton.setAttribute("aria-controls", detailId);
    detailsButton.addEventListener("click", () => showPigDetails(pig, card, detailsButton, detailId));
    actions.append(detailsButton);
    const secondary = document.createElement("div");
    secondary.className = "pig-secondary-actions";
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "button pig-delete-action";
    remove.textContent = "Delete";
    remove.addEventListener("click", async () => {
      if (!window.confirm(`Delete ${pigName(pig)} (${pig.pig_code}) permanently? This cannot be undone.`)) return;
      remove.disabled = true;
      try {
        await api(`pigs.php?id=${encodeURIComponent(pig.pig_id)}`, {method:"DELETE"});
        openDetails.delete(detailId);
        message(`${pigName(pig)} was deleted.`);
        await load();
      } catch(error) {
        message(error.message || "The pig could not be deleted. It may have linked farm records.", true);
        remove.disabled = false;
      }
    });
    secondary.append(remove);
    actions.append(secondary);
    // Generic illustrated icon: record images are not part of the current pig API.
    const illustration = document.createElement("div");
    illustration.className = "pig-record-illustration";
    illustration.setAttribute("aria-hidden", "true");
    const pigIcon = document.createElement("img");
    pigIcon.src = `${priceArtwork}/pig-thumbnail.png`;
    pigIcon.width = 204;
    pigIcon.height = 185;
    pigIcon.loading = "lazy";
    pigIcon.alt = ""; // Decorative placeholder, not a photo uploaded for this animal.
    illustration.append(pigIcon);
    card.append(illustration, heading, renderPrice(pig), facts, actions);
    if (openDetails.has(detailId)) showPigDetails(pig, card, detailsButton, detailId);
    return card;
  }

  function renderPigs() {
    const search = ($("#pig-search").value || "").trim().toLowerCase();
    const status = $("#status-filter").value;
    const filtered = state.pigs.filter((pig) => {
      const haystack = `${pigName(pig)} ${pig.pig_code} ${pig.breed}`.toLowerCase();
      return haystack.includes(search) && (status === "all" || pig.pig_status === status);
    });
    pigList.replaceChildren(...filtered.map((pig) => renderPigCard(pig)));
    $("#record-count").textContent = `${filtered.length} of ${state.pigs.length} pigs shown`;
    $("#empty-state").hidden = filtered.length !== 0;
    $("#empty-register").hidden = state.pigs.length !== 0;
    $("#empty-title").textContent = state.pigs.length ? "No pigs found" : "No pigs registered yet";
    $("#empty-description").textContent = state.pigs.length ? "Try another search or status filter." : "Register your first pig to start a farm record.";
  }

  function showPigDetails(pig, card, button, detailId) {
    const existing = card.querySelector(".pig-profile");
    if (existing) {
      existing.remove();
      openDetails.delete(detailId);
      button.textContent = "View Details";
      button.setAttribute("aria-expanded", "false");
      return;
    }
    openDetails.add(detailId);
    const panel = document.createElement("section");
    panel.className = "pig-profile";
    panel.id = detailId;
    const title = document.createElement("h4");
    title.textContent = "Pig details";
    const heading = document.createElement("div");
    heading.className = "pig-profile-heading";
    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "button button-secondary pig-profile-edit";
    edit.textContent = "Edit Pig";
    edit.addEventListener("click", () => openEditPig(pig));
    heading.append(title, edit);
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
    const priceForm = document.createElement("form");
    priceForm.className = "inline-record-form pig-detail-price-form";
    priceForm.innerHTML = `<label>Price per kilogram (PHP/kg, optional)
        <input name="pricePerKg" type="number" min="0.01" max="99999999.99" step="0.01" inputmode="decimal" placeholder="e.g. 180">
      </label>
      <button class="button button-secondary" type="submit">Save Price</button>
      <p class="pig-price-feedback" role="status" aria-live="polite"></p>`;
    const priceInput = priceForm.elements.pricePerKg;
    const priceButton = priceForm.querySelector("button");
    const feedback = priceForm.querySelector(".pig-price-feedback");
    priceInput.defaultValue = pig.price_per_kg ?? "";
    priceInput.value = priceInput.defaultValue;
    priceForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (priceButton.disabled) return;
      const price = priceInput.value;
      priceButton.disabled = true;
      priceInput.readOnly = true;
      feedback.textContent = "Saving price…";
      feedback.classList.remove("is-error");
      try {
        const result = await api(`pigs.php?id=${encodeURIComponent(pig.pig_id)}&action=price`, {
          method: "PUT",
          body: json({price_per_kg: price === "" ? null : price})
        });
        const saved = result.data.price_per_kg;
        pig.price_per_kg = saved;
        const currentPig = getPig(pig.pig_id);
        if (currentPig) currentPig.price_per_kg = saved;
        document.querySelectorAll(`[data-pig-record-id="${CSS.escape(String(pig.pig_id))}"]`).forEach((copy) => {
          copy.querySelector(".pig-price").replaceWith(renderPrice(pig));
          const otherInput = copy.querySelector(".pig-detail-price-form input");
          if (!otherInput) return;
          const hasDraft = otherInput !== priceInput && otherInput.value !== otherInput.defaultValue;
          otherInput.defaultValue = saved ?? "";
          if (!hasDraft) otherInput.value = otherInput.defaultValue;
        });
        feedback.textContent = saved === null ? "Price removed." : "Price saved.";
      } catch (error) {
        feedback.classList.add("is-error");
        feedback.textContent = error.message || "Price could not be saved.";
      } finally {
        priceInput.readOnly = false;
        priceButton.disabled = false;
      }
    });

    const recordForms = document.createElement("div");
    recordForms.className = "pig-detail-record-forms";
    recordForms.append(weightForm, priceForm);
    panel.append(heading, details, weightTitle, weights, litterTitle, litters, recordForms);
    card.append(panel);
    button.textContent = "Hide Details";
    button.setAttribute("aria-expanded", "true");
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
      if (state.expandedPen === pen.pen_id) card.classList.add("is-expanded");
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "pen-card-toggle";
      toggle.setAttribute("aria-expanded", String(state.expandedPen === pen.pen_id));
      // Compact pen summary matches the approved PigMENT design; values are from the API.
      toggle.innerHTML = `<span class="pen-card-image" aria-hidden="true"><img src="../../public/assets/my-pigs-redesign/illustrations/pig-pen-scene.png" alt=""></span>
        <span class="pen-card-main"><span class="pen-card-title"><strong class="pen-card-name"></strong><span class="pen-card-status"></span></span>
          <span class="pen-card-metrics"><span class="pen-card-pigs"><img src="../../public/assets/my-pigs-redesign/icons/svg/pig-outline.svg" alt="" aria-hidden="true"><span class="pen-card-pig-count"></span></span>
          <span class="pen-card-weight"><img src="../../public/assets/my-pigs-redesign/icons/svg/weight.svg" alt="" aria-hidden="true"><span class="pen-card-weight-value"></span></span></span>
        </span><span class="pen-card-chevron" aria-hidden="true">›</span>`;
      text(toggle.querySelector(".pen-card-name"), pen.pen_name);
      const status = toggle.querySelector(".pen-card-status");
      const isInactive = pen.pen_status && String(pen.pen_status).toLowerCase() !== "active";
      status.classList.add(isInactive ? "is-inactive" : (ids.length === 0 ? "is-empty" : "is-active"));
      status.textContent = isInactive ? "Inactive" : (ids.length ? "Active" : "Empty");
      text(toggle.querySelector(".pen-card-pig-count"), `${ids.length} ${ids.length === 1 ? "pig" : "pigs"}`);
      const capacityValue = Number(pen.capacity);
      const hasCapacity = Number.isFinite(capacityValue) && capacityValue > 0;
      text(toggle.querySelector(".pen-card-weight-value"), hasCapacity ? `${ids.length}/${capacityValue} capacity` : "No capacity set");
      toggle.setAttribute("aria-label", `${pen.pen_name}: ${ids.length} ${ids.length === 1 ? "pig" : "pigs"}${hasCapacity ? `, capacity ${capacityValue}` : ""}, ${status.textContent}. ${state.expandedPen === pen.pen_id ? "Collapse" : "Expand"} pen details`);
      toggle.addEventListener("click", () => { state.expandedPen = state.expandedPen === pen.pen_id ? null : pen.pen_id; renderPens(); });
      card.append(toggle);
      if (state.expandedPen === pen.pen_id) {
        const content = document.createElement("div");
        content.className = "pen-member-section";
        const heading = document.createElement("h4");
        heading.textContent = "Pigs inside";
        content.append(heading);
        if (!ids.length) { const empty = document.createElement("p"); empty.textContent = "No pigs assigned to this pen yet."; content.append(empty); }
        const memberGrid = document.createElement("div");
        memberGrid.className = "pen-member-pigs";
        ids.map(getPig).filter(Boolean).forEach((pig) => memberGrid.append(renderPigCard(pig, `pen-${pen.pen_id}`)));
        if (memberGrid.childElementCount) content.append(memberGrid);
        const assign = document.createElement("form");
        assign.className = "inline-record-form pen-assign-form";
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
        actions.className = "pen-card-actions pen-management-actions";
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
  // Mount registration at body level, avoiding the main content's scroll and stacking contexts.
  const registerBackdrop = $("#register-pig-backdrop");
  const registerDialog = $("#registration-panel");
  document.body.append(registerBackdrop, registerDialog);
  let registrationPreviousFocus = null;
  let registrationSaving = false;
  function showRegistrationError(errorText) {
    const box = $("#register-form-error");
    box.textContent = errorText || "Pig registration could not be completed.";
    box.hidden = false;
    box.scrollIntoView({ block: "nearest" });
  }
  function closeRegistration(force = false) {
    if (registrationSaving && !force) return;
    registerDialog.hidden = true;
    registerBackdrop.hidden = true;
    $("#register-form-error").hidden = true;
    document.body.classList.remove("register-pig-modal-open");
    if (registrationPreviousFocus?.isConnected) registrationPreviousFocus.focus({ preventScroll: true });
    registrationPreviousFocus = null;
  }
  function openRegistration() {
    registrationPreviousFocus = document.activeElement;
    $("#register-form-error").hidden = true;
    registerBackdrop.hidden = false;
    registerDialog.hidden = false;
    document.body.classList.add("register-pig-modal-open");
    registerDialog.scrollTop = 0;
    $("#pig-form").elements.pigCode.focus({ preventScroll: true });
  }
  $("#open-registration").addEventListener("click", openRegistration);
  const heroRegisterButton = $("#hero-register");
  if (heroRegisterButton) heroRegisterButton.addEventListener("click", openRegistration);
  $("#empty-register").addEventListener("click", openRegistration);
  $("#close-registration").addEventListener("click", () => closeRegistration());
  $("#cancel-registration").addEventListener("click", () => closeRegistration());
  registerBackdrop.addEventListener("click", () => closeRegistration());
  // Home dashboard links point to my-pigs.html#register-pig.
  if (window.location.hash === "#register-pig") openRegistration();
  window.addEventListener("hashchange", () => {
    if (window.location.hash === "#register-pig" && registerDialog.hidden) openRegistration();
  });
  document.addEventListener("keydown", (event) => {
    if (registerDialog.hidden) return;
    if (event.key === "Escape") { event.preventDefault(); closeRegistration(); return; }
    if (event.key !== "Tab") return;
    const focusable = [...registerDialog.querySelectorAll('button:not([disabled]), input:not([disabled]):not([tabindex="-1"]), select:not([disabled]), textarea:not([disabled])')]
      .filter((element) => element.getClientRects().length > 0);
    if (!focusable.length) {event.preventDefault();registerDialog.focus();return;}
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === registerDialog)) {event.preventDefault();last.focus();}
    else if (!event.shiftKey && document.activeElement === last) {event.preventDefault();first.focus();}
  });
  // Mount the pen dialog directly beneath <body> so the farm section's
  // layout/stacking contexts cannot trap a fixed-position modal.
  const penDialogElement = $("#pen-form");
  const penBackdropElement = $("#pen-modal-backdrop");
  document.body.append(penBackdropElement, penDialogElement);

  let penPreviousFocus = null;
  function showPenFormError(errorText) {
    const errorBox = $("#pen-modal-error");
    errorBox.textContent = errorText || "Unable to save the pig pen. Please try again.";
    errorBox.hidden = false;
  }
  function openPenForm(pen = null) {
    state.editingPenId = pen ? Number(pen.pen_id) : null;
    const form = $("#pen-form");
    penPreviousFocus = document.activeElement;
    form.reset();
    $("#pen-form-title").textContent = pen ? "Edit Pig Pen" : "Create a Pig Pen";
    $("#pen-form-description").textContent = pen
      ? "Update the pen's information and capacity. Changes will be saved to your farm account."
      : "Give the pen a name and set its maximum number of registered pigs.";
    $("#pen-form-submit").textContent = pen ? "Save Pen Changes" : "Create Pig Pen";
    $("#pen-modal-error").hidden = true;
    if (pen) {
      form.elements.penName.value = pen.pen_name || "";
      form.elements.penType.value = pen.pen_type || "General";
      form.elements.penStatus.value = pen.pen_status || "active";
      form.elements.capacity.value = pen.capacity || "";
      form.elements.description.value = pen.description || "";
    }
    $("#pen-modal-backdrop").hidden = false;
    form.hidden = false;
    document.body.classList.add("pen-modal-open");
    form.scrollTop = 0;
    form.elements.penName.focus({ preventScroll: true });
  }
  function closePenForm() {
    state.editingPenId = null;
    $("#pen-form").reset();
    $("#pen-form-title").textContent = "Create a Pig Pen";
    $("#pen-form-submit").textContent = "Create Pig Pen";
    $("#pen-modal-error").hidden = true;
    $("#pen-form").hidden = true;
    $("#pen-modal-backdrop").hidden = true;
    document.body.classList.remove("pen-modal-open");
    if (penPreviousFocus?.isConnected) penPreviousFocus.focus({ preventScroll: true });
    penPreviousFocus = null;
  }
  $("#pen-modal-backdrop").addEventListener("click", closePenForm);
  document.addEventListener("keydown", (event) => {
    const panel = $("#pen-form");
    if (panel.hidden) return;
    if (event.key === "Escape") {
      if ($("#pen-form-submit").disabled) return;
      event.preventDefault();
      closePenForm();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = [...panel.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])')]
      .filter((element) => element.getClientRects().length > 0);
    if (!focusable.length) { event.preventDefault(); panel.focus(); return; }
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === panel)) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault(); first.focus();
    }
  });
  $("#open-pen-form").addEventListener("click", () => openPenForm());
  $("#empty-create-pen").addEventListener("click", () => openPenForm());
  $("#close-pen-form").addEventListener("click", closePenForm);
  $("#cancel-pen-form").addEventListener("click", closePenForm);
  $("#open-litter-form").addEventListener("click", () => { updateLitterOptions(); $("#litter-form").hidden = false; });
  $("#close-litter-form").addEventListener("click", () => { $("#litter-form").hidden = true; });
  $("#cancel-litter-form").addEventListener("click", () => { $("#litter-form").hidden = true; });

  $("#close-edit-pig").addEventListener("click", closeEditPig);
  $("#cancel-edit-pig").addEventListener("click", closeEditPig);
  $("#edit-pig-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!editingPigId) return;
    const returnCard = editPigPreviousFocus?.closest("[data-pig-card]")?.dataset.pigCard;
    const form = new FormData(event.currentTarget);
    const save = event.currentTarget.querySelector('button[type="submit"]');
    save.disabled = true;
    try {
      await api(`pigs.php?id=${encodeURIComponent(editingPigId)}`, { method: "PUT", body: json({
        pig_code: String(form.get("pigCode") || "").trim(),
        pig_name: String(form.get("pigName") || "").trim(),
        breed: String(form.get("breed") || "").trim(),
        sex: form.get("sex"), birth_date: form.get("birthDate"),
        estimated_age_months: form.get("ageMonths"),
        pig_status: form.get("pigStatus"), notes: String(form.get("notes") || "").trim()
      }) });
      closeEditPig(true);
      message("Pig record updated successfully.");
      await load();
      const updatedCard = returnCard && $(`[data-pig-card="${CSS.escape(returnCard)}"]`);
      (updatedCard?.querySelector(".pig-profile-edit") || updatedCard?.querySelector("[data-pig-details]") || $("#pig-search")).focus({preventScroll:true});
    } catch(error) {
      const errorBox = $("#edit-pig-error");
      errorBox.textContent = error.message || "Pig changes could not be saved.";
      errorBox.hidden = false;
      errorBox.scrollIntoView({block:"nearest"});
    }
    finally { save.disabled = false; }
  });

  const registrationForm = $("#pig-form");
  const updateRegistrationEstimate = () => {
    const estimate = weightEstimator.calculateWeight(registrationForm.elements.girth.value, registrationForm.elements.namedItem("length").value, "cm");
    registrationForm.elements.estimatedWeight.value = estimate ? estimate.kilograms.toFixed(2) : "";
    $("#registration-weight-display").textContent = estimate ? `${estimate.kilograms.toFixed(2)} kg` : "— kg";
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
    if (!formElement.reportValidity() || registrationSaving) return;
    const form = new FormData(formElement);
    const saveButton = formElement.querySelector('button[type="submit"]');
    $("#register-form-error").hidden = true;
    registrationSaving = true;
    saveButton.disabled = true;
    saveButton.textContent = "Saving pig…";
    try {
      const pigResponse = await api("pigs.php", { method: "POST", body: json({ pig_code: form.get("pigCode").trim(), pig_name: form.get("pigName").trim(), breed: form.get("breed").trim(), sex: form.get("sex"), birth_date: form.get("birthDate"), estimated_age_months: form.get("ageMonths"), price_per_kg: form.get("pricePerKg"), notes: form.get("notes").trim() }) });
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
            updateRegistrationEstimate();
            closeRegistration(true);
            message(`Pig registered, but the initial measurement was not saved: ${error.message}`, true);
            await load();
            return;
          }
        }
      }
      formElement.reset();
      updateRegistrationEstimate();
      closeRegistration(true);
      message("Pig registered successfully.");
      await load();
    } catch (error) {
      showRegistrationError(error.message || "Pig registration could not be completed.");
    } finally {
      registrationSaving = false;
      saveButton.disabled = false;
      saveButton.textContent = "Register a Pig";
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
      showPenFormError("A pen with this name already exists. Choose a different name.");
      return;
    }
    try {
      const payload = { pen_name: penName, pen_type: form.get("penType"), capacity: form.get("capacity"), description: form.get("description").trim(), pen_status: form.get("penStatus") };
      await api(editingId ? `pens.php?id=${encodeURIComponent(editingId)}` : "pens.php", { method: editingId ? "PUT" : "POST", body: json(payload) });
      closePenForm();
      penMessage(editingId ? "Pen changes saved successfully." : "Pen created successfully.");
      await load();
    } catch (error) { showPenFormError(error.message); }
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
