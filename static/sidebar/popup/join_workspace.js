/**
 * Join workspace popup. Two-step flow:
 *   Step 1 — invite code only. Transitions to step 2 if the code requires a password (5xx),
 *             shows success if no password needed (200 success), or shows an error (404 / already member).
 *   Step 2 — password only. Shows success or wrong-password error.
 * On popup close after any successful join the page reloads so the sidebar updates.
 */
(function () {
  var hadSuccess = false;

  function getEl(id) {
    return document.getElementById(id);
  }

  function setTitle(text) {
    var h2 = getEl("join-workspace-popup-title");
    if (h2) h2.textContent = text;
  }

  function hideErrors() {
    ["join-invalid-code", "join-already-member", "join-wrong-password", "join-already-member-step2"].forEach(function (role) {
      var el = document.querySelector('[data-role="' + role + '"]');
      if (el) el.setAttribute("hidden", "");
    });
    var hint = getEl("invite-code-hint");
    if (hint) hint.setAttribute("hidden", "");
  }

  function showStep(step) {
    var step1 = getEl("join-step1");
    var step2 = getEl("join-step2");
    var formWrap = document.querySelector("#join-workspace-popup .Popup-formWrap");
    var success = document.querySelector("#join-workspace-popup .Popup-success");

    if (step === 1) {
      if (formWrap) formWrap.removeAttribute("hidden");
      if (step1) step1.removeAttribute("hidden");
      if (step2) step2.setAttribute("hidden", "");
      if (success) success.setAttribute("hidden", "");
      setTitle("Join workspace using invite code");
    } else if (step === 2) {
      if (formWrap) formWrap.removeAttribute("hidden");
      if (step1) step1.setAttribute("hidden", "");
      if (step2) step2.removeAttribute("hidden");
      if (success) success.setAttribute("hidden", "");
      setTitle("Enter workspace password");
      var pwInput = getEl("id_join_password");
      if (pwInput) setTimeout(function () { pwInput.focus(); }, 0);
    } else if (step === "success") {
      if (formWrap) formWrap.setAttribute("hidden", "");
      if (success) success.removeAttribute("hidden");
      setTitle("Join workspace using invite code");
    }
  }

  function resetToStep1() {
    hideErrors();
    var form1 = getEl("join-workspace-form");
    var form2 = getEl("join-workspace-password-form");
    if (form1) form1.reset();
    if (form2) form2.reset();
    showStep(1);
    var codeInput = getEl("id_invite_code");
    if (codeInput) setTimeout(function () { codeInput.focus(); }, 0);
  }

  function initCodeInput() {
    var input = getEl("id_invite_code");
    var hint = getEl("invite-code-hint");
    if (!input) return;

    input.addEventListener("input", function () {
      var pos = input.selectionStart;
      input.value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 16);
      input.setSelectionRange(pos, pos);
      if (hint && input.value.length >= 16) {
        hint.setAttribute("hidden", "");
      }
    });
  }

  function initStep1Form() {
    var form = getEl("join-workspace-form");
    if (!form || form.dataset.popupBound === "1") return;
    form.dataset.popupBound = "1";

    var errorCode = form.querySelector('[data-role="join-invalid-code"]');
    var errorAlready = form.querySelector('[data-role="join-already-member"]');
    var hint = getEl("invite-code-hint");

    form.addEventListener("submit", function (e) {
      e.preventDefault();

      var codeInput = getEl("id_invite_code");
      if (codeInput && codeInput.value.length < 16) {
        if (hint) {
          hint.textContent = "16 characters needed. You only have " + codeInput.value.length + ".";
          hint.removeAttribute("hidden");
        }
        return;
      }

      if (errorCode) errorCode.setAttribute("hidden", "");
      if (errorAlready) errorAlready.setAttribute("hidden", "");

      var url = form.getAttribute("data-url");
      var csrfInput = form.querySelector('[name="csrfmiddlewaretoken"]');
      var csrf = csrfInput ? csrfInput.value : "";

      fetch(url, {
        method: "POST",
        headers: { "X-Requested-With": "XMLHttpRequest", "X-CSRFToken": csrf },
        body: new FormData(form),
      })
        .then(function (r) {
          if (r.status === 404) {
            if (errorCode) errorCode.removeAttribute("hidden");
            return null;
          }
          if (!r.ok) {
            // Code is valid but requires a password — move to step 2
            var code = codeInput ? codeInput.value : "";
            var hiddenInput = getEl("id_invite_code_step2");
            if (hiddenInput) hiddenInput.value = code;
            showStep(2);
            return null;
          }
          return r.json();
        })
        .then(function (data) {
          if (!data) return;
          if (data.status === "success") {
            hadSuccess = true;
            showStep("success");
          } else {
            if (errorAlready) errorAlready.removeAttribute("hidden");
          }
        })
        .catch(function () {
          if (errorCode) errorCode.removeAttribute("hidden");
        });
    });
  }

  function initStep2Form() {
    var form = getEl("join-workspace-password-form");
    if (!form || form.dataset.popupBound === "1") return;
    form.dataset.popupBound = "1";

    var errorPw = form.querySelector('[data-role="join-wrong-password"]');
    var errorAlready = form.querySelector('[data-role="join-already-member-step2"]');

    form.addEventListener("submit", function (e) {
      e.preventDefault();

      if (errorPw) errorPw.setAttribute("hidden", "");
      if (errorAlready) errorAlready.setAttribute("hidden", "");

      var url = form.getAttribute("data-url");
      var csrfInput = form.querySelector('[name="csrfmiddlewaretoken"]');
      var csrf = csrfInput ? csrfInput.value : "";

      fetch(url, {
        method: "POST",
        headers: { "X-Requested-With": "XMLHttpRequest", "X-CSRFToken": csrf },
        body: new FormData(form),
      })
        .then(function (r) {
          if (!r.ok) {
            if (errorPw) errorPw.removeAttribute("hidden");
            return null;
          }
          return r.json();
        })
        .then(function (data) {
          if (!data) return;
          if (data.status === "success") {
            hadSuccess = true;
            showStep("success");
          } else {
            if (errorAlready) errorAlready.removeAttribute("hidden");
          }
        })
        .catch(function () {
          if (errorPw) errorPw.removeAttribute("hidden");
        });
    });
  }

  function initButtons() {
    var backBtn = getEl("join-step2-back");
    if (backBtn) {
      backBtn.addEventListener("click", function () {
        hideErrors();
        showStep(1);
      });
    }

    var joinAnotherBtn = getEl("join-another-btn");
    if (joinAnotherBtn) {
      joinAnotherBtn.addEventListener("click", function () {
        resetToStep1();
      });
    }
  }

  function initPopupBehavior() {
    // Reset state whenever the popup is opened
    window.popupPrepare = window.popupPrepare || {};
    window.popupPrepare["join-workspace-popup"] = function () {
      hadSuccess = false;
      resetToStep1();
    };

    // Reload page on close if at least one join was successful (updates sidebar)
    var popupEl = getEl("join-workspace-popup");
    if (popupEl && typeof MutationObserver !== "undefined") {
      var observer = new MutationObserver(function (mutations) {
        for (var i = 0; i < mutations.length; i++) {
          if (mutations[i].attributeName === "hidden" && popupEl.hasAttribute("hidden") && hadSuccess) {
            hadSuccess = false;
            window.location.reload();
            return;
          }
        }
      });
      observer.observe(popupEl, { attributes: true, attributeFilter: ["hidden"] });
    }
  }

  function init() {
    initCodeInput();
    initStep1Form();
    initStep2Form();
    initButtons();
    initPopupBehavior();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
