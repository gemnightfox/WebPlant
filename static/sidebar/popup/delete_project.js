/**
 * Delete project popup. Sets data-url and project name from trigger
 * data-project-id / data-project-name. Redirects to "/" if on the deleted
 * project's page, otherwise reloads.
 */
(function () {
  var pendingProjectId = null;

  function prepare(trigger) {
    const projectId = trigger.getAttribute("data-project-id");
    const projectName = trigger.getAttribute("data-project-name") || "this project";
    pendingProjectId = projectId;
    if (!projectId) return;
    const form = document.getElementById("delete-project-form");
    if (form) form.setAttribute("data-url", "/project/delete/" + projectId + "/");
    const nameEl = document.getElementById("delete-project-name");
    if (nameEl) nameEl.textContent = projectName;
  }

  function bindForm() {
    const form = document.getElementById("delete-project-form");
    if (!form || form.dataset.popupBound === "1") return;
    form.dataset.popupBound = "1";

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      const url = form.getAttribute("data-url");
      if (!url) return;
      const csrfInput = form.querySelector('input[name="csrfmiddlewaretoken"]');
      const csrfToken = csrfInput ? csrfInput.value : "";
      const errorEl = form.querySelector('[data-role="delete-project-error"]');
      if (errorEl) errorEl.setAttribute("hidden", "");

      const doSubmit = function () {
        fetch(url, {
          method: "POST",
          headers: { "X-Requested-With": "XMLHttpRequest", "X-CSRFToken": csrfToken },
          body: new FormData(form),
        })
          .then(function (r) { return r.json(); })
          .then(function (data) {
            if (data && data.status === "success") {
              const deletedId = pendingProjectId;
              if (deletedId && window.location.pathname.includes(deletedId)) {
                window.location.href = "/";
              } else {
                window.location.reload();
              }
            } else {
              if (errorEl) errorEl.removeAttribute("hidden");
              if (window.showAjaxError) window.showAjaxError(doSubmit);
            }
          })
          .catch(function () {
            if (errorEl) errorEl.removeAttribute("hidden");
            if (window.showAjaxError) window.showAjaxError(doSubmit);
          });
      };
      doSubmit();
    });
  }

  function init() {
    if (window.popupPrepare) window.popupPrepare["delete-project-popup"] = prepare;
    bindForm();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
