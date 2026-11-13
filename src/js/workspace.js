(() => {
  const home = document.querySelector("#dashboard-view");
  const health = document.querySelector("#disease-awareness");
  const main = document.querySelector("#dashboard");
  const label = document.querySelector("#workspace-label");
  const nav = [...document.querySelectorAll("#sidebar .nav-link")];
  const sections = [...document.querySelectorAll("[data-workspace-view]")];
  const healthTargets = new Set(["disease-awareness", "disease-map-section", "health-guide", "submit-report", "my-reports"]);
  const titles = {home:"Home", "my-pigs":"My Pigs", marketplace:"Marketplace", "disease-awareness":"Pig Health", summary:"Farm Summary", profile:"My Profile"};
  const pageClasses = { "my-pigs":"my-pigs-refresh", marketplace:"marketplace-refresh", summary:"farm-summary-refresh", profile:"profile-refresh" };
  function routeFor(hash) {
    if (healthTargets.has(hash)) return "disease-awareness";
    if (hash === "register-pig" || hash === "pig-pens") return "my-pigs";
    return Object.hasOwn(titles, hash) ? hash : "home";
  }
  function update({focus = false} = {}) {
    const target = location.hash.slice(1);
    const route = routeFor(target);
    const previous = document.body.dataset.workspaceRoute;
    const calculator = document.querySelector("#weight-calculator-dialog");
    if (previous && previous !== route && calculator?.open) calculator.close();
    Object.entries(pageClasses).forEach(([key, cls]) => document.body.classList.toggle(cls, route === key));
    document.body.dataset.workspaceRoute = route;
    home.hidden = route !== "home";
    health.hidden = route !== "disease-awareness";
    sections.forEach(section => { section.hidden = section.dataset.workspaceView !== route; });
    nav.forEach(link => {
      const active = routeFor(link.hash.slice(1)) === route;
      link.classList.toggle("active", active);
      if (active) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
    label.textContent = route === "home" ? "Farm workspace" : titles[route];
    document.title = titles[route] + " | PigMENT";
    if (focus && previous !== route) main.focus({preventScroll:true});
    document.dispatchEvent(new CustomEvent("pigment:workspace-route", {detail:{route,target,previous}}));
    if (target === "pig-pens") document.querySelector("#pig-pens")?.scrollIntoView({block:"start"});
    else if (previous !== route) window.scrollTo(0,0);
  }
  function navigate(target, replace = false) {
    const url = "index.html" + (target && target !== "dashboard" ? "#" + target : "");
    if (location.hash !== (url.includes("#") ? "#" + target : "")) history[replace ? "replaceState" : "pushState"](null, "", url);
    update({focus:true});
  }
  document.addEventListener("click", event => {
    const link = event.target.closest("a[href]");
    if (!link || event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || link.target || link.hasAttribute("download")) return;
    const url = new URL(link.href);
    if (url.origin !== location.origin || url.pathname !== location.pathname || url.search !== location.search) return;
    event.preventDefault();
    navigate(url.hash.slice(1));
  });
  window.addEventListener("hashchange", () => update());
  window.PigmentWorkspace = { navigate, routeFor };
  update();
})();
