(() => {
  const auth = window.PigmentAuth;
  const form = document.querySelector("#profile-form");
  if (!auth || !form) return;

  const panel = document.querySelector("#profile-form-panel");
  const message = document.querySelector("#profile-message");
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
    display("#profile-name", `${value.first_name} ${value.last_name}`.trim());
    display("#profile-email", value.email);
    display("#profile-phone", value.phone_number);
    display("#profile-municipality", value.municipality);
    display("#profile-barangay", value.barangay);
    display("#profile-address", value.address);
    display("#profile-role", roleLabel(value.role));
    display("#profile-role-detail", roleLabel(value.role));
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
        window.location.assign(`login.html?next=${encodeURIComponent("profile.html")}&message=Your session has ended. Please sign in again.`);
        return;
      }
      showMessage(error.message || "Profile could not be loaded.", true);
    }
  }

  document.querySelector("#edit-profile").addEventListener("click", () => {
    setForm(profile);
    panel.hidden = false;
    form.elements.first_name.focus();
  });
  document.querySelector("#cancel-profile").addEventListener("click", () => {
    panel.hidden = true;
    dirty = false;
  });
  form.addEventListener("input", () => { dirty = true; });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    const submit = form.querySelector("button[type=submit]");
    submit.disabled = true;
    showMessage("");
    try {
      const response = await auth.authenticatedRequest("profile.php", {
        method: "PUT",
        body: JSON.stringify(Object.fromEntries(new FormData(form).entries()))
      });
      await load();
      panel.hidden = true;
      dirty = false;
      showMessage(response.message || "Profile updated successfully.");
    } catch (error) {
      if (error.status === 401) {
        window.location.assign(`login.html?next=${encodeURIComponent("profile.html")}&message=Your session has ended. Please sign in again.`);
        return;
      }
      showMessage(error.message || "Profile could not be updated.", true);
    } finally {
      submit.disabled = false;
    }
  });
  window.addEventListener("beforeunload", (event) => {
    if (!dirty) return;
    event.preventDefault();
    event.returnValue = "";
  });

  auth.requireAuth().then((user) => { if (user) load(); });
})();
