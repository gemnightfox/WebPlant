/**
 * Add project popup. Sets data-url and hidden workspace from trigger data-workspace-id; binds AJAX form; saves workspace to localStorage on success.
 */
(function () {
  function prepare(trigger) {
    const workspaceId = trigger.getAttribute("data-workspace-id");
    if (!workspaceId) return;
    const popupEl = document.getElementById("add-project-popup");
    if (popupEl) {
      const wsInput = popupEl.querySelector('input[name="workspace"]');
      if (wsInput) wsInput.value = workspaceId;
    }
    const projectForm = document.getElementById("add-project-form");
    if (projectForm) projectForm.setAttribute("data-url", "/project/create-new/" + workspaceId + "/");
  }

  function onFormSuccess(_e) {
    const detail = _e.detail;
    if (detail.formId !== "add-project-form") return;
    const form = detail.form;
    const wsInput = form && form.querySelector('input[name="workspace"]');
    if (wsInput && wsInput.value) {
      try { localStorage.setItem("base_open_workspace", wsInput.value); } catch (_) {}
    }
    if (window.WebPlantSidebarProjectSync && typeof window.WebPlantSidebarProjectSync.notifyProjectListChanged === "function") {
      window.WebPlantSidebarProjectSync.notifyProjectListChanged("create");
    }
  }

  function init() {
    if (window.popupPrepare) window.popupPrepare["add-project-popup"] = prepare;
    window.addEventListener("popup-form-success", onFormSuccess);
    if (typeof window.initPopupForm === "function") {
      window.initPopupForm("add-project-form", "project-error");
    }
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
