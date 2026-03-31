/**
 * Add workspace popup. Binds AJAX form submit; popup.js handles open/close and form success reload.
 */
(function () {
  function init() {
    if (typeof window.initPopupForm === "function") {
      window.initPopupForm("add-workspace-form", "workspace-error");
    }
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
