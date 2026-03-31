/**
 * Reusable popup/modal behavior. Use with templates/popup.html (or child templates).
 * - Open: window.openPopup('popup-id') or <button data-popup="popup-id">.
 * - Close: .Popup-close button, Escape, or clicking the backdrop.
 * - Before open: window.popupPrepare[id](trigger) is called if set by a per-popup script.
 * - After open: "popup-opened" event is dispatched with detail: { id, popupEl }.
 * - Forms: bind via window.initPopupForm(formId, errorDataRole). On success, "popup-form-success" is dispatched with detail: { formId, form, data }.
 */
(function () {
  if (!window.popupPrepare) window.popupPrepare = {};

  /* --- Open/close popup --- */
  function openPopup(id) {
    const el = document.getElementById(id);
    if (!el || !el.classList.contains("Popup")) return;

    const form = el.querySelector(".Popup-form");
    if (form) {
      form.reset();
      form.style.display = "";
    }

    const formWrap = el.querySelector(".Popup-formWrap");
    const successBlock = el.querySelector(".Popup-success");
    if (formWrap && successBlock) {
      formWrap.removeAttribute("hidden");
      successBlock.setAttribute("hidden", "");
    }

    el.removeAttribute("hidden");
    el.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";

    const focusTarget = el.querySelector(
      'input:not([type="hidden"]), textarea, select, button, [tabindex]:not([tabindex="-1"])'
    );
    if (focusTarget && typeof focusTarget.focus === "function") {
      setTimeout(() => {
        try { focusTarget.focus(); } catch (_) {}
      }, 0);
    }
  }

  function closePopup(el) {
    if (!el || !el.classList.contains("Popup")) return;
    el.setAttribute("hidden", "");
    el.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  function bindCloseHandlers(popup) {
    if (!popup || !popup.classList.contains("Popup")) return;
    const closeBtn = popup.querySelector(".Popup-close");
    const backdrop = popup.querySelector(".Popup-backdrop");
    if (closeBtn) closeBtn.addEventListener("click", () => closePopup(popup));
    if (backdrop) backdrop.addEventListener("click", () => closePopup(popup));
  }

  function getTaskUrlPrefix() {
    const pathname = window.location.pathname || "";
    const match = pathname.match(/^(.*?)dashboard/);
    return match ? match[1] : "/";
  }

  /* --- data-popup trigger: call prepare hook then open --- */
  document.body.addEventListener("click", (e) => {
    const trigger = e.target.closest("[data-popup]");
    if (!trigger) return;
    const id = trigger.getAttribute("data-popup");
    if (!id) return;

    const prepare = window.popupPrepare && window.popupPrepare[id];
    if (typeof prepare === "function") prepare(trigger);

    openPopup(id);

    const popupEl = document.getElementById(id);
    if (popupEl) {
      window.dispatchEvent(new CustomEvent("popup-opened", { detail: { id, popupEl } }));
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const popup = document.querySelector(".Popup:not([hidden])");
    if (popup) closePopup(popup);
  });

  function initPopups() {
    document.querySelectorAll(".Popup").forEach((popup) => {
      bindCloseHandlers(popup);
      popup.querySelectorAll(".Popup-actions").forEach((actions) => {
        if (actions.closest(".Popup-success")) return;
        const cancelBtn = document.createElement("button");
        cancelBtn.type = "button";
        cancelBtn.className = "Popup-cancelBtn";
        cancelBtn.textContent = "Cancel";
        cancelBtn.addEventListener("click", () => closePopup(popup));
        actions.insertBefore(cancelBtn, actions.firstChild);
      });
    });
  }

  /**
   * AJAX form handler. Form must have id, data-url (set by backend or by popupPrepare), and optional [data-role="...-error"].
   * On success, dispatches "popup-form-success" with detail: { formId, form, data }, then handles reopen pending-invites and reload.
   */
  function initPopupForm(formId, errorDataRole) {
    const form = document.getElementById(formId);
    if (!form || form.dataset.popupBound === "1") return;
    form.dataset.popupBound = "1";

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const url = form.getAttribute("data-url");
      if (!url) {
        form.submit();
        return;
      }

      const csrfInput = form.querySelector('input[name="csrfmiddlewaretoken"]');
      const csrfToken = csrfInput ? csrfInput.value : "";
      const errorEl = form.querySelector('[data-role="' + errorDataRole + '"]');
      if (errorEl) errorEl.setAttribute("hidden", "");

      const doSubmit = () => {
        fetch(url, {
          method: "POST",
          headers: { "X-Requested-With": "XMLHttpRequest", "X-CSRFToken": csrfToken },
          body: new FormData(form),
        })
          .then((r) => r.json())
          .then((data) => {
            const popup = form.closest(".Popup");
            const formWrap = popup ? popup.querySelector(".Popup-formWrap") : null;
            const successBlock = popup ? popup.querySelector(".Popup-success") : null;
            if (data && data.status === "success") {
              if (formWrap && successBlock) {
                formWrap.setAttribute("hidden", "");
                successBlock.removeAttribute("hidden");
              }
              window.dispatchEvent(new CustomEvent("popup-form-success", { detail: { formId: form.id, form, data } }));
              const pendingInvitesPopup = document.getElementById("pending-invites-popup");
              if (pendingInvitesPopup && !pendingInvitesPopup.hasAttribute("hidden")) {
                try { sessionStorage.setItem("reopen_pending_invites_popup", "1"); } catch (_) {}
              }
              window.location.reload();
            } else {
              if (errorEl) errorEl.removeAttribute("hidden");
              if (window.showAjaxError) window.showAjaxError(doSubmit);
            }
          })
          .catch(() => {
            if (errorEl) errorEl.removeAttribute("hidden");
            if (window.showAjaxError) window.showAjaxError(doSubmit);
          });
      };
      doSubmit();
    });
  }

  /* --- AJAX error toast with retry --- */
  function showAjaxError(retryFn) {
    var toast = document.getElementById("AjaxToast");
    if (!toast) return;
    var retryBtn = toast.querySelector(".AjaxToast-retryBtn");
    var closeBtn = toast.querySelector(".AjaxToast-closeBtn");
    // Replace retry button to clear old listeners
    if (retryBtn) {
      var newRetry = retryBtn.cloneNode(true);
      retryBtn.parentNode.replaceChild(newRetry, retryBtn);
      newRetry.addEventListener("click", function () {
        toast.setAttribute("hidden", "");
        if (typeof retryFn === "function") retryFn();
      });
    }
    if (closeBtn) closeBtn.onclick = function () { toast.setAttribute("hidden", ""); };
    toast.removeAttribute("hidden");
  }

  function runInit() {
    initPopups();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", runInit);
  } else {
    runInit();
  }

  window.openPopup = openPopup;
  window.closePopup = closePopup;
  window.getTaskUrlPrefix = getTaskUrlPrefix;
  window.initPopupForm = initPopupForm;
  window.showAjaxError = showAjaxError;
})();
