/**
 * Edit project name popup. Sets data-url from trigger data-project-id and
 * pre-fills the name input after the popup reset via the popup-opened event.
 */
(function () {
  var pendingName = "";

  function prepare(trigger) {
    const projectId = trigger.getAttribute("data-project-id");
    pendingName = trigger.getAttribute("data-project-name") || "";
    if (!projectId) return;
    const form = document.getElementById("edit-project-name-form");
    if (form) form.setAttribute("data-url", "/project/edit-name/" + projectId + "/");
  }

  function init() {
    if (window.popupPrepare) window.popupPrepare["edit-project-name-popup"] = prepare;

    // Set name after openPopup() resets the form
    window.addEventListener("popup-opened", function (e) {
      if (e.detail.id !== "edit-project-name-popup") return;
      const nameInput = document.getElementById("id_edit_project_name");
      if (nameInput) nameInput.value = pendingName;
    });

    if (typeof window.initPopupForm === "function") {
      window.initPopupForm("edit-project-name-form", "edit-project-name-error");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
