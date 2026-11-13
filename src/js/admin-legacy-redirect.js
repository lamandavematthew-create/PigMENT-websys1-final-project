(() => {
  // Old bookmarks can include two concatenated fragments. Keep the last known section.
  const matches = [...location.hash.matchAll(/#(reports|zones)(?=$|#|https?:)/g)];
  const section = matches.at(-1)?.[1] || "reports";
  const report = new URLSearchParams(location.search).get("report");
  const query = section === "reports" && /^[1-9]\d*$/.test(report || "") ? "?report=" + report : "";
  location.replace("admin-dashboard.html" + query + "#" + section);
})();
