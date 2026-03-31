/**
 * Create workspace role popup. Binds AJAX form submit; popup.js handles open/close and form success reload.
 */
(function () {
  function init() {
    if (typeof window.initPopupForm === "function") {
      window.initPopupForm("create-workspace-role-form", "workspace-role-error");
    }
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
