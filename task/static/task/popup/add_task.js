/**
 * Add task popup. Sets data-url from trigger data-group-id; binds AJAX form.
 */
(function () {
  function computeNextTaskPosition(groupId) {
    const groupEl = document.getElementById("group-" + groupId);
    if (!groupEl) return 0;
    const tasks = groupEl.querySelectorAll("[data-task-position]");
    if (tasks.length === 0) return 0;
    let maxPos = -Infinity;
    tasks.forEach(function (t) {
      const pos = parseFloat(t.getAttribute("data-task-position"));
      if (!isNaN(pos) && pos > maxPos) maxPos = pos;
    });
    return isFinite(maxPos) ? maxPos + 1 : 0;
  }

  function prepare(trigger) {
    const groupId = trigger.getAttribute("data-group-id");
    if (groupId) {
      const taskForm = document.getElementById("add-task-form");
      if (taskForm) {
        taskForm.setAttribute("data-url", "/task/create-new/" + groupId + "/");
        taskForm.setAttribute("data-group-id", groupId);
      }
      const posInput = document.getElementById("add-task-position-input");
      if (posInput) posInput.value = computeNextTaskPosition(groupId);
    }
  }

  function init() {
    if (window.popupPrepare) window.popupPrepare["add-task-popup"] = prepare;
    var nameInput = document.getElementById("id_task_name");
    var form = document.getElementById("add-task-form");
    if (nameInput) {
      nameInput.addEventListener("input", function () { nameInput.style.height = "auto"; nameInput.style.height = nameInput.scrollHeight + "px"; });
      nameInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (form) form.requestSubmit(); }
      });
    }
    if (form) {
      form.addEventListener("submit", function (e) {
        if (nameInput && !nameInput.value.trim()) {
          e.preventDefault(); e.stopImmediatePropagation();
          var errorEl = form.querySelector('[data-role="task-error"]');
          if (errorEl) { errorEl.textContent = "Task name cannot be empty."; errorEl.removeAttribute("hidden"); }
        }
      }, true);
    }
    if (typeof window.initPopupForm === "function") window.initPopupForm("add-task-form", "task-error");
    window.addEventListener("popup-form-success", function (e) {
      if (e.detail.formId !== "add-task-form") return;
      var popup = document.getElementById("add-task-popup");
      if (!popup) return;
      var successBlock = popup.querySelector(".Popup-success");
      var formWrap = popup.querySelector(".Popup-formWrap");
      if (successBlock) successBlock.setAttribute("hidden", "");
      if (formWrap) formWrap.removeAttribute("hidden");
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
