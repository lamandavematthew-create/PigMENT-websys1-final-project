(function () {
  const isNestedPage = window.location.pathname.includes("/pages/");
  const apiBase = isNestedPage ? "../../api/" : "../api/";
  let csrfToken = "";

  function pageUrl(path) {
    const [pathname, query] = path.split("?");
    let url;
    if (isNestedPage) {
      url = /^index\.html(?:#|$)/.test(pathname) ? `../${pathname}` : pathname.replace(/^pages\//, "");
    } else {
      url = ["login.html", "register.html"].includes(pathname) ? `pages/${pathname}` : pathname;
    }
    return query ? `${url}?${query}` : url;
  }

  function getSafeNext() {
    const next = new URLSearchParams(window.location.search).get("next");
    const legacy = { "my-pigs.html":"my-pigs", "marketplace.html":"marketplace", "reports.html":"summary", "profile.html":"profile" };
    if (next && Object.hasOwn(legacy, next)) return "index.html#" + legacy[next];
    if (!next || !/^index\.html(?:#[a-z-]+)?$/.test(next)) return "";
    return next;
  }

  async function request(path, options = {}) {
    const response = await fetch(`${apiBase}${path}`, {
      credentials: "same-origin",
      ...options,
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {})
      }
    });

    let payload;
    try {
      payload = await response.json();
    } catch (error) {
      throw new Error("The server returned an invalid response.");
    }

    if (!response.ok || payload.status !== "success") {
      const error = new Error(payload.message || "The request could not be completed.");
      error.status = response.status;
      throw error;
    }

    return payload;
  }

  async function getCsrfToken() {
    const payload = await request("csrf.php");
    csrfToken = payload.csrf_token || "";
    if (!csrfToken) throw new Error("Unable to prepare a secure request.");
    return csrfToken;
  }

  async function authenticatedRequest(path, options = {}) {
    const token = csrfToken || await getCsrfToken();
    return request(path, {
      ...options,
      headers: { ...(options.headers || {}), "X-CSRF-Token": token }
    });
  }

  async function getSession() {
    try {
      const payload = await request("session.php");
      return payload.data && payload.data.user ? payload.data.user : null;
    } catch (error) {
      if (error.status === 401) return null;
      throw error;
    }
  }

  function setAuthReady() {
    document.body.dataset.authPending = "false";
  }

  function showVerificationError() {
    if (document.querySelector(".auth-verification-error")) return;
    const message = document.createElement("div");
    message.className = "auth-verification-error";
    message.setAttribute("role", "alert");
    message.textContent = "We could not verify your session. Check that the server is available, then refresh the page.";
    document.body.append(message);
  }

  function updateUserSummary(user) {
    document.querySelectorAll(".user-summary").forEach((summary) => {
      const name = summary.querySelector(".user-copy strong");
      const avatar = summary.querySelector(".user-avatar");
      if (!name || !avatar) return;
      const fullName = `${user.first_name} ${user.last_name}`.trim();
      name.textContent = fullName || user.email;
      avatar.textContent = (fullName || user.email).charAt(0).toUpperCase();
      summary.querySelector(".user-copy small").textContent = user.role === "admin" ? "Administrator" : "Farmer account";
    });
  }

  function addLogoutHandlers() {
    document.querySelectorAll(".auth-logout").forEach((button) => {
      if (button.dataset.authBound === "true") return;
      button.dataset.authBound = "true";
      button.addEventListener("click", async () => {
        button.disabled = true;
        button.textContent = "Logging out...";
        try {
          await authenticatedRequest("logout.php", { method: "POST" });
          window.location.assign(pageUrl("login.html?message=You have been logged out."));
        } catch (error) {
          if (error.status === 401) {
            window.location.assign(pageUrl("login.html?message=Your session has ended. Please sign in again."));
            return;
          }
          button.disabled = false;
          button.textContent = "Log out";
          await window.PigmentModal.notify({title: "Could not log out", message: error.message || "Please try again."});
        }

      });
    });
  }

  function showPublicAuthLinks() {
    document.querySelectorAll(".user-summary").forEach((summary) => {
      const logout = summary.querySelector(".auth-logout");
      if (!logout) return;
      logout.hidden = true;
      const links = document.createElement("span");
      links.className = "auth-nav-links";
      links.innerHTML = `<a href="${pageUrl("login.html")}">Sign in</a><a href="${pageUrl("register.html")}">Sign up</a>`;
      summary.append(links);
    });
  }

  async function requireAuth(options = {}) {
    try {
      const user = await getSession();
      if (!user) {
        const file = window.location.pathname.split("/").pop();
        const query = file === "admin-dashboard.html" ? window.location.search : "";
        const next = `${file}${query}${window.location.hash}`;
        window.location.assign(pageUrl(`login.html?next=${encodeURIComponent(next)}&message=Please log in to continue.`));
        return null;
      }
      if (options.adminOnly && user.role !== "admin") {
        window.location.assign(pageUrl("index.html"));
        return null;
      }
      updateUserSummary(user);
      addLogoutHandlers();
      setAuthReady();
      return user;
    } catch (error) {
      const message = document.querySelector("#auth-page-message");
      if (message) message.textContent = "We could not verify your session. Please try again.";
      showVerificationError();
      return null;
    }
  }

  function getAuthenticatedDestination(user) {
    if (user.role === "admin") {
      const next = new URLSearchParams(window.location.search).get("next") || "";
      if (/^admin-dashboard\.html(?:\?report=[1-9]\d*#reports|#(?:overview|reports|zones|marketplace|users))$/.test(next)) {
        return "pages/" + next;
      }
      return "pages/admin-dashboard.html#overview";
    }
    const next = getSafeNext();
    return next && !next.includes("admin-") ? next : "index.html";
  }

  async function redirectIfAuthenticated() {
    try {
      const user = await getSession();
      if (!user) return;
      window.location.assign(pageUrl(getAuthenticatedDestination(user)));
    } catch (error) {
      showMessage("We could not verify your session. Please try again.", "error");
    }
  }

  function showMessage(message, type) {
    const element = document.querySelector("#auth-page-message");
    if (!element) return;
    element.textContent = message;
    element.className = `form-message auth-message ${type || ""}`;
    element.hidden = !message;
  }

  async function handleLogin(form) {
    const submit = form.querySelector("button[type=submit]");
    const email = form.elements.email.value.trim();
    const password = form.elements.password.value;
    if (!email || !form.elements.email.validity.valid || !password) {
      showMessage("Enter a valid email address and password.", "error");
      return;
    }
    submit.disabled = true;
    submit.textContent = "Signing in...";
    showMessage("", "");
    try {
      await getCsrfToken();
      const payload = await authenticatedRequest("login.php", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });
      csrfToken = "";
      const session = await getSession();
      await getCsrfToken();
      const user = session || payload.data;
      window.location.assign(pageUrl(getAuthenticatedDestination(user)));
    } catch (error) {
      showMessage(error.message, "error");
      submit.disabled = false;
      submit.textContent = "Sign in";
    }
  }

  async function handleRegister(form) {
    const submit = form.querySelector("button[type=submit]");
    const values = Object.fromEntries(new FormData(form).entries());
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    if (values.password !== values.confirm_password) {
      showMessage("Passwords do not match.", "error");
      return;
    }
    if ([...values.password].length < 8 || new TextEncoder().encode(values.password).length > 72) {
      showMessage("Password must contain 8 to 72 bytes.", "error");
      return;
    }
    delete values.confirm_password;
    submit.disabled = true;
    submit.textContent = "Creating account...";
    showMessage("", "");
    try {
      await getCsrfToken();
      await authenticatedRequest("register.php", { method: "POST", body: JSON.stringify(values) });
      window.location.assign(pageUrl("login.html?message=Account created successfully. Please sign in."));
    } catch (error) {
      showMessage(error.message, "error");
      submit.disabled = false;
      submit.textContent = "Create account";
    }
  }

  function bindPasswordToggles() {
    document.querySelectorAll("[data-password-toggle]").forEach((button) => {
      button.addEventListener("click", () => {
        const input = document.getElementById(button.dataset.passwordToggle);
        const isPassword = input.type === "password";
        input.type = isPassword ? "text" : "password";
        button.textContent = isPassword ? "Hide" : "Show";
        button.setAttribute("aria-label", `${isPassword ? "Hide" : "Show"} password`);
      });
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    bindPasswordToggles();
    addLogoutHandlers();
    const loginForm = document.querySelector("#login-form");
    const registerForm = document.querySelector("#register-form");
    if (loginForm) {
      const message = new URLSearchParams(window.location.search).get("message");
      if (message) showMessage(message, "success");
      redirectIfAuthenticated();
      loginForm.addEventListener("submit", (event) => {
        event.preventDefault();
        handleLogin(loginForm);
      });
    }
    if (registerForm) {
      redirectIfAuthenticated();
      registerForm.addEventListener("submit", (event) => {
        event.preventDefault();
        handleRegister(registerForm);
      });
    }
    if (document.body.dataset.requiresAuth === "true") {
      requireAuth({ adminOnly: document.body.dataset.adminOnly === "true" });
    } else if (!loginForm && !registerForm) {
      getSession().then((user) => {
        if (user) {
          updateUserSummary(user);
          addLogoutHandlers();
        } else {
          showPublicAuthLinks();
        }
      }).catch(() => {
        showPublicAuthLinks();
      });
    }
  });

  window.PigmentAuth = { getSession, requireAuth, authenticatedRequest, getCsrfToken };
})();
