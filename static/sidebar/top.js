/**
 * Sidebar top behavior (used with sidebar/top.html + sidebar/top.css).
 * Collapse/expand: persisted in localStorage (base_sidebar_collapsed).
 */
(function () {
  const SIDEBAR_KEY = "base_sidebar_collapsed";

  const sidebar = document.getElementById("Base-sidebar");
  const toggleBtn = document.getElementById("Base-sidebarCollapseToggle");

  if (!sidebar || !toggleBtn) return;

  /* Restore collapsed state from localStorage; remove html class used for first-paint so sidebar class is source of truth */
  try {
    document.documentElement.classList.remove("sidebar-collapsed");
    const collapsed = localStorage.getItem(SIDEBAR_KEY) === "1";
    if (collapsed) sidebar.classList.add("is-collapsed");
  } catch (_) {}

  toggleBtn.addEventListener("click", () => {
    const collapsedNow = sidebar.classList.toggle("is-collapsed");
    try {
      localStorage.setItem(SIDEBAR_KEY, collapsedNow ? "1" : "0");
    } catch (_) {}
  });

})();
