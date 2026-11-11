const menuToggle = document.querySelector(".menu-toggle");
const sidebar = document.querySelector("#sidebar");

menuToggle.addEventListener("click", () => {
  const isExpanded = menuToggle.getAttribute("aria-expanded") === "true";
  menuToggle.setAttribute("aria-expanded", String(!isExpanded));
  sidebar.classList.toggle("open", !isExpanded);
});

sidebar.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    sidebar.classList.remove("open");
    menuToggle.setAttribute("aria-expanded", "false");
  });
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && sidebar.classList.contains("open")) {
    sidebar.classList.remove("open");
    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.focus();
  }
});

const pigList = document.querySelector("#pig-list");

if (pigList && !document.body.dataset.apiFarmPage) {
  const storageKey = "pigment-farm-records-v1";
  const storageWarning = document.querySelector("#storage-warning");
  const sampleState = {
    pigs: [
      { id: "pig-024", name: "PG-024", breed: "Landrace cross", sex: "Female", age: "8 months", weight: "Approx. 86 kg", salePrice: 16500, photo: "", status: "monitoring", notes: "", penId: "pen-01" },
      { id: "pig-rosie", name: "Rosie", breed: "Native cross", sex: "Female", age: "6 months", weight: "Approx. 58 kg", salePrice: 12500, photo: "", status: "monitoring", notes: "", penId: "pen-02" },
      { id: "pig-011", name: "PG-011", breed: "Duroc cross", sex: "Male", age: "1 year", weight: "Approx. 112 kg", salePrice: 21000, photo: "", status: "needs-review", notes: "", penId: "pen-02" },
      { id: "pig-bantay", name: "Bantay", breed: "Large White", sex: "Male", age: "10 months", weight: "Approx. 94 kg", salePrice: 18500, photo: "", status: "paused", notes: "", penId: "pen-02" },
      { id: "pig-017", name: "PG-017", breed: "Native cross", sex: "Female", age: "7 months", weight: "Approx. 71 kg", salePrice: 14200, photo: "", status: "monitoring", notes: "", penId: "pen-02" },
      { id: "pig-019", name: "PG-019", breed: "Landrace cross", sex: "Male", age: "9 months", weight: "Approx. 91 kg", salePrice: 17300, photo: "", status: "monitoring", notes: "", penId: "pen-02" }
    ],
    pens: [
      { id: "pen-01", name: "Pen 01", type: "Sow and Litter", description: "Mother sow and newborn litter", capacity: "12", status: "Active" },
      { id: "pen-02", name: "Pen 02", type: "Growing Pigs", description: "Group of growing pigs", capacity: "8", status: "Active" },
      { id: "pen-03", name: "Pen 03", type: "General", description: "Available for future use", capacity: "", status: "Empty" }
    ],
    litters: [
      { id: "litter-01", motherPigId: "pig-024", penId: "pen-01", birthDate: "2026-10-28", born: 8, alive: 8, notes: "" }
    ]
  };

  function showStorageWarning() {
    storageWarning.hidden = false;
  }

  function copySampleState() {
    return JSON.parse(JSON.stringify(sampleState));
  }

  function loadFarmState() {
    try {
      const savedState = sessionStorage.getItem(storageKey);
      if (!savedState) return copySampleState();
      const parsedState = JSON.parse(savedState);
      if (!Array.isArray(parsedState.pigs) || !Array.isArray(parsedState.pens) || !Array.isArray(parsedState.litters)) {
        throw new Error("Saved farm records have an unexpected format.");
      }
      parsedState.pigs.forEach((pig) => {
        if (/^Sample record(?: · .*)?$/i.test(pig.notes || "")) pig.notes = "";
      });
      parsedState.litters.forEach((litter) => {
        if (["Illustrative litter record.", "Fictional sample litter."].includes(litter.notes)) litter.notes = "";
      });
      return parsedState;
    } catch (error) {
      showStorageWarning();
      return copySampleState();
    }
  }

  let farmState = loadFarmState();
  const pigs = farmState.pigs;
  const pens = farmState.pens;
  const litters = farmState.litters;
  const pigSearch = document.querySelector("#pig-search");
  const statusFilter = document.querySelector("#status-filter");
  const emptyState = document.querySelector("#empty-state");
  const emptyTitle = document.querySelector("#empty-title");
  const emptyDescription = document.querySelector("#empty-description");
  const emptyRegister = document.querySelector("#empty-register");
  const recordCount = document.querySelector("#record-count");
  const interactionMessage = document.querySelector("#interaction-message");
  const registrationPanel = document.querySelector("#registration-panel");
  const pigForm = document.querySelector("#pig-form");
  const pigPhotoInput = document.querySelector("#pig-photo-input");
  const pigPhotoPreview = document.querySelector("#pig-photo-preview");
  const pigSalePriceInput = document.querySelector("#pig-sale-price");
  const pigIncomeAmount = document.querySelector("#pig-income-amount");
  const pigPhotoMaxBytes = 5 * 1024 * 1024;
  const pigPhotoMaxDimension = 1000;
  let pendingPigPhoto = "";
  const penList = document.querySelector("#pen-list");
  const penForm = document.querySelector("#pen-form");
  const pensEmpty = document.querySelector("#pens-empty");
  const litterForm = document.querySelector("#litter-form");
  const litterMother = document.querySelector("#litter-mother");
  const litterPen = document.querySelector("#litter-pen");
  const litterError = document.querySelector("#litter-error");
  const penMessage = document.querySelector("#pen-message");

  const statusLabels = {
    monitoring: "Monitoring",
    "needs-review": "Needs review",
    paused: "Paused"
  };

  function saveFarmState() {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(farmState));
      storageWarning.hidden = true;
    } catch (error) {
      showStorageWarning();
    }
  }

  function makeId(prefix) {
    return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  }

  function formatPeso(amount) {
    return `₱${Number(amount).toLocaleString("en-PH", { maximumFractionDigits: 0 })}`;
  }

  function showConfirmation(message) {
    interactionMessage.textContent = message;
    interactionMessage.hidden = false;
  }

  function showPenConfirmation(message) {
    penMessage.textContent = message;
    penMessage.hidden = false;
  }

  function getPigById(pigId) {
    return pigs.find((pig) => pig.id === pigId);
  }

  function getPenById(penId) {
    return pens.find((pen) => pen.id === penId);
  }

  function getPenPigs(penId) {
    return pigs.filter((pig) => pig.penId === penId);
  }

  function getPenLitters(penId) {
    return litters.filter((litter) => litter.penId === penId);
  }

  function getPenAnimalCount(penId) {
    const pigCount = getPenPigs(penId).length;
    const livePigletCount = getPenLitters(penId).reduce((total, litter) => total + Number(litter.alive), 0);
    return { pigCount, livePigletCount, total: pigCount + livePigletCount };
  }

  function syncPenStatus(pen) {
    const count = getPenAnimalCount(pen.id).total;
    pen.status = count > 0 ? "Active" : "Empty";
  }

  function syncAllPenStatuses() {
    pens.forEach(syncPenStatus);
  }

  function renderPigs() {
    const searchTerm = pigSearch.value.trim().toLowerCase();
    const selectedStatus = statusFilter.value;
    const filteredPigs = pigs.filter((pig) => {
      const pen = getPenById(pig.penId);
      const searchableText = `${pig.name} ${pig.breed} ${pen?.name || ""}`.toLowerCase();
      const matchesSearch = searchableText.includes(searchTerm);
      const matchesStatus = selectedStatus === "all" || pig.status === selectedStatus;
      return matchesSearch && matchesStatus;
    });

    pigList.replaceChildren();
    filteredPigs.forEach((pig) => {
      const card = document.createElement("article");
      card.className = "pig-card";
      const photo = document.createElement("div");
      photo.className = "pig-card-photo";
      if (pig.photo) {
        const image = document.createElement("img");
        image.src = pig.photo;
        image.alt = `Photo of ${pig.name}`;
        photo.append(image);
      } else {
        photo.classList.add("pig-card-photo-placeholder");
        photo.setAttribute("role", "img");
        photo.setAttribute("aria-label", `No photo added for ${pig.name}`);
        const placeholderLabel = document.createElement("span");
        placeholderLabel.textContent = "Pig photo not added";
        photo.append(placeholderLabel);
      }
      const heading = document.createElement("div");
      heading.className = "pig-card-heading";
      const identity = document.createElement("div");
      identity.className = "pig-card-identity";
      const name = document.createElement("h3");
      name.textContent = pig.name;
      const breed = document.createElement("p");
      breed.textContent = `${pig.breed} · ${pig.sex}`;
      identity.append(name, breed);

      const status = document.createElement("span");
      status.className = `status-label status-label-${pig.status === "needs-review" ? "review" : pig.status}`;
      status.textContent = statusLabels[pig.status] || "Monitoring";
      heading.append(identity, status);

      const facts = document.createElement("dl");
      facts.className = "pig-card-facts";
      const pen = getPenById(pig.penId);
      const factValues = [
        ["Age", pig.age],
        ["Weight estimate", pig.weight || "Not entered"],
        ["Pen", pen?.name || "Not assigned"]
      ];
      factValues.forEach(([label, value]) => {
        const fact = document.createElement("div");
        fact.className = "pig-card-fact";
        const term = document.createElement("dt");
        term.textContent = label;
        const detail = document.createElement("dd");
        detail.textContent = value;
        fact.append(term, detail);
        facts.append(fact);
      });
      card.append(photo, heading, facts);
      const saleValue = document.createElement("div");
      saleValue.className = "pig-card-sale-value";
      const saleLabel = document.createElement("span");
      saleLabel.textContent = "Estimated sale value";
      const saleAmount = document.createElement("strong");
      saleAmount.textContent = Number(pig.salePrice) > 0 ? formatPeso(pig.salePrice) : "No price entered";
      const saleNote = document.createElement("small");
      saleNote.textContent = "Gross estimate · costs not included";
      saleValue.append(saleLabel, saleAmount, saleNote);
      card.append(saleValue);
      if (pig.weight) {
        const weightNote = document.createElement("p");
        weightNote.className = "pig-weight-note";
        weightNote.textContent = "Estimate only · not a scale measurement";
        card.append(weightNote);
      }
      if (pig.notes) {
        const notes = document.createElement("p");
        notes.className = "pig-card-notes";
        notes.textContent = pig.notes;
        card.append(notes);
      }
      pigList.append(card);
    });

    const hasPigs = pigs.length > 0;
    const hasResults = filteredPigs.length > 0;
    emptyState.hidden = hasResults;
    emptyTitle.textContent = hasPigs ? "No pigs found" : "No pigs registered yet";
    emptyDescription.textContent = hasPigs
      ? "Try a different search or status filter."
      : "Add your first pig to start a farm record. The record will remain in this browser session.";
    emptyRegister.hidden = hasPigs;
    recordCount.textContent = hasPigs ? `${filteredPigs.length} of ${pigs.length} pigs shown` : "No pig records in this session";
    if (filteredPigs.length === 0 && hasPigs) {
      emptyDescription.textContent = "Try another name or choose a different status.";
    }
  }

  function openRegistrationForm() {
    registrationPanel.hidden = false;
    updatePigIncomePreview();
    registrationPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    pigForm.elements.name.focus();
  }

  function closeRegistrationForm() {
    pigForm.reset();
    pendingPigPhoto = "";
    pigPhotoPreview.replaceChildren();
    pigPhotoPreview.hidden = true;
    updatePigIncomePreview();
    registrationPanel.hidden = true;
  }

  function updatePigIncomePreview() {
    const salePrice = Number(pigSalePriceInput.value);
    pigIncomeAmount.textContent = salePrice > 0 ? formatPeso(salePrice) : "Add a possible sale price";
  }

  function compressPigPhoto(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("This photo could not be opened. Please choose another image."));
      reader.onload = () => {
        const image = new Image();
        image.onerror = () => reject(new Error("This photo could not be read. Please choose another image."));
        image.onload = () => {
          const scale = Math.min(1, pigPhotoMaxDimension / Math.max(image.naturalWidth, image.naturalHeight));
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
          canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
          const context = canvas.getContext("2d");
          if (!context) {
            reject(new Error("Photo preview is unavailable in this browser. You can still register the pig without a photo."));
            return;
          }
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", 0.78));
        };
        image.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  document.querySelector("#open-registration").addEventListener("click", openRegistrationForm);
  document.querySelector("#empty-register").addEventListener("click", openRegistrationForm);
  document.querySelector("#close-registration").addEventListener("click", closeRegistrationForm);
  document.querySelector("#cancel-registration").addEventListener("click", closeRegistrationForm);
  pigSearch.addEventListener("input", renderPigs);
  statusFilter.addEventListener("change", renderPigs);
  pigSalePriceInput.addEventListener("input", updatePigIncomePreview);
  pigPhotoInput.addEventListener("change", async () => {
    const file = pigPhotoInput.files[0];
    pendingPigPhoto = "";
    pigPhotoPreview.replaceChildren();
    pigPhotoPreview.hidden = true;
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      pigPhotoInput.value = "";
      showConfirmation("Choose an image file for the pig photo.");
      return;
    }
    if (file.size > pigPhotoMaxBytes) {
      pigPhotoInput.value = "";
      showConfirmation("Choose a photo smaller than 5 MB.");
      return;
    }
    try {
      pendingPigPhoto = await compressPigPhoto(file);
      const image = document.createElement("img");
      image.src = pendingPigPhoto;
      image.alt = "Preview of the selected pig photo";
      const imageName = document.createElement("span");
      imageName.textContent = file.name;
      pigPhotoPreview.append(image, imageName);
      pigPhotoPreview.hidden = false;
      showConfirmation("Photo ready. It will be kept with this pig record for this browser session.");
    } catch (error) {
      pigPhotoInput.value = "";
      showConfirmation(error.message);
    }
  });

  pigForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!pigForm.reportValidity()) return;

    const formData = new FormData(pigForm);
    const salePrice = Number(formData.get("salePrice")) || null;
    const measurements = [
      formData.get("girth") ? `Girth ${formData.get("girth")} cm` : "",
      formData.get("length") ? `Length ${formData.get("length")} cm` : ""
    ].filter(Boolean);

    pigs.unshift({
      id: makeId("pig"),
      name: formData.get("name").trim(),
      breed: formData.get("breed").trim(),
      sex: formData.get("sex"),
      age: formData.get("age").trim(),
      weight: "",
      salePrice,
      photo: pendingPigPhoto,
      status: "monitoring",
      notes: [formData.get("notes").trim(), ...measurements].filter(Boolean).join(" · ") || "Added in this session",
      penId: null
    });
    saveFarmState();
    pigSearch.value = "";
    statusFilter.value = "all";
    renderPigs();
    closeRegistrationForm();
    renderPens();
    showConfirmation(`${formData.get("name").trim()} was added to your pig records.`);
    document.querySelector("#records-title").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  function updateLitterOptions() {
    const sowPigs = pigs.filter((pig) => pig.sex === "Female");
    litterMother.replaceChildren();
    const motherPlaceholder = document.createElement("option");
    motherPlaceholder.value = "";
    motherPlaceholder.textContent = sowPigs.length ? "Choose a mother sow" : "Register a female pig first";
    litterMother.append(motherPlaceholder);
    sowPigs.forEach((pig) => {
      const option = document.createElement("option");
      option.value = pig.id;
      option.textContent = `${pig.name} · ${pig.breed}`;
      litterMother.append(option);
    });
    litterMother.disabled = sowPigs.length === 0;

    litterPen.replaceChildren();
    const penPlaceholder = document.createElement("option");
    penPlaceholder.value = "";
    penPlaceholder.textContent = "Choose a sow-and-litter pen";
    litterPen.append(penPlaceholder);
    pens.filter((pen) => pen.type === "Sow and Litter").forEach((pen) => {
      const option = document.createElement("option");
      option.value = pen.id;
      option.textContent = pen.name;
      litterPen.append(option);
    });
    litterPen.disabled = !pens.some((pen) => pen.type === "Sow and Litter");
  }

  function renderPigsInPen(pen, container) {
    const assignedPigs = getPenPigs(pen.id);
    if (!assignedPigs.length) {
      const empty = document.createElement("p");
      empty.className = "pen-members-empty";
      empty.textContent = "No individual pig records are assigned to this pen yet.";
      container.append(empty);
      return;
    }

    const list = document.createElement("ul");
    list.className = "pen-members";
    assignedPigs.forEach((pig) => {
      const item = document.createElement("li");
      const description = document.createElement("span");
      description.className = "member-description";
      const name = document.createElement("strong");
      name.textContent = pig.name;
      const breed = document.createElement("small");
      breed.textContent = `${pig.breed} · ${pig.sex}`;
      description.append(name, breed);
      item.append(description);

      const removeButton = document.createElement("button");
      removeButton.className = "button button-remove";
      removeButton.type = "button";
      removeButton.textContent = "Remove from pen";
      removeButton.setAttribute("aria-label", `Remove ${pig.name} from ${pen.name}; keep pig record`);
      removeButton.addEventListener("click", () => {
        const assignedLitter = litters.find((litter) => litter.motherPigId === pig.id && litter.penId === pen.id);
        if (assignedLitter) {
          const warning = container.querySelector(".pen-feedback");
          warning.textContent = `Move ${pig.name} and the litter together using the litter's Move litter control.`;
          warning.classList.add("is-error");
          return;
        }
        pig.penId = null;
        syncPenStatus(pen);
        saveFarmState();
        renderPigs();
        renderPens();
        showPenConfirmation(`${pig.name} was removed from ${pen.name}. The pig record is still saved in this session.`);
      });
      item.append(removeButton);
      list.append(item);
    });
    container.append(list);
  }

  function renderLittersInPen(pen, container) {
    const penLitters = getPenLitters(pen.id);
    if (!penLitters.length) return;

    const litterHeading = document.createElement("h4");
    litterHeading.className = "pen-subheading";
    litterHeading.textContent = "Litters";
    container.append(litterHeading);

    penLitters.forEach((litter) => {
      const litterCard = document.createElement("div");
      litterCard.className = "litter-card";
      const details = document.createElement("div");
      details.className = "litter-details";
      const mother = getPigById(litter.motherPigId);
      const title = document.createElement("strong");
      title.textContent = `Litter · mother ${mother?.name || "not listed"}`;
      const summary = document.createElement("span");
      summary.textContent = `${litter.born} born · ${litter.alive} currently alive · Birth date ${litter.birthDate}`;
      details.append(title, summary);
      if (litter.notes) {
        const note = document.createElement("small");
        note.textContent = litter.notes;
        details.append(note);
      }

      const moveForm = document.createElement("form");
      moveForm.className = "litter-move-form";
      const feedback = document.createElement("p");
      feedback.className = "pen-feedback";
      feedback.setAttribute("aria-live", "polite");
      const select = document.createElement("select");
      select.setAttribute("aria-label", `Choose a pen for litter with mother ${mother?.name || "not listed"}`);
      pens.filter((candidate) => candidate.type === "Sow and Litter").forEach((candidate) => {
        const option = document.createElement("option");
        option.value = candidate.id;
        option.textContent = candidate.name;
        option.selected = candidate.id === pen.id;
        select.append(option);
      });
      const moveButton = document.createElement("button");
      moveButton.className = "button button-secondary";
      moveButton.type = "submit";
      moveButton.textContent = "Move litter";
      moveForm.append(select, moveButton);
      moveForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const destination = getPenById(select.value);
        if (!destination || destination.id === pen.id) return;
        const destinationCount = getPenAnimalCount(destination.id).total;
        const motherMoves = mother && mother.penId !== destination.id ? 1 : 0;
        const capacity = Number(destination.capacity);
        const relatedLitters = mother
          ? litters.filter((relatedLitter) => relatedLitter.motherPigId === mother.id && relatedLitter.penId !== destination.id)
          : [litter];
        const pigletsMoving = relatedLitters.reduce((total, relatedLitter) => total + Number(relatedLitter.alive), 0);
        if (capacity && destinationCount + pigletsMoving + motherMoves > capacity) {
          feedback.textContent = `${destination.name} does not have enough capacity for this litter and its mother.`;
          feedback.classList.add("is-error");
          return;
        }
        relatedLitters.forEach((relatedLitter) => {
          relatedLitter.penId = destination.id;
        });
        if (mother) mother.penId = destination.id;
        syncAllPenStatuses();
        saveFarmState();
        renderPigs();
        renderPens();
        showPenConfirmation(`The litter and ${mother?.name || "the mother sow"} were moved to ${destination.name}.`);
      });
      moveForm.append(feedback);
      litterCard.append(details, moveForm);
      container.append(litterCard);
    });
  }

  function createPigAssignmentForm(pen, card) {
    const form = document.createElement("form");
    form.className = "pen-assignment-form";
    const instructions = document.createElement("p");
    instructions.textContent = "Tick the pigs for this pen. A pig selected here will move from its current pen.";
    form.append(instructions);

    const options = document.createElement("div");
    options.className = "pen-pig-options";
    pigs.forEach((pig) => {
      const optionLabel = document.createElement("label");
      optionLabel.className = "pen-pig-option";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.name = "pig";
      checkbox.value = pig.id;
      checkbox.checked = pig.penId === pen.id;
      const pigLabel = document.createElement("span");
      const pigName = document.createElement("strong");
      pigName.textContent = pig.name;
      const pigBreed = document.createElement("small");
      const currentPen = getPenById(pig.penId);
      pigBreed.textContent = currentPen && currentPen.id !== pen.id
        ? `${pig.breed} · currently in ${currentPen.name}; selecting moves it`
        : pig.breed;
      pigLabel.append(pigName, pigBreed);
      optionLabel.append(checkbox, pigLabel);
      options.append(optionLabel);
    });
    form.append(options);

    const feedback = document.createElement("p");
    feedback.className = "assignment-feedback";
    feedback.setAttribute("aria-live", "polite");
    form.append(feedback);

    const actions = document.createElement("div");
    actions.className = "assignment-actions";
    const saveButton = document.createElement("button");
    saveButton.className = "button button-primary";
    saveButton.type = "submit";
    saveButton.textContent = "Save pig assignments";
    const cancelButton = document.createElement("button");
    cancelButton.className = "button button-secondary";
    cancelButton.type = "button";
    cancelButton.textContent = "Cancel";
    cancelButton.addEventListener("click", renderPens);
    actions.append(saveButton, cancelButton);
    form.append(actions);

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const selectedPigIds = new Set(
        [...form.querySelectorAll('input[name="pig"]:checked')].map((checkbox) => checkbox.value)
      );
      const brokenLitterPair = pigs.find((pig) => {
        const hasLitterInAnotherPen = litters.some((litter) => litter.motherPigId === pig.id && litter.penId !== pen.id);
        const isLeavingLitterInThisPen = litters.some((litter) => litter.motherPigId === pig.id && litter.penId === pen.id);
        return (selectedPigIds.has(pig.id) && hasLitterInAnotherPen)
          || (!selectedPigIds.has(pig.id) && pig.penId === pen.id && isLeavingLitterInThisPen);
      });
      if (brokenLitterPair) {
        feedback.textContent = `Keep ${brokenLitterPair.name} with her litter. Use the litter's Move litter control to move them together.`;
        feedback.classList.add("is-error");
        return;
      }

      const assignedLitterCount = getPenLitters(pen.id).reduce((sum, litter) => sum + Number(litter.alive), 0);
      const capacity = Number(pen.capacity);
      if (capacity && selectedPigIds.size + assignedLitterCount > capacity) {
        const availablePigCapacity = Math.max(0, capacity - assignedLitterCount);
        feedback.textContent = `This pen holds ${capacity} animals, including piglets. Select no more than ${availablePigCapacity} individual pigs.`;
        feedback.classList.add("is-error");
        return;
      }

      const changedPenIds = new Set(pigs.filter((pig) => pig.penId && selectedPigIds.has(pig.id)).map((pig) => pig.penId));
      pigs.forEach((pig) => {
        if (selectedPigIds.has(pig.id)) pig.penId = pen.id;
        else if (pig.penId === pen.id) pig.penId = null;
      });
      changedPenIds.add(pen.id);
      changedPenIds.forEach((penId) => {
        const changedPen = getPenById(penId);
        if (changedPen) syncPenStatus(changedPen);
      });
      saveFarmState();
      renderPigs();
      renderPens();
      showPenConfirmation("Pig pen assignments were updated.");
    });

    card.append(form);
  }

  function renderPens() {
    penList.replaceChildren();
    pensEmpty.hidden = pens.length > 0;
    penList.hidden = pens.length === 0;

    pens.forEach((pen) => {
      const counts = getPenAnimalCount(pen.id);
      const card = document.createElement("article");
      card.className = `pen-card ${pen.status === "Empty" ? "pen-card-empty" : "pen-card-active"}`;

      const cardHeader = document.createElement("div");
      cardHeader.className = "pen-card-header";
      const icon = document.createElement("span");
      icon.className = "pen-card-icon";
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = "▦";
      const details = document.createElement("div");
      details.className = "pen-card-details";
      const title = document.createElement("h3");
      title.textContent = pen.name;
      const purpose = document.createElement("p");
      purpose.textContent = pen.type;
      details.append(title, purpose);
      const status = document.createElement("span");
      status.className = `status-label ${pen.status === "Empty" ? "status-label-paused" : "status-label-monitoring"}`;
      status.textContent = pen.status === "Empty" ? "Available" : "Active";
      cardHeader.append(icon, details, status);

      const summary = document.createElement("p");
      summary.className = "pen-summary";
      summary.textContent = `${counts.total} ${counts.total === 1 ? "animal" : "animals"} · ${counts.pigCount} ${counts.pigCount === 1 ? "individual pig" : "individual pigs"}${counts.livePigletCount ? ` + ${counts.livePigletCount} piglets in litter group` : ""}${pen.capacity ? ` · Capacity ${pen.capacity}` : ""}`;
      const pricedPigs = getPenPigs(pen.id).filter((pig) => Number(pig.salePrice) > 0);
      const estimatedValue = pricedPigs.reduce((total, pig) => total + Number(pig.salePrice), 0);
      const valueSummary = document.createElement("div");
      valueSummary.className = "pen-estimated-value";
      const valueLabel = document.createElement("span");
      valueLabel.textContent = "Estimated value of pigs with a price";
      const valueAmount = document.createElement("strong");
      valueAmount.textContent = pricedPigs.length ? formatPeso(estimatedValue) : "No pig prices entered";
      const valueNote = document.createElement("small");
      valueNote.textContent = pricedPigs.length
        ? `${pricedPigs.length} individually priced ${pricedPigs.length === 1 ? "pig" : "pigs"} · gross estimate, not profit`
        : "Enter a sale price in an individual pig record to see an estimate.";
      valueSummary.append(valueLabel, valueAmount, valueNote);
      const description = document.createElement("p");
      description.className = "pen-card-description";
      description.textContent = pen.description || (pen.status === "Empty" ? "This pen is ready for pigs." : "No additional description.");

      const members = document.createElement("div");
      members.className = "pen-member-section";
      const penFeedback = document.createElement("p");
      penFeedback.className = "pen-feedback";
      penFeedback.setAttribute("aria-live", "polite");
      members.append(penFeedback);
      const memberHeading = document.createElement("h4");
      memberHeading.className = "pen-subheading";
      memberHeading.textContent = "Pigs in this pen";
      members.append(memberHeading);
      renderPigsInPen(pen, members);
      renderLittersInPen(pen, members);

      const actions = document.createElement("div");
      actions.className = "pen-card-actions";
      const assignButton = document.createElement("button");
      assignButton.className = "button button-secondary";
      assignButton.type = "button";
      assignButton.textContent = "Add or move pigs";
      assignButton.addEventListener("click", () => {
        if (card.querySelector(".pen-assignment-form")) {
          renderPens();
          return;
        }
        createPigAssignmentForm(pen, card);
      });
      actions.append(assignButton);

      if (pen.type === "Sow and Litter") {
        const litterButton = document.createElement("button");
        litterButton.className = "button button-secondary";
        litterButton.type = "button";
        litterButton.textContent = "Record a litter";
        litterButton.addEventListener("click", () => openLitterForm(pen.id));
        actions.append(litterButton);
      }

      card.append(cardHeader, summary, valueSummary, description, members, actions);
      penList.append(card);
    });
  }

  function openPenForm() {
    penForm.hidden = false;
    penForm.scrollIntoView({ behavior: "smooth", block: "start" });
    penForm.elements.penName.focus();
  }

  function closePenForm() {
    penForm.reset();
    penForm.hidden = true;
  }

  function openLitterForm(preselectedPenId = "") {
    updateLitterOptions();
    litterForm.hidden = false;
    litterError.hidden = true;
    if (preselectedPenId) litterPen.value = preselectedPenId;
    litterForm.scrollIntoView({ behavior: "smooth", block: "start" });
    litterMother.focus();
  }

  function closeLitterForm() {
    litterForm.reset();
    litterForm.hidden = true;
    litterError.hidden = true;
  }

  document.querySelector("#open-pen-form").addEventListener("click", openPenForm);
  document.querySelector("#empty-create-pen").addEventListener("click", openPenForm);
  document.querySelector("#close-pen-form").addEventListener("click", closePenForm);
  document.querySelector("#cancel-pen-form").addEventListener("click", closePenForm);
  document.querySelector("#open-litter-form").addEventListener("click", () => openLitterForm());
  document.querySelector("#close-litter-form").addEventListener("click", closeLitterForm);
  document.querySelector("#cancel-litter-form").addEventListener("click", closeLitterForm);

  penForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!penForm.reportValidity()) return;

    const formData = new FormData(penForm);
    const pen = {
      id: makeId("pen"),
      name: formData.get("penName").trim(),
      type: formData.get("penType"),
      description: formData.get("description").trim(),
      capacity: formData.get("capacity"),
      status: formData.get("penStatus")
    };
    pens.unshift(pen);
    saveFarmState();
    renderPens();
    updateLitterOptions();
    closePenForm();
    showPenConfirmation(`${pen.name} was created.`);
  });

  litterForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!litterForm.reportValidity()) return;

    const formData = new FormData(litterForm);
    const born = Number(formData.get("born"));
    const alive = Number(formData.get("alive"));
    const pen = getPenById(formData.get("penId"));
    const mother = getPigById(formData.get("motherPigId"));
    if (alive > born) {
      litterError.textContent = "The number currently alive cannot be greater than the number born.";
      litterError.hidden = false;
      return;
    }
    if (!pen || !mother || mother.sex !== "Female") {
      litterError.textContent = "Choose a mother sow and a valid Sow and Litter pen.";
      litterError.hidden = false;
      return;
    }
    const sowHasLitterInAnotherPen = litters.some(
      (existingLitter) => existingLitter.motherPigId === mother.id && existingLitter.penId !== pen.id
    );
    if (sowHasLitterInAnotherPen) {
      litterError.textContent = "This sow already has a litter in another pen. Move her existing litter group first.";
      litterError.hidden = false;
      return;
    }

    const currentCount = getPenAnimalCount(pen.id).total;
    const motherAddsOne = mother.penId === pen.id ? 0 : 1;
    const capacity = Number(pen.capacity);
    if (capacity && currentCount + motherAddsOne + alive > capacity) {
      litterError.textContent = `${pen.name} does not have enough capacity for the sow and ${alive} live piglets.`;
      litterError.hidden = false;
      return;
    }

    const litter = {
      id: makeId("litter"),
      motherPigId: mother.id,
      penId: pen.id,
      birthDate: formData.get("birthDate"),
      born,
      alive,
      notes: formData.get("notes").trim()
    };
    const previousMotherPen = getPenById(mother.penId);
    litters.unshift(litter);
    mother.penId = pen.id;
    syncPenStatus(pen);
    if (previousMotherPen && previousMotherPen.id !== pen.id) syncPenStatus(previousMotherPen);
    saveFarmState();
    renderPigs();
    renderPens();
    closeLitterForm();
    showPenConfirmation(`Litter recorded and assigned to ${pen.name}.`);
  });

  renderPigs();
  renderPens();
  updateLitterOptions();

  if (window.location.hash === "#register-pig") openRegistrationForm();
  if (window.location.hash === "#pig-pens") document.querySelector("#pig-pens").scrollIntoView();
}

