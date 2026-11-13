(() => {
  const legacy = {
    "my-pigs.html": "my-pigs",
    "marketplace.html": "marketplace",
    "reports.html": "summary",
    "profile.html": "profile"
  };
  const route = legacy[location.pathname.split("/").pop()];
  if (!route) return;
  const shortcut = route === "my-pigs" && ["#register-pig", "#pig-pens"].includes(location.hash);
  location.replace("../index.html" + (shortcut ? location.hash : "#" + route));
})();
