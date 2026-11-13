(function () {
  const grid = document.querySelector("#listing-grid");
  if (!grid) return;

  const apiBase = "../api/";
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
  const filterToggle = document.querySelector("#market-filters-toggle");
  const filterOptionsRow = document.querySelector("#market-filter-options");
  const filterCount = document.querySelector("#market-filter-count");
  const browseTab = document.querySelector("#browse-tab");
  const myListingsTab = document.querySelector("#my-listings-tab");
  const resultsHeading = document.querySelector(".market-results-heading");
  const count = document.querySelector("#listing-count");
  const message = document.querySelector("#market-message");
  const retry = document.querySelector("#market-retry");
  const empty = document.querySelector("#market-empty");
  const form = document.querySelector("#listing-form");
  const formMessage = document.querySelector("#form-message");
  const previewMessage = document.querySelector("#preview-message");
  const priceTotal = document.querySelector("#listing-price-total");
  const priceHint = document.querySelector("#listing-price-hint");
  const rateInput = form.elements.namedItem("price");
  const weightInput = form.elements.namedItem("weight");
  let editingListing = null;
  const fileInput = document.querySelector("#listing-image");
  const previewImage = document.querySelector("#upload-preview");
  const uploadArea = document.querySelector("#upload-area");
  const imageLimit = 5 * 1024 * 1024;
  let listings = [];
  let mine = [];
  let editingId = null;
  let pending = null;
  let imageUrl = "";
  let detailReturnView = listView;
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

  function calculateTotal(weight, rate) {
    // Both inputs have at most two decimal places. Round once to the nearest centavo.
    return Math.round(Math.round(Number(weight) * 100) * Math.round(Number(rate) * 100) / 100) / 100;
  }

  function retainsLegacyTotal() {
    return editingListing && editingListing.asking_price_per_kg == null &&
      rateInput.value === "" && Number(weightInput.value) === Number(editingListing.estimated_weight);
  }

  function updatePriceTotal() {
    rateInput.required = !retainsLegacyTotal();
    const total = retainsLegacyTotal() ? Number(editingListing.asking_price) :
      weightInput.validity.valid && rateInput.validity.valid && Number(rateInput.value) > 0
        ? calculateTotal(weightInput.value, rateInput.value) : 0;
    priceTotal.textContent = total > 0 ? formatPrice(total) : "—";
  }

  function formatAge(value) {
    if (value === null || value === undefined || value === "") return "Not provided";
    return `${Number(value)} months`;
  }

  function imagePath(path) {
    if (!path || typeof path !== "string") return "";
    if (/^https?:\/\//i.test(path) || path.startsWith("/")) return path;
    return `../${path.replace(/^\.?\//, "")}`;
  }

  function artwork() {
    const element = document.createElement("div");
    element.className = "listing-art listing-art-green";
    element.setAttribute("role", "img");
    element.setAttribute("aria-label", "Pig illustration");
    element.innerHTML = '<svg aria-hidden="true" viewBox="0 0 520 300"><path class="art-sun" d="M426 63a31 31 0 1 0 0-62 31 31 0 0 0 0 62Z"/><path class="art-hill-back" d="M0 193 101 109l94 77 103-109 143 122 79-54v155H0Z"/><path class="art-hill-front" d="m0 217 113-64 92 64 111-81 101 78 103-51v137H0Z"/><g class="art-pig"><path d="M143 210c2-42 34-71 88-71 37 0 65 13 80 38l29 2c16 1 27 13 27 28 0 16-13 28-29 28h-20c-11 20-30 30-58 30h-68c-39 0-65-20-65-55Z"/><circle class="art-eye" cx="319" cy="169" r="4"/></g></svg><span class="listing-art-caption">PigMENT Marketplace</span>';
    return element;
  }

  function listingImage(listing, large = false, localPhoto = "") {
    const path = localPhoto || imagePath(listing.primary_image || listing.image_path);
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
    image.onerror = () => {
      const fallback = artwork();
      if (large) fallback.classList.add("listing-art-large");
      wrapper.replaceWith(fallback);
    };
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

  const metaIcons = {
    breed: '<path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5"/>',
    weight: '<path d="M6 8h12l3 13H3L6 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
    location: '<path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>'
  };

  function cardMeta(kind, value) {
    const item = document.createElement("li");
    item.innerHTML = `<svg class="market-ui-icon" aria-hidden="true" viewBox="0 0 24 24">${metaIcons[kind]}</svg><span></span>`;
    item.lastElementChild.textContent = value;
    return item;
  }

  function card(listing, owned = false, previewPhoto = null) {
    const article = document.createElement("article");
    article.className = "listing-card";
    const media = document.createElement("div");
    media.className = "market-card-media";
    const type = document.createElement("span");
    type.className = "listing-type-label";
    type.textContent = listing.pig_type || "Pig";
    media.append(listingImage(listing, false, previewPhoto), type);
    const content = document.createElement("div");
    content.className = "listing-card-content";
    const title = document.createElement("h3");
    title.textContent = listing.listing_title;
    const price = document.createElement("strong");
    price.className = "listing-price";
    price.textContent = formatPrice(listing.asking_price);
    const topline = document.createElement("div");
    topline.className = "market-card-title";
    topline.append(title, price);
    const facts = document.createElement("ul");
    facts.className = "market-card-meta";
    facts.append(
      cardMeta("breed", `Breed: ${listing.breed || "Not provided"}`),
      cardMeta("weight", `Weight: ${listing.estimated_weight ? `~${listing.estimated_weight} kg` : "Not provided"}`),
      cardMeta("location", locationText(listing) || "Location not provided")
    );
    content.append(topline, facts);
    if (owned) {
      const status = document.createElement("p");
      status.className = "listing-seller";
      status.textContent = `Status: ${statusLabel(listing.listing_status)}`;
      content.append(status);
    }
    const view = document.createElement("button");
    view.className = "button button-secondary listing-view-button";
    view.type = "button";
    view.textContent = "View Details";
    view.addEventListener("click", () => showDetails(listing, owned, previewPhoto));
    content.append(view);
    if (owned) content.append(managementActions(listing));
    article.append(media, content);
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
    const selectedFilters = [typeFilter, breedFilter, weightFilter, locationFilter].filter((control) => control.value !== "all").length;
    filterCount.textContent = selectedFilters ? `(${selectedFilters})` : "";
    filterCount.hidden = selectedFilters === 0;
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

  function detailElement(tag, className, label) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (label !== undefined) node.textContent = label;
    return node;
  }

  function renderSellerContact(target, listing) {
    const name = [listing.seller_first_name, listing.seller_last_name]
      .map((part) => String(part ?? "").trim()).filter(Boolean).join(" ");
    const phone = String(listing.seller_phone ?? "").trim();
    const dial = phone.replace(/[\s().-]/g, "");
    const nameNode = detailElement("strong", "market-seller-name", name || "Name not available");
    const phoneNode = detailElement("p", "market-seller-number");
    if (phone && /^\+?\d{7,15}$/.test(dial)) {
      const link = detailElement("a", "", phone);
      link.href = `tel:${dial}`;
      phoneNode.append(link);
    } else {
      phoneNode.textContent = phone || "No phone number on file.";
    }
    target.replaceChildren(nameNode, phoneNode);
  }

  async function showDetails(listing, owned, previewPhoto = null) {
    const isPreview = previewPhoto !== null;
    detailReturnView = isPreview ? previewView : listView;
    const back = document.querySelector("#detail-back");
    back.lastElementChild.textContent = isPreview ? "Back to Preview" : "Back to Listings";
    const content = document.querySelector("#detail-content");
    content.replaceChildren();

    const header = detailElement("header", "market-detail-header");
    const title = detailElement("h1", "", listing.listing_title);
    title.id = "detail-title";
    const status = detailElement("span", "market-detail-status", statusLabel(listing.listing_status) || "Preview");
    status.dataset.status = listing.listing_status;
    header.append(title, status);

    const image = detailElement("div", "market-detail-image");
    image.append(listingImage(listing, true, previewPhoto));
    const copy = detailElement("div", "market-detail-copy");
    const price = detailElement("div", "market-detail-pricing");
    price.append(
      detailElement("span", "market-detail-price-label", listing.asking_price_per_kg == null ? "Asking price" : "Estimated total"),
      detailElement("p", "market-detail-price", formatPrice(listing.asking_price))
    );
    if (listing.asking_price_per_kg != null) {
      price.append(detailElement("span", "market-detail-rate", `${formatPrice(listing.asking_price_per_kg)}/kg`));
    }

    const facts = detailElement("div", "market-detail-facts");
    facts.append(
      fact("Estimated weight", listing.estimated_weight ? `~${listing.estimated_weight} kg` : "Not provided"),
      fact("Location", locationText(listing) || "Not provided"),
      fact("Pig type", listing.pig_type || "Not provided"),
      fact("Breed", listing.breed || "Not provided"),
      fact("Sex", listing.sex || "Not provided"),
      fact("Age", formatAge(listing.age_months))
    );

    const seller = detailElement("section", "market-detail-seller");
    const sellerContact = detailElement("div", "market-seller-contact");
    sellerContact.setAttribute("aria-live", "polite");
    seller.append(detailElement("h2", "", "Seller contact"), sellerContact);
    if (listing.listing_id) {
      renderSellerContact(sellerContact, { ...listing, seller_phone: "Loading phone number…" });
    } else {
      sellerContact.textContent = "Your profile contact information appears after publishing.";
    }

    copy.append(price, seller, facts);
    const description = (listing.description || "").trim();
    if (description && !/^(?:n\/?a|none)$/i.test(description)) {
      const about = detailElement("section", "market-detail-about");
      about.append(detailElement("h2", "", "About this listing"), detailElement("p", "market-detail-description", description));
      copy.append(about);
    }
    content.append(header, image, copy);
    showView(detailView, back);

    if (!listing.listing_id) return;
    const query = new URLSearchParams({ id: listing.listing_id, contact: "1" });
    if (owned) query.set("mine", "1");
    try {
      const response = await request(`marketplace.php?${query}`, { cache: "no-store" });
      renderSellerContact(sellerContact, response.data);
    } catch (error) {
      const unavailable = error.status === 401
        ? "Sign in to see the seller’s phone number."
        : error.status === 404
          ? "This listing is no longer available."
          : "Couldn’t load the phone number. Return to the listing and try again.";
      renderSellerContact(sellerContact, { ...listing, seller_phone: unavailable });
    }
  }

  function fillForm(listing = null) {
    editingId = listing ? Number(listing.listing_id) : null;
    editingListing = listing;
    form.reset();
    clearImage();
    document.querySelector("#marketplace-form-title").textContent = listing ? "Edit Post" : "Post a Listing";
    document.querySelector("#save-listing").textContent = listing ? "Save Changes" : "Publish Listing";
    form.elements.namedItem("title").value = listing?.listing_title || "";
    form.elements.namedItem("type").value = listing?.pig_type || "";
    const breed = form.elements.namedItem("breed");
    breed.querySelector("[data-legacy-breed]")?.remove();
    if (listing?.breed && !Array.from(breed.options).some((option) => option.value === listing.breed)) {
      const option = new Option(`${listing.breed} (current breed)`, listing.breed);
      option.dataset.legacyBreed = "true";
      breed.add(option);
    }
    breed.value = listing?.breed || "";
    form.elements.namedItem("sex").value = listing?.sex || "";
    form.elements.namedItem("age").value = listing?.age_months ?? "";
    form.elements.namedItem("weight").value = listing?.estimated_weight ?? "";
    rateInput.value = listing?.asking_price_per_kg ?? "";
    priceHint.textContent = listing && listing.asking_price_per_kg == null
      ? "Leave blank to keep the old total if the weight stays the same. Enter a rate to calculate a new total."
      : "The listing shows this rate multiplied by the estimated weight.";
    updatePriceTotal();
    form.elements.namedItem("municipality").value = listing?.municipality || "";
    form.elements.namedItem("barangay").value = listing?.barangay || "";
    form.elements.namedItem("description").value = listing?.description || "";
    showFormMessage("");
    showView(formView, form.elements.namedItem("title"));
  }

  function payloadFromForm() {
    const values = Object.fromEntries(new FormData(form).entries());
    const legacyTotal = retainsLegacyTotal();
    return {
      listing_title: values.title.trim(),
      pig_type: values.type,
      breed: values.breed.trim(),
      sex: values.sex,
      age_months: values.age === "" ? null : Number(values.age),
      estimated_weight: values.weight === "" ? null : Number(values.weight),
      asking_price: legacyTotal ? Number(editingListing.asking_price) : calculateTotal(values.weight, values.price),
      asking_price_per_kg: legacyTotal ? null : Number(values.price),
      description: values.description.trim(),
      municipality: values.municipality.trim(),
      barangay: values.barangay.trim(),
      pig_id: editingListing?.pig_id || null,
      listing_status: editingId ? (mine.find((item) => Number(item.listing_id) === editingId)?.listing_status || "active") : "active"
    };
  }

  function showPreview() {
    pending = payloadFromForm();
    const preview = document.querySelector("#listing-preview");
    previewMessage.hidden = true;
    // Use the local selection for display only. The photo still uploads as a file on publish.
    const existingPhoto = editingListing?.primary_image || editingListing?.image_path;
    preview.replaceChildren(card({ ...pending, primary_image: existingPhoto }, false, imageUrl));
    showView(previewView, document.querySelector("#preview-back"));
  }

  async function publish() {
    if (!pending) return;
    const button = document.querySelector("#save-listing");
    button.disabled = true;
    previewMessage.hidden = true;
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
      editingListing = null;
      pending = null;
      clearImage();
      form.reset();
      showView(listView, document.querySelector("#post-listing"));
    } catch (error) {
      previewMessage.textContent = error.message;
      previewMessage.hidden = false;
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
    const action = status === "sold" ? "Mark as sold" : status === "inactive" ? "Hide listing" : "Make available";
    if (!(await window.PigmentModal.ask({title: action + "?", message: question, accept: action}))) return;
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
      asking_price_per_kg: listing.asking_price_per_kg ?? null,
      description: listing.description || "", municipality: listing.municipality, barangay: listing.barangay || "",
      pig_id: listing.pig_id || null, listing_status: listing.listing_status
    };
  }

  async function removeListing(listing) {
    await changeStatus(listing, "inactive");
  }

  function beginEdit(listing) {
    fillForm(listing);
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

  filterToggle.hidden = false;
  filterToggle.addEventListener("click", () => {
    const expanded = filterToggle.getAttribute("aria-expanded") === "true";
    filterToggle.setAttribute("aria-expanded", String(!expanded));
    filterOptionsRow.classList.toggle("is-expanded", !expanded);
  });

  function selectTab(tab) {
    activeTab = tab;
    const browsing = tab === "browse";
    browseTab.classList.toggle("is-active", browsing);
    myListingsTab.classList.toggle("is-active", !browsing);
    browseTab.setAttribute("aria-pressed", String(browsing));
    myListingsTab.setAttribute("aria-pressed", String(!browsing));
  }

  [search, typeFilter, breedFilter, weightFilter, locationFilter].forEach((control) => control.addEventListener("input", renderBrowse));
  document.querySelector("#reset-filters").addEventListener("click", () => { search.value = ""; typeFilter.value = "all"; breedFilter.value = "all"; weightFilter.value = "all"; locationFilter.value = "all"; renderBrowse(); });
  document.querySelector("#empty-reset").addEventListener("click", () => document.querySelector("#reset-filters").click());
  document.querySelector("#post-listing").addEventListener("click", () => {
    if (!currentUser) {
      window.location.assign("pages/login.html?next=index.html%23marketplace&message=Please sign in to post a listing.");
      return;
    }
    fillForm();
  });
  document.querySelector("#form-back").addEventListener("click", () => showView(listView));
  document.querySelector("#cancel-listing").addEventListener("click", () => showView(listView));
  document.querySelector("#detail-back").addEventListener("click", () => showView(
    detailReturnView,
    detailReturnView === previewView ? document.querySelector("#preview-back") : null
  ));
  document.querySelector("#preview-back").addEventListener("click", () => showView(formView));
  document.querySelector("#edit-listing").addEventListener("click", () => showView(formView));
  document.querySelector("#save-listing").addEventListener("click", publish);
  document.querySelector("#market-retry").addEventListener("click", loadAll);
  document.querySelector("#browse-tab").addEventListener("click", () => {
    selectTab("browse");
    filterPanel.hidden = false;
    resultsHeading.hidden = false;
    showMessage("");
    renderBrowse();
  });
  document.querySelector("#my-listings-tab").addEventListener("click", () => {
    selectTab("mine");
    filterPanel.hidden = true;
    resultsHeading.hidden = true;
    empty.hidden = true;
    showMessage("");
    if (!currentUser) {
      showMessage("Please sign in to manage your listings.", true);
      grid.replaceChildren();
      return;
    }
    renderMine();
  });
  form.addEventListener("input", (event) => {
    if (event.target === rateInput || event.target === weightInput) {
      showFormMessage("");
      updatePriceTotal();
    }
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    updatePriceTotal();
    if (!form.reportValidity()) return;
    if (payloadFromForm().asking_price <= 0) {
      showFormMessage("Increase the weight or rate so the estimated total is at least ₱0.01.");
      rateInput.focus();
      return;
    }
    showPreview();
  });

  let started = false;
  function enterMarketplace() {
    if (!started && document.body.dataset.workspaceRoute === "marketplace") {
      started = true;
      loadAll();
    }
  }
  document.addEventListener("pigment:workspace-route", enterMarketplace);
  enterMarketplace();

})();