const listingGrid = document.querySelector("#listing-grid");

if (listingGrid && !document.body.dataset.apiMarketplacePage) {
  const listings = [
    { id: "sample-01", title: "Healthy native cross grower", type: "Grower", breed: "Native cross", sex: "Male", age: "6 months", weight: 52, price: 8200, location: "Laylay, Boac", municipality: "Boac", seller: "Aling Nena", description: "A healthy, active young grower raised on our family farm. Eating well and used to being around people.", art: "green" },
    { id: "sample-02", title: "Pair of sturdy weaners", type: "Piglet", breed: "Landrace cross", sex: "Female", age: "10 weeks", weight: 18, price: 4600, location: "Pangi, Gasan", municipality: "Gasan", seller: "Mang Lito", description: "Two lively weaners from a healthy litter. Both are eating well and ready for a new home.", art: "teal" },
    { id: "sample-03", title: "Good-size Duroc cross", type: "Grower", breed: "Duroc cross", sex: "Male", age: "8 months", weight: 86, price: 14200, location: "Sumangga, Mogpog", municipality: "Mogpog", seller: "Rosa M.", description: "Strong Duroc cross raised with care. Weight is estimated; happy to share more details in person.", art: "amber" },
    { id: "sample-04", title: "Young native gilt", type: "Gilt", breed: "Native cross", sex: "Female", age: "7 months", weight: 68, price: 11800, location: "Balanacan, Mogpog", municipality: "Mogpog", seller: "Tatay Ben", description: "Calm young gilt with a good appetite. Raised on a small family farm in Mogpog.", art: "green" },
    { id: "sample-05", title: "Large White breeding sow", type: "Sow", breed: "Large White", sex: "Female", age: "1 year, 4 months", weight: 145, price: 24500, location: "Poctoy, Torrijos", municipality: "Torrijos", seller: "Liza Farm", description: "Gentle, well-cared-for sow. Please note the displayed weight is an estimate, not a scale reading.", art: "teal" },
    { id: "sample-06", title: "Healthy young boar", type: "Boar", breed: "Landrace cross", sex: "Male", age: "11 months", weight: 108, price: 19800, location: "Masiga, Buenavista", municipality: "Buenavista", seller: "Jun & Family", description: "Active young boar raised locally. Buyer is welcome to arrange a visit with the farmer.", art: "amber" }
  ];
  const listView = document.querySelector("#list-view");
  const detailView = document.querySelector("#detail-view");
  const formView = document.querySelector("#form-view");
  const previewView = document.querySelector("#preview-view");
  const searchInput = document.querySelector("#market-search");
  const typeFilter = document.querySelector("#type-filter");
  const breedFilter = document.querySelector("#breed-filter");
  const weightFilter = document.querySelector("#weight-filter");
  const locationFilter = document.querySelector("#location-filter");
  const emptyState = document.querySelector("#market-empty");
  const listingCount = document.querySelector("#listing-count");
  const marketMessage = document.querySelector("#market-message");
  const listingForm = document.querySelector("#listing-form");
  const formMessage = document.querySelector("#form-message");
  const fileInput = document.querySelector("#listing-image");
  const uploadPreview = document.querySelector("#upload-preview");
  const uploadArea = document.querySelector("#upload-area");
  const imageLimit = 5 * 1024 * 1024;
  let pendingListing = null;
  let uploadedImageUrl = "";

  function makePigArtwork(art) {
    const artwork = document.createElement("div");
    artwork.className = `listing-art listing-art-${art || "green"}`;
    artwork.setAttribute("role", "img");
    artwork.setAttribute("aria-label", "Illustration of a pig on a local farm");
    artwork.innerHTML = '<svg aria-hidden="true" viewBox="0 0 520 300" focusable="false"><path class="art-sun" d="M426 63a31 31 0 1 0 0-62 31 31 0 0 0 0 62Z"/><path class="art-hill-back" d="M0 193 101 109l94 77 103-109 143 122 79-54v155H0Z"/><path class="art-hill-front" d="m0 217 113-64 92 64 111-81 101 78 103-51v137H0Z"/><path class="art-fence" d="M22 182v88m44-113v113m-42-78h43m-43 35h43m337-48v76m43-102v102m-42-67h43m-43 34h43"/><g class="art-pig"><path d="M143 210c2-42 34-71 88-71 37 0 65 13 80 38l29 2c16 1 27 13 27 28 0 16-13 28-29 28h-20c-11 20-30 30-58 30h-68c-39 0-65-20-65-55Z"/><path class="art-ear" d="m178 151 7-39c2-8 10-10 15-3l29 32m45 2 27-29c6-6 14-4 15 5l3 38"/><path class="art-leg" d="M170 230v38h25v-31m101 0v31h25v-42"/><path class="art-snout" d="M340 186h34c14 0 23 9 23 21s-9 21-23 21h-37"/><circle class="art-eye" cx="319" cy="169" r="4"/><path class="art-smile" d="M145 203c-11-3-15-13-9-20m-1 0c-8 5-8 13-1 18"/></g><path class="art-ground" d="M0 266c89-12 159 3 239-3s167-13 281 3v34H0Z"/></svg><span class="listing-art-caption">A local farm · Marinduque</span>';
    return artwork;
  }

  function makeListingImage(listing, large = false) {
    if (listing.imageUrl) {
      const wrapper = document.createElement("div");
      wrapper.className = `listing-photo${large ? " listing-photo-large" : ""}`;
      const image = document.createElement("img");
      image.src = listing.imageUrl;
      image.alt = listing.title;
      wrapper.append(image);
      return wrapper;
    }
    const artwork = makePigArtwork(listing.art);
    if (large) artwork.classList.add("listing-art-large");
    return artwork;
  }

  function formatPrice(price) {
    return `₱${Number(price).toLocaleString("en-PH")}`;
  }

  function makeFact(label, value, emphasized = false) {
    const item = document.createElement("div");
    item.className = "listing-fact";
    const term = document.createElement("span");
    term.textContent = label;
    const detail = document.createElement("strong");
    detail.textContent = value;
    if (emphasized) detail.className = "listing-price";
    item.append(term, detail);
    return item;
  }

  function populateOptions(select, values) {
    values.sort((first, second) => first.localeCompare(second)).forEach((value) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      select.append(option);
    });
  }

  function renderListings() {
    const searchTerm = searchInput.value.trim().toLowerCase();
    const type = typeFilter.value;
    const breed = breedFilter.value;
    const location = locationFilter.value;
    const weightRange = weightFilter.value;
    const filtered = listings.filter((listing) => {
      const matchesSearch = `${listing.title} ${listing.type} ${listing.breed} ${listing.location} ${listing.seller}`.toLowerCase().includes(searchTerm);
      const matchesType = type === "all" || listing.type.toLowerCase() === type;
      const matchesBreed = breed === "all" || listing.breed === breed;
      const matchesLocation = location === "all" || listing.municipality === location;
      const matchesWeight = weightRange === "all"
        || (weightRange === "under-40" && listing.weight < 40)
        || (weightRange === "40-80" && listing.weight >= 40 && listing.weight <= 80)
        || (weightRange === "80-120" && listing.weight > 80 && listing.weight <= 120)
        || (weightRange === "over-120" && listing.weight > 120);
      return matchesSearch && matchesType && matchesBreed && matchesLocation && matchesWeight;
    });

    listingGrid.replaceChildren();
    filtered.forEach((listing) => {
      const card = document.createElement("article");
      card.className = "listing-card";
      card.append(makeListingImage(listing));
      const content = document.createElement("div");
      content.className = "listing-card-content";
      const topLine = document.createElement("div");
      topLine.className = "listing-card-topline";
      const typeLabel = document.createElement("span");
      typeLabel.className = "listing-type-label";
      typeLabel.textContent = listing.type;
      const price = document.createElement("strong");
      price.className = "listing-price";
      price.textContent = formatPrice(listing.price);
      topLine.append(typeLabel, price);
      const title = document.createElement("h3");
      title.textContent = listing.title;
      const breedName = document.createElement("p");
      breedName.className = "listing-breed";
      breedName.textContent = listing.breed;
      const facts = document.createElement("div");
      facts.className = "listing-card-facts";
      facts.append(makeFact("Age", listing.age), makeFact("Estimated weight", `~${listing.weight} kg`));
      const locationLine = document.createElement("p");
      locationLine.className = "listing-location";
      locationLine.innerHTML = '<span aria-hidden="true">⌖</span>';
      const locationText = document.createElement("span");
      locationText.textContent = listing.location;
      locationLine.append(locationText);
      const sellerLine = document.createElement("p");
      sellerLine.className = "listing-seller";
      sellerLine.textContent = `Listed by ${listing.seller}`;
      const viewButton = document.createElement("button");
      viewButton.className = "button button-secondary listing-view-button";
      viewButton.type = "button";
      viewButton.textContent = "View Listing";
      viewButton.addEventListener("click", () => showListingDetails(listing));
      content.append(topLine, title, breedName, facts, locationLine, sellerLine, viewButton);
      card.append(content);
      listingGrid.append(card);
    });

    listingCount.textContent = `${filtered.length} ${filtered.length === 1 ? "listing" : "listings"}`;
    emptyState.hidden = filtered.length !== 0;
  }

  function showView(activeView, focusTarget) {
    [listView, detailView, formView, previewView].forEach((view) => {
      view.hidden = view !== activeView;
    });
    if (focusTarget) focusTarget.focus();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function showListingDetails(listing) {
    const content = document.querySelector("#detail-content");
    content.replaceChildren();
    const imagePanel = document.createElement("div");
    imagePanel.className = "market-detail-image";
    imagePanel.append(makeListingImage(listing, true));

    const detailCopy = document.createElement("div");
    detailCopy.className = "market-detail-copy";
    const kicker = document.createElement("p");
    kicker.className = "market-section-kicker";
    kicker.textContent = `Listed by ${listing.seller}`;
    const title = document.createElement("h1");
    title.id = "detail-title";
    title.textContent = listing.title;
    const typeLabel = document.createElement("span");
    typeLabel.className = "listing-type-label";
    typeLabel.textContent = listing.type;
    const price = document.createElement("p");
    price.className = "market-detail-price";
    price.textContent = formatPrice(listing.price);
    const priceHint = document.createElement("span");
    priceHint.textContent = "Asking price";
    const facts = document.createElement("div");
    facts.className = "market-detail-facts";
    facts.append(
      makeFact("Breed", listing.breed),
      makeFact("Sex", listing.sex),
      makeFact("Age", listing.age),
      makeFact("Estimated weight", `~${listing.weight} kg`),
      makeFact("Location", listing.location)
    );
    const descriptionHeading = document.createElement("h2");
    descriptionHeading.textContent = "About this pig";
    const description = document.createElement("p");
    description.className = "market-detail-description";
    description.textContent = listing.description;
    const seller = document.createElement("div");
    seller.className = "market-seller-card";
    const sellerMark = document.createElement("span");
    sellerMark.className = "market-seller-avatar";
    sellerMark.setAttribute("aria-hidden", "true");
    sellerMark.textContent = listing.seller.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
    const sellerName = document.createElement("div");
    const sellerTitle = document.createElement("strong");
    sellerTitle.textContent = listing.seller;
    const sellerLocation = document.createElement("span");
    sellerLocation.textContent = `Local farmer · ${listing.municipality}`;
    sellerName.append(sellerTitle, sellerLocation);
    seller.append(sellerMark, sellerName);
    detailCopy.append(kicker, title, typeLabel, price, priceHint, facts, descriptionHeading, description, seller);
    content.append(imagePanel, detailCopy);
    showView(detailView, document.querySelector("#detail-back"));
  }

  function setFormMessage(message) {
    formMessage.textContent = message;
    formMessage.hidden = !message;
  }

  function clearUploadedImage() {
    if (uploadedImageUrl) URL.revokeObjectURL(uploadedImageUrl);
    uploadedImageUrl = "";
    fileInput.value = "";
    uploadPreview.replaceChildren();
    uploadPreview.hidden = true;
    uploadArea.classList.remove("has-image");
  }

  function cancelListingForm() {
    listingForm.reset();
    clearUploadedImage();
    setFormMessage("");
    showView(listView, document.querySelector("#post-listing"));
  }

  function updateImagePreview(file) {
    uploadPreview.replaceChildren();
    uploadPreview.hidden = !file;
    uploadArea.classList.toggle("has-image", Boolean(file));
    if (!file) return;
    const image = document.createElement("img");
    image.src = uploadedImageUrl;
    image.alt = "Selected listing photo preview";
    uploadPreview.append(image);
  }

  function showListingPreview() {
    const formData = new FormData(listingForm);
    const price = Number(formData.get("price"));
    const weight = Number(formData.get("weight"));
    pendingListing = {
      id: `local-${Date.now()}`,
      title: formData.get("title").trim(),
      type: formData.get("type"),
      breed: formData.get("breed").trim(),
      sex: formData.get("sex"),
      age: formData.get("age").trim(),
      weight,
      price,
      location: formData.get("location").trim(),
      municipality: formData.get("location").trim().split(",").pop().trim(),
      seller: "Your farm",
      description: formData.get("description").trim(),
      imageUrl: uploadedImageUrl,
      art: "teal"
    };
    const preview = document.querySelector("#listing-preview");
    preview.replaceChildren();
    const previewCard = document.createElement("article");
    previewCard.className = "listing-card market-preview-card";
    previewCard.append(makeListingImage(pendingListing));
    const previewContent = document.createElement("div");
    previewContent.className = "listing-card-content";
    const topLine = document.createElement("div");
    topLine.className = "listing-card-topline";
    const typeLabel = document.createElement("span");
    typeLabel.className = "listing-type-label";
    typeLabel.textContent = pendingListing.type;
    const listingPrice = document.createElement("strong");
    listingPrice.className = "listing-price";
    listingPrice.textContent = formatPrice(pendingListing.price);
    topLine.append(typeLabel, listingPrice);
    const title = document.createElement("h2");
    title.textContent = pendingListing.title;
    const breed = document.createElement("p");
    breed.className = "listing-breed";
    breed.textContent = pendingListing.breed;
    const facts = document.createElement("div");
    facts.className = "listing-card-facts";
    facts.append(makeFact("Age", pendingListing.age), makeFact("Estimated weight", `~${pendingListing.weight} kg`));
    const location = document.createElement("p");
    location.className = "listing-location";
    location.textContent = pendingListing.location;
    const seller = document.createElement("p");
    seller.className = "listing-seller";
    seller.textContent = "Your listing";
    previewContent.append(topLine, title, breed, facts, location, seller);
    previewCard.append(previewContent);
    preview.append(previewCard);
    showView(previewView, document.querySelector("#preview-back"));
  }

  function resetFilters() {
    searchInput.value = "";
    typeFilter.value = "all";
    breedFilter.value = "all";
    weightFilter.value = "all";
    locationFilter.value = "all";
    renderListings();
  }

  populateOptions(breedFilter, [...new Set(listings.map((listing) => listing.breed))]);
  populateOptions(locationFilter, [...new Set(listings.map((listing) => listing.municipality))]);
  [searchInput, typeFilter, breedFilter, weightFilter, locationFilter].forEach((control) => {
    control.addEventListener("input", renderListings);
    control.addEventListener("change", renderListings);
  });
  document.querySelector("#reset-filters").addEventListener("click", resetFilters);
  document.querySelector("#empty-reset").addEventListener("click", resetFilters);
  document.querySelector("#post-listing").addEventListener("click", () => {
    setFormMessage("");
    showView(formView, listingForm.elements.namedItem("title"));
  });
  document.querySelector("#detail-back").addEventListener("click", () => showView(listView, document.querySelector("#post-listing")));
  document.querySelector("#form-back").addEventListener("click", cancelListingForm);
  document.querySelector("#cancel-listing").addEventListener("click", cancelListingForm);
  document.querySelector("#preview-back").addEventListener("click", () => showView(formView, listingForm.elements.namedItem("title")));
  document.querySelector("#edit-listing").addEventListener("click", () => showView(formView, listingForm.elements.namedItem("title")));
  document.querySelector("#save-listing").addEventListener("click", () => {
    if (!pendingListing) return;
    listings.unshift(pendingListing);
    pendingListing = null;
    listingForm.reset();
    uploadedImageUrl = "";
    uploadPreview.replaceChildren();
    uploadPreview.hidden = true;
    uploadArea.classList.remove("has-image");
    renderListings();
    marketMessage.textContent = "Listing added to this page for this session. It has not been published.";
    marketMessage.hidden = false;
    showView(listView, document.querySelector("#post-listing"));
  });

  fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (uploadedImageUrl) URL.revokeObjectURL(uploadedImageUrl);
    uploadedImageUrl = "";
    if (!file) {
      updateImagePreview(null);
      return;
    }
    if (!file.type.startsWith("image/")) {
      fileInput.value = "";
      updateImagePreview(null);
      setFormMessage("Choose an image file to add a photo.");
      return;
    }
    if (file.size > imageLimit) {
      fileInput.value = "";
      updateImagePreview(null);
      setFormMessage("That photo is larger than 5 MB. Choose a smaller image.");
      return;
    }
    setFormMessage("");
    uploadedImageUrl = URL.createObjectURL(file);
    updateImagePreview(file);
  });

  listingForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!listingForm.reportValidity()) {
      setFormMessage("Please fill in the required details before previewing your listing.");
      return;
    }
    setFormMessage("");
    showListingPreview();
  });

  renderListings();
}