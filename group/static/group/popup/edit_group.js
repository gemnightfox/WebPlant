/**
 * Edit group popup. Opens from group header (not the title text) or "Edit name" in the menu; prepare fills form from column header.
 */
(function () {
  var currentGroupId = null;

  function resolveGroupHeader(trigger) {
    var header = trigger.closest(".Dashboard-groupHeader");
    if (header) return header;
    var group = trigger.closest(".Dashboard-group");
    return group ? group.querySelector(".Dashboard-groupHeader") : null;
  }

  function closeDashboardMenus() {
    document.querySelectorAll(".Dashboard-menuWrapper--open").forEach(function (w) {
      w.classList.remove("Dashboard-menuWrapper--open");
      var menu = w.querySelector(".Dashboard-menu");
      if (menu) {
        menu.style.position = "";
        menu.style.top = "";
        menu.style.left = "";
        menu.style.marginTop = "";
      }
    });
  }

  function prepare(trigger) {
    var header = resolveGroupHeader(trigger);
    if (!header) return;
    closeDashboardMenus();
    currentGroupId = header.getAttribute("data-group-id");
    var nameInput = document.getElementById("id_edit_group_name");
    if (nameInput) nameInput.defaultValue = header.getAttribute("data-group-name") || "";
    var posInput = document.getElementById("edit-group-position-input");
    if (posInput) posInput.defaultValue = header.getAttribute("data-group-position") || "0";
    var form = document.getElementById("edit-group-form");
    if (form && currentGroupId) form.setAttribute("data-url", "/group/edit/" + currentGroupId + "/");
    var projectInput = document.getElementById("edit-group-project-input");
    if (projectInput) {
      var dashboard = document.querySelector(".Dashboard");
      projectInput.value = dashboard ? dashboard.dataset.dashboardPath : "";
    }
  }

  function init() {
    document.body.addEventListener("click", function (e) {
      if (e.target.closest(".Dashboard-menuWrapper")) return;
      if (e.target.closest("[data-popup]")) return;
      if (e.target.closest(".Dashboard-groupName")) return;
      var header = e.target.closest(".Dashboard-groupHeader");
      if (!header) return;
      prepare(header);
      window.openPopup("edit-group-popup");
    });
    if (window.popupPrepare) window.popupPrepare["edit-group-popup"] = prepare;
    if (typeof window.initPopupForm === "function") window.initPopupForm("edit-group-form", "edit-group-error");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
