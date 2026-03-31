/**
 * Add group popup. Sets data-url from dashboard data-dashboard-path (project id); binds AJAX form.
 */
(function () {
  function computeNextGroupPosition() {
    const groups = document.querySelectorAll(".Dashboard-group");
    if (groups.length === 0) return 0;
    let maxPos = -Infinity;
    groups.forEach(function (g) {
      const pos = parseFloat(g.getAttribute("data-group-position"));
      if (!isNaN(pos) && pos > maxPos) maxPos = pos;
    });
    return isFinite(maxPos) ? maxPos + 1 : 0;
  }

  function prepare() {
    const dashboard = document.querySelector(".Dashboard");
    const projectId = dashboard ? dashboard.getAttribute("data-dashboard-path") : null;
    if (projectId) {
      const groupForm = document.getElementById("add-group-form");
      if (groupForm) groupForm.setAttribute("data-url", "/group/create-new/" + projectId + "/");
    }
    const posInput = document.getElementById("add-group-position-input");
    if (posInput) posInput.value = computeNextGroupPosition();
  }

  function init() {
    if (window.popupPrepare) window.popupPrepare["add-group-popup"] = prepare;
    window.addEventListener("popup-opened", (e) => {
      if (e.detail && e.detail.id === "add-group-popup") prepare();
    });
    if (typeof window.initPopupForm === "function") {
      window.initPopupForm("add-group-form", "group-error");
    }
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
