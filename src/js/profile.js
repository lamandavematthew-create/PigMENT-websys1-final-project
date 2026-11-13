(() => {
  const auth = window.PigmentAuth;
  const form = document.querySelector("#profile-form");
  if (!auth || !form) return;

  const panel = document.querySelector("#profile-form-panel");
  const message = document.querySelector("#profile-message");
  const edit = document.querySelector("#edit-profile");
  const formMessage = document.querySelector("#profile-form-message");
  const cancel = document.querySelector("#cancel-profile");
  let profile = null;
  let dirty = false;

  const showMessage = (text, error = false) => {
    message.textContent = text;
    message.className = `form-message${error ? " is-error" : ""}`;
    message.hidden = !text;
  };
  const display = (selector, value) => { document.querySelector(selector).textContent = value || "Not provided"; };
  const roleLabel = (role) => role === "admin" ? "Administrator" : "Farmer";

  function render(value) {
    profile = value;
    const names = [value.first_name, value.last_name].map((name) => String(name || "").trim()).filter(Boolean);
    display("#profile-name", names.join(" ") || "Your profile");
    display("#profile-initials", names.map((name) => Array.from(name)[0]).join("").toUpperCase() || "—");
    edit.disabled = false;
    display("#profile-email", value.email);
    display("#profile-phone", value.phone_number);
    display("#profile-municipality", value.municipality);
    display("#profile-barangay", value.barangay);
    display("#profile-address", value.address);
    display("#profile-role", `${roleLabel(value.role)} account`);
  }

  function setForm(value) {
    Object.keys(value).forEach((key) => {
      if (form.elements.namedItem(key)) form.elements.namedItem(key).value = value[key] || "";
    });
    dirty = false;
  }

  async function load() {
    try {
      const response = await auth.authenticatedRequest("profile.php");
      render(response.data);
    } catch (error) {
      if (error.status === 401) {
        window.location.assign(`pages/login.html?next=${encodeURIComponent("index.html#profile")}&message=Your session has ended. Please sign in again.`);
        return;
      }
      showMessage(error.message || "Profile could not be loaded.", true);
    }
  }

  function closeEditor() {
    panel.hidden = true;
    edit.setAttribute("aria-expanded", "false");
    dirty = false;
    edit.focus();
  }
  edit.addEventListener("click", () => {
    if (!profile) return;
    if (panel.hidden) {
      setForm(profile);
      formMessage.hidden = true;
      panel.hidden = false;
      edit.setAttribute("aria-expanded", "true");
    }
    form.elements.first_name.focus();
  });
  cancel.addEventListener("click", closeEditor);
  form.addEventListener("input", () => { dirty = true; });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    const submit = form.querySelector("button[type=submit]");
    if (submit.disabled) return;
    submit.disabled = cancel.disabled = true;
    formMessage.hidden = true;
    showMessage("");
    try {
      const values = Object.fromEntries(new FormData(form).entries());
      const response = await auth.authenticatedRequest("profile.php", {
        method: "PUT",
        body: JSON.stringify(values)
      });
      render({ ...profile, ...values });
      closeEditor();
      showMessage(response.message || "Profile updated successfully.");
    } catch (error) {
      if (error.status === 401) {
        window.location.assign(`pages/login.html?next=${encodeURIComponent("index.html#profile")}&message=Your session has ended. Please sign in again.`);
        return;
      }
      formMessage.textContent = error.message || "Profile could not be updated.";
      formMessage.classList.add("is-error");
      formMessage.hidden = false;
    } finally {
      submit.disabled = cancel.disabled = false;
    }
  });
  window.addEventListener("beforeunload", (event) => {
    if (!dirty) return;
    event.preventDefault();
    event.returnValue = "";
  });

  let started = false;
  function enterSection() {
    if (!started && document.body.dataset.workspaceRoute === "profile") {
      started = true;
      load();
    }
  }
  document.addEventListener("pigment:workspace-route", enterSection);
  enterSection();
})();
