(function () {
  const grid = document.querySelector("#listing-grid");
  if (!grid) return;

  const apiBase = "../../api/";
  const listView = document.querySelector("#list-view");
  const detailView = document.querySelector("#detail-view");
  const formView = document.querySelector("#form-view");
  const previewView = document.querySelector("#preview-view");
  const search = document.querySelector("#market-search");
  const typeFilter = document.querySelector("#type-filter");
  const breedFilter = document.querySelector("#breed-filter");
  const weightFilter = document.querySelector("#weight-filter");
  const locationFilter = document.querySelector("#location-filter");
  const filterPanel = document.querySelector(".market-filter-panel");
  const resultsHeading = document.querySelector(".market-results-heading");
  const count = document.querySelector("#listing-count");
  const message = document.querySelector("#market-message");
  const retry = document.querySelector("#market-retry");
  const empty = document.querySelector("#market-empty");
  const form = document.querySelector("#listing-form");
  const formMessage = document.querySelector("#form-message");
  const fileInput = document.querySelector("#listing-image");
  const previewImage = document.querySelector("#upload-preview");
  const uploadArea = document.querySelector("#upload-area");
  const imageLimit = 5 * 1024 * 1024;
  let listings = [];
  let mine = [];
  let editingId = null;
  let pending = null;
  let imageUrl = "";
  let activeTab = "browse";
  let currentUser = null;

  function showMessage(text, isError = false) {
    message.textContent = text;
    message.hidden = !text;
    message.classList.toggle("is-error", isError);
  }

  function showFormMessage(text) {
    formMessage.textContent = text;
    formMessage.hidden = !text;
  }

  async function request(path, options = {}) {
    const response = await fetch(`${apiBase}${path}`, {
      credentials: "same-origin",
      ...options,
      headers: { Accept: "application/json", ...(options.headers || {}) }
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload || payload.status !== "success") {
      const error = new Error(payload?.message || "The Marketplace request failed.");
      error.status = response.status;
      throw error;
    }
    return payload;
  }

  async function secureRequest(path, options = {}) {
    const token = await window.PigmentAuth.getCsrfToken();
    return request(path, {
      ...options,
      headers: { "X-CSRF-Token": token, ...(options.headers || {}) }
    });
  }

  function formatPrice(value) {
    return `₱${Number(value || 0).toLocaleString("en-PH", { maximumFractionDigits: 2 })}`;
  }

  function formatAge(value) {
    if (value === null || value === undefined || value === "") return "Not provided";
    return `${Number(value)} months`;
  }

  function imagePath(path) {
    if (!path || typeof path !== "string") return "";
    if (/^https?:\/\//i.test(path) || path.startsWith("/")) return path;
    return `../../${path.replace(/^\.?\//, "")}`;
  }

  function artwork() {
    const element = document.createElement("div");
    element.className = "listing-art listing-art-green";
    element.setAttribute("role", "img");
    element.setAttribute("aria-label", "Pig illustration");
    element.innerHTML = '<svg aria-hidden="true" viewBox="0 0 520 300"><path class="art-sun" d="M426 63a31 31 0 1 0 0-62 31 31 0 0 0 0 62Z"/><path class="art-hill-back" d="M0 193 101 109l94 77 103-109 143 122 79-54v155H0Z"/><path class="art-hill-front" d="m0 217 113-64 92 64 111-81 101 78 103-51v137H0Z"/><g class="art-pig"><path d="M143 210c2-42 34-71 88-71 37 0 65 13 80 38l29 2c16 1 27 13 27 28 0 16-13 28-29 28h-20c-11 20-30 30-58 30h-68c-39 0-65-20-65-55Z"/><circle class="art-eye" cx="319" cy="169" r="4"/></g></svg><span class="listing-art-caption">PigMENT Marketplace</span>';
    return element;
  }

  function listingImage(listing, large = false) {
    const path = imagePath(listing.primary_image || listing.image_path);
    if (!path) {
      const fallback = artwork();
      if (large) fallback.classList.add("listing-art-large");
      return fallback;
    }
    const wrapper = document.createElement("div");
    wrapper.className = `listing-photo${large ? " listing-photo-large" : ""}`;
    const image = document.createElement("img");
    image.src = path;
    image.alt = listing.listing_title || "Marketplace listing";
    image.loading = "lazy";
    image.onerror = () => wrapper.replaceChildren(artwork());
    wrapper.append(image);
    return wrapper;
  }

  function fact(label, value) {
    const item = document.createElement("div");
    item.className = "listing-fact";
    const term = document.createElement("span");
    term.textContent = label;
    const detail = document.createElement("strong");
    detail.textContent = value;
    item.append(term, detail);
    return item;
  }

  function locationText(listing) {
    return [listing.barangay, listing.municipality].filter(Boolean).join(", ");
  }

  function card(listing, owned = false) {
    const article = document.createElement("article");
    article.className = "listing-card";
    article.append(listingImage(listing));
    const content = document.createElement("div");
    content.className = "listing-card-content";
    const top = document.createElement("div");
    top.className = "listing-card-topline";
    const type = document.createElement("span");
    type.className = "listing-type-label";
    type.textContent = listing.pig_type || "Pig";
    const price = document.createElement("strong");
    price.className = "listing-price";
    price.textContent = formatPrice(listing.asking_price);
    top.append(type, price);
    const title = document.createElement("h3");
    title.textContent = listing.listing_title;
    const breed = document.createElement("p");
    breed.className = "listing-breed";
    breed.textContent = listing.breed;
    const facts = document.createElement("div");
    facts.className = "listing-card-facts";
    facts.append(fact("Age", formatAge(listing.age_months)), fact("Estimated weight", listing.estimated_weight ? `~${listing.estimated_weight} kg` : "Not provided"));
    const location = document.createElement("p");
    location.className = "listing-location";
    location.textContent = locationText(listing) || "Location not provided";
    const seller = document.createElement("p");
    seller.className = "listing-seller";
    seller.textContent = owned ? `Status: ${statusLabel(listing.listing_status)}` : `Listed by ${[listing.seller_first_name, listing.seller_last_name].filter(Boolean).join(" ") || "Farmer"}`;
    const view = document.createElement("button");
    view.className = "button button-secondary listing-view-button";
    view.type = "button";
    view.textContent = owned ? "View Details" : "View Listing";
    view.addEventListener("click", () => showDetails(listing, owned));
    content.append(top, title, breed, facts, location, seller, view);
    if (owned) content.append(managementActions(listing));
    article.append(content);
    return article;
  }

  function statusLabel(status) {
    return { active: "Active", sold: "Sold", inactive: "Unavailable" }[status] || status;
  }

  function managementActions(listing) {
    const actions = document.createElement("div");
    actions.className = "market-management-actions";
    if (listing.listing_status === "active") {
      actions.append(actionButton("Edit Post", () => beginEdit(listing)), actionButton("Mark as Sold", () => changeStatus(listing, "sold")), actionButton("Mark as Unavailable", () => changeStatus(listing, "inactive")));
    } else if (listing.listing_status === "inactive") {
      actions.append(actionButton("Edit Post", () => beginEdit(listing)), actionButton("Make Available Again", () => changeStatus(listing, "active")), actionButton("Remove from Marketplace", () => removeListing(listing)));
    } else {
      actions.append(actionButton("Edit Post", () => beginEdit(listing)));
    }
    return actions;
  }

  function actionButton(label, handler) {
    const button = document.createElement("button");
    button.className = "button button-secondary";
    button.type = "button";
    button.textContent = label;
    button.addEventListener("click", handler);
    return button;
  }

  function filterOptions() {
    const breeds = [...new Set(listings.map((item) => item.breed).filter(Boolean))].sort();
    const locations = [...new Set(listings.map((item) => item.municipality).filter(Boolean))].sort();
    breedFilter.replaceChildren(new Option("All breeds", "all"), ...breeds.map((item) => new Option(item, item)));
    locationFilter.replaceChildren(new Option("All locations", "all"), ...locations.map((item) => new Option(item, item)));
  }

  function filteredListings() {
    const term = search.value.trim().toLowerCase();
    return listings.filter((listing) => {
      const text = [listing.listing_title, listing.pig_type, listing.breed, listing.municipality, listing.barangay].join(" ").toLowerCase();
      const weight = Number(listing.estimated_weight);
      const weightMatch = weightFilter.value === "all" || (weightFilter.value === "under-40" && weight < 40) || (weightFilter.value === "40-80" && weight >= 40 && weight <= 80) || (weightFilter.value === "80-120" && weight > 80 && weight <= 120) || (weightFilter.value === "over-120" && weight > 120);
      return text.includes(term) && (typeFilter.value === "all" || listing.pig_type.toLowerCase() === typeFilter.value) && (breedFilter.value === "all" || listing.breed === breedFilter.value) && (locationFilter.value === "all" || listing.municipality === locationFilter.value) && weightMatch;
    });
  }

  function renderBrowse() {
    const visible = filteredListings();
    grid.replaceChildren(...visible.map((listing) => card(listing)));
    count.textContent = `${visible.length} ${visible.length === 1 ? "listing" : "listings"}`;
    empty.hidden = visible.length > 0;
    if (listings.length >= 50) showMessage("Showing up to 50 active listings. Use filters to narrow the results.");
  }

  function renderMine() {
    const status = document.createElement("div");
    status.className = "market-status-tabs";
    ["active", "sold", "inactive"].forEach((value) => {
      const button = actionButton(`${statusLabel(value)} (${mine.filter((item) => item.listing_status === value).length})`, () => renderMineListings(value));
      button.dataset.status = value;
      status.append(button);
    });
    grid.replaceChildren(status);
    renderMineListings("active");
  }

  function renderMineListings(status) {
    const old = grid.querySelector(".market-owned-list");
    if (old) old.remove();
    const list = document.createElement("div");
    list.className = "market-owned-list";
    const items = mine.filter((listing) => listing.listing_status === status);
    if (!items.length) {
      const note = document.createElement("p");
      note.className = "market-empty-state";
      note.textContent = `You have no ${statusLabel(status).toLowerCase()} listings.`;
      list.append(note);
    } else {
      list.append(...items.map((listing) => card(listing, true)));
    }
    grid.append(list);
  }

  function showView(view, focus) {
    [listView, detailView, formView, previewView].forEach((item) => { item.hidden = item !== view; });
    if (focus) focus.focus();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function showDetails(listing, owned) {
    const content = document.querySelector("#detail-content");
    content.replaceChildren();
    const image = document.createElement("div");
    image.className = "market-detail-image";
    image.append(listingImage(listing, true));
    const copy = document.createElement("div");
    copy.className = "market-detail-copy";
    const title = document.createElement("h1");
    title.id = "detail-title";
    title.textContent = listing.listing_title;
    const price = document.createElement("p");
    price.className = "market-detail-price";
    price.textContent = formatPrice(listing.asking_price);
    const facts = document.createElement("div");
    facts.className = "market-detail-facts";
    facts.append(fact("Pig type", listing.pig_type), fact("Breed", listing.breed), fact("Sex", listing.sex), fact("Age", formatAge(listing.age_months)), fact("Estimated weight", listing.estimated_weight ? `~${listing.estimated_weight} kg` : "Not provided"), fact("Location", locationText(listing)), fact("Availability", statusLabel(listing.listing_status)));
    const description = document.createElement("p");
    description.className = "market-detail-description";
    description.textContent = listing.description || "No description provided.";
    const seller = document.createElement("div");
    seller.className = "market-seller-card";
    seller.textContent = owned ? "Your listing" : `Seller: ${[listing.seller_first_name, listing.seller_last_name].filter(Boolean).join(" ") || "Farmer"}`;
    copy.append(title, price, facts, description, seller);
    if (!owned && listing.listing_status === "active") {
      const contactButton = document.createElement("button");
      contactButton.className = "button button-primary";
      contactButton.type = "button";
      contactButton.disabled = true;
      contactButton.textContent = "Contact Seller";
      const contact = document.createElement("p");
      contact.className = "market-contact-unavailable";
      contact.textContent = "Seller contact details are not available.";
      copy.append(contactButton, contact);
    }
    content.append(image, copy);
    showView(detailView, document.querySelector("#detail-back"));
  }

  function fillForm(listing = null) {
    editingId = listing ? Number(listing.listing_id) : null;
    form.reset();
    form.elements.namedItem("title").value = listing?.listing_title || "";
    form.elements.namedItem("type").value = listing?.pig_type || "";
    form.elements.namedItem("breed").value = listing?.breed || "";
    form.elements.namedItem("sex").value = listing?.sex || "";
    form.elements.namedItem("age").value = listing?.age_months ?? "";
    form.elements.namedItem("weight").value = listing?.estimated_weight ?? "";
    form.elements.namedItem("price").value = listing?.asking_price ?? "";
    form.elements.namedItem("municipality").value = listing?.municipality || "";
    form.elements.namedItem("barangay").value = listing?.barangay || "";
    form.elements.namedItem("description").value = listing?.description || "";
    showFormMessage("");
    showView(formView, form.elements.namedItem("title"));
  }

  function payloadFromForm() {
    const values = Object.fromEntries(new FormData(form).entries());
    return {
      listing_title: values.title.trim(),
      pig_type: values.type,
      breed: values.breed.trim(),
      sex: values.sex,
      age_months: values.age === "" ? null : Number(values.age),
      estimated_weight: values.weight === "" ? null : Number(values.weight),
      asking_price: Number(values.price),
      description: values.description.trim(),
      municipality: values.municipality.trim(),
      barangay: values.barangay.trim(),
      pig_id: null,
      listing_status: editingId ? (mine.find((item) => Number(item.listing_id) === editingId)?.listing_status || "active") : "active"
    };
  }

  function showPreview() {
    pending = payloadFromForm();
    const preview = document.querySelector("#listing-preview");
    preview.replaceChildren(card({ ...pending, listing_title: pending.listing_title, pig_type: pending.pig_type, asking_price: pending.asking_price, age_months: pending.age_months, estimated_weight: pending.estimated_weight, municipality: pending.municipality, barangay: pending.barangay, listing_status: pending.listing_status }, false));
    showView(previewView, document.querySelector("#preview-back"));
  }

  async function publish() {
    if (!pending) return;
    const button = document.querySelector("#save-listing");
    button.disabled = true;
    button.textContent = editingId ? "Saving..." : "Publishing...";
    try {
      const path = editingId ? `marketplace.php?id=${editingId}` : "marketplace.php";
      const response = await secureRequest(path, { method: editingId ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(pending) });
      const id = editingId || response.data?.listing_id;
      const file = fileInput.files[0];
      if (file && id) await uploadImage(id, file);
      showMessage(editingId ? "Your listing was updated." : "Your listing was published.", false);
      await loadMine();
      await loadBrowse();
      editingId = null;
      pending = null;
      clearImage();
      form.reset();
      showView(listView, document.querySelector("#post-listing"));
    } catch (error) {
      showFormMessage(error.message);
    } finally {
      button.disabled = false;
      button.textContent = editingId ? "Save Changes" : "Publish Listing";
    }
  }

  async function uploadImage(id, file) {
    const formData = new FormData();
    formData.append("listing_id", String(id));
    formData.append("image", file);
    await secureRequest("listing-images.php", { method: "POST", body: formData });
  }

  async function changeStatus(listing, status) {
    const question = status === "sold" ? "Has the sale been completed?" : status === "inactive" ? "This listing will be hidden from buyers until you make it available again." : "Make this listing available again?";
    if (!window.confirm(question)) return;
    const payload = listingPayload(listing);
    payload.listing_status = status;
    try {
      await secureRequest(`marketplace.php?id=${listing.listing_id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      await loadMine();
      await loadBrowse();
      showMessage(`Listing marked as ${statusLabel(status).toLowerCase()}.`);
    } catch (error) {
      showMessage(error.message, true);
    }
  }

  function listingPayload(listing) {
    return {
      listing_title: listing.listing_title, pig_type: listing.pig_type, breed: listing.breed, sex: listing.sex,
      age_months: listing.age_months, estimated_weight: listing.estimated_weight, asking_price: listing.asking_price,
      description: listing.description || "", municipality: listing.municipality, barangay: listing.barangay || "",
      pig_id: listing.pig_id || null, listing_status: listing.listing_status
    };
  }

  async function removeListing(listing) {
    await changeStatus(listing, "inactive");
  }

  function beginEdit(listing) {
    fillForm(listing);
    document.querySelector("#form-title").textContent = "Edit Post";
    document.querySelector("#save-listing").textContent = "Save Changes";
  }

  async function loadBrowse() {
    const params = new URLSearchParams({ limit: "50" });
    const response = await request(`marketplace.php?${params}`);
    listings = Array.isArray(response.data) ? response.data : [];
    filterOptions();
    if (activeTab === "browse") renderBrowse();
  }

  async function loadMine() {
    const response = await secureRequest("marketplace.php?mine=1");
    mine = Array.isArray(response.data) ? response.data : [];
    if (activeTab === "mine") renderMine();
  }

  async function loadAll() {
    showMessage("Loading listings...");
    retry.hidden = true;
    try {
      currentUser = await window.PigmentAuth.getSession();
      await loadBrowse();
      if (currentUser) await loadMine();
      if (listings.length < 50) showMessage("");
    } catch (error) {
      showMessage(error.message, true);
      retry.hidden = false;
    }
  }

  function clearImage() {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    imageUrl = "";
    fileInput.value = "";
    previewImage.replaceChildren();
    previewImage.hidden = true;
    uploadArea.classList.remove("has-image");
  }

  fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (!file) return clearImage();
    if (!file.type.startsWith("image/") || file.size > imageLimit) {
      clearImage();
      showFormMessage("Choose an image file no larger than 5 MB.");
      return;
    }
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    imageUrl = URL.createObjectURL(file);
    const image = document.createElement("img");
    image.src = imageUrl;
    image.alt = "Selected listing photo preview";
    previewImage.replaceChildren(image);
    previewImage.hidden = false;
    uploadArea.classList.add("has-image");
  });

  [search, typeFilter, breedFilter, weightFilter, locationFilter].forEach((control) => control.addEventListener("input", renderBrowse));
  document.querySelector("#reset-filters").addEventListener("click", () => { search.value = ""; typeFilter.value = "all"; breedFilter.value = "all"; weightFilter.value = "all"; locationFilter.value = "all"; renderBrowse(); });
  document.querySelector("#empty-reset").addEventListener("click", () => document.querySelector("#reset-filters").click());
  document.querySelector("#post-listing").addEventListener("click", () => {
    if (!currentUser) {
      window.location.assign("login.html?next=marketplace.html&message=Please sign in to post a listing.");
      return;
    }
    fillForm();
  });
  document.querySelector("#form-back").addEventListener("click", () => showView(listView));
  document.querySelector("#cancel-listing").addEventListener("click", () => showView(listView));
  document.querySelector("#detail-back").addEventListener("click", () => showView(listView));
  document.querySelector("#preview-back").addEventListener("click", () => showView(formView));
  document.querySelector("#edit-listing").addEventListener("click", () => showView(formView));
  document.querySelector("#save-listing").addEventListener("click", publish);
  document.querySelector("#market-retry").addEventListener("click", loadAll);
  document.querySelector("#browse-tab").addEventListener("click", () => {
    activeTab = "browse";
    filterPanel.hidden = false;
    resultsHeading.hidden = false;
    document.querySelector("#browse-tab").classList.add("is-active");
    document.querySelector("#my-listings-tab").classList.remove("is-active");
    renderBrowse();
  });
  document.querySelector("#my-listings-tab").addEventListener("click", () => {
    activeTab = "mine";
    filterPanel.hidden = true;
    resultsHeading.hidden = true;
    empty.hidden = true;
    document.querySelector("#my-listings-tab").classList.add("is-active");
    document.querySelector("#browse-tab").classList.remove("is-active");
    if (!currentUser) {
      showMessage("Please sign in to manage your listings.", true);
      grid.replaceChildren();
      return;
    }
    renderMine();
  });
  form.addEventListener("submit", (event) => { event.preventDefault(); if (!form.reportValidity()) return; showPreview(); });

  loadAll();
})();
