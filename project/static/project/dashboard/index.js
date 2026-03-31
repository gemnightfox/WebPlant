/**
 * Project dashboard: inline group rename, delete groups and tasks via AJAX.
 */
(function () {
  function getCsrfToken() {
    var input = document.querySelector('input[name="csrfmiddlewaretoken"]');
    if (input) return input.value;
    var match = document.cookie.match(/csrftoken=([^;]+)/);
    return match ? match[1] : "";
  }

  // ---- Inline group rename ----

  function enterGroupEditMode(header) {
    header.classList.add("Dashboard-groupHeader--editing");
    var input = header.querySelector(".Dashboard-groupNameInput");
    if (input) { input.value = header.getAttribute("data-group-name") || ""; input.focus(); input.select(); }
  }

  function exitGroupEditMode(header) {
    header.classList.remove("Dashboard-groupHeader--editing");
  }

  function saveGroupName(header) {
    var input = header.querySelector(".Dashboard-groupNameInput");
    var groupId = header.getAttribute("data-group-id");
    var position = header.getAttribute("data-group-position");
    var projectId = (document.querySelector(".Dashboard") || { dataset: {} }).dataset.dashboardPath;
    var newName = input ? input.value.trim() : "";
    if (!newName || !groupId) return;

    var formData = new FormData();
    formData.append("name", newName);
    formData.append("position", position || "0");
    formData.append("project", projectId);

    fetch("/group/edit/" + groupId + "/", {
      method: "POST",
      headers: { "X-Requested-With": "XMLHttpRequest", "X-CSRFToken": getCsrfToken() },
      body: formData,
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data && data.status === "success") {
          var nameEl = header.querySelector(".Dashboard-groupName");
          if (nameEl) { nameEl.textContent = newName; nameEl.title = newName; }
          header.setAttribute("data-group-name", newName);
          exitGroupEditMode(header);
        } else {
          alert("Could not rename. Please try again.");
        }
      })
      .catch(function () { alert("Something went wrong. Please try again."); });
  }

  document.body.addEventListener("keydown", function (e) {
    var input = e.target.closest(".Dashboard-groupNameInput");
    if (!input) return;
    var header = input.closest(".Dashboard-groupHeader");
    if (!header) return;
    if (e.key === "Enter") { e.preventDefault(); saveGroupName(header); }
    if (e.key === "Escape") { exitGroupEditMode(header); }
  });

  function deleteRequest(url, onSuccess) {
    var doDelete = function () {
      fetch(url, {
        method: "POST",
        headers: {
          "X-Requested-With": "XMLHttpRequest",
          "X-CSRFToken": getCsrfToken(),
        },
      })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (data && data.status === "success") {
            onSuccess();
          } else {
            if (window.showAjaxError) window.showAjaxError(doDelete);
          }
        })
        .catch(function () {
          if (window.showAjaxError) window.showAjaxError(doDelete);
        });
    };
    doDelete();
  }

  function closeAllMenus() {
    var wrappers = document.querySelectorAll(".Dashboard-menuWrapper--open");
    wrappers.forEach(function (w) {
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

  document.body.addEventListener("change", function (e) {
    var checkbox = e.target.closest(".Dashboard-taskCheckbox");
    if (!checkbox) return;
    var taskId = checkbox.getAttribute("data-task-id");
    if (!taskId) return;

    var card = checkbox.closest(".Dashboard-task");
    if (!card) return;

    var wasChecked = checkbox.checked;
    var name = (card.querySelector(".Dashboard-taskName") || {}).textContent || "";
    var position = card.getAttribute("data-task-position") || "0";
    var groupId = card.getAttribute("data-task-group-id") || "";

    var formData = new FormData();
    formData.append("is_completed", wasChecked ? "on" : "");
    formData.append("name", name);
    formData.append("position", position);
    if (groupId) formData.append("group", groupId);

    var doToggle = function () {
      fetch("/task/edit/" + taskId + "/", {
        method: "POST",
        headers: { "X-Requested-With": "XMLHttpRequest", "X-CSRFToken": getCsrfToken() },
        body: formData,
      })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (data && data.status === "success") {
            card.classList.toggle("Dashboard-task--completed", wasChecked);
          } else {
            checkbox.checked = !wasChecked;
            if (window.showAjaxError) window.showAjaxError(doToggle);
          }
        })
        .catch(function () {
          checkbox.checked = !wasChecked;
          if (window.showAjaxError) window.showAjaxError(doToggle);
        });
    };
    doToggle();
  });

  document.body.addEventListener("click", function (e) {
    var insideMenuWrapper = e.target.closest(".Dashboard-menuWrapper");
    if (!insideMenuWrapper) {
      closeAllMenus();
    }

    if (e.target.closest(".Dashboard-groupSaveBtn")) {
      var header = e.target.closest(".Dashboard-groupHeader");
      if (header) saveGroupName(header);
      return;
    }

    if (e.target.closest(".Dashboard-groupCancelBtn")) {
      var header = e.target.closest(".Dashboard-groupHeader");
      if (header) exitGroupEditMode(header);
      return;
    }

    var menuToggle = e.target.closest(".Dashboard-menuToggle");
    if (menuToggle) {
      var wrapper = menuToggle.closest(".Dashboard-menuWrapper");
      if (!wrapper) return;
      var isOpen = wrapper.classList.contains("Dashboard-menuWrapper--open");
      closeAllMenus();
      if (!isOpen) {
        wrapper.classList.add("Dashboard-menuWrapper--open");
        if (wrapper.classList.contains("Dashboard-menuWrapper--task")) {
          var menu = wrapper.querySelector(".Dashboard-menu");
          var rect = menuToggle.getBoundingClientRect();
          menu.style.position = "fixed";
          menu.style.top = (rect.bottom + 4) + "px";
          menu.style.left = (rect.left + 10) + "px";
          menu.style.marginTop = "0";
        }
      }
      return;
    }

    var editGroupNameBtn = e.target.closest(".Dashboard-editGroupNameBtn");
    if (editGroupNameBtn) {
      closeAllMenus();
      var header = editGroupNameBtn.closest(".Dashboard-group").querySelector(".Dashboard-groupHeader");
      if (header && !header.classList.contains("Dashboard-groupHeader--editing")) enterGroupEditMode(header);
      return;
    }

    var groupBtn = e.target.closest(".Dashboard-deleteGroupBtn");
    if (groupBtn) {
      var groupId = groupBtn.getAttribute("data-group-id");
      if (!groupId) return;
      if (!confirm("Delete this group and all its tasks?")) return;
      deleteRequest("/group/delete/" + groupId + "/", function () {
        window.location.reload();
      });
      return;
    }

    var taskBtn = e.target.closest(".Dashboard-deleteTaskBtn");
    if (taskBtn) {
      var taskId = taskBtn.getAttribute("data-task-id");
      if (!taskId) return;
      if (!confirm("Delete this task?")) return;
      deleteRequest("/task/delete/" + taskId + "/", function () {
        window.location.reload();
      });
      return;
    }

    var duplicateGroupBtn = e.target.closest(".Dashboard-duplicateGroupBtn");
    if (duplicateGroupBtn) {
      closeAllMenus();
      var groupId = duplicateGroupBtn.getAttribute("data-group-id");
      var groupPosition = parseFloat(duplicateGroupBtn.getAttribute("data-group-position") || "0");
      if (!groupId) return;
      var groupLi = document.getElementById("group-" + groupId);
      var nextGroupLi = groupLi && groupLi.nextElementSibling;
      var nextGroupPosition = nextGroupLi ? parseFloat(nextGroupLi.getAttribute("data-group-position") || "NaN") : NaN;
      var newPosition = !isNaN(nextGroupPosition) ? (groupPosition + nextGroupPosition) / 2 : groupPosition + 1;
      fetch("/group/duplicate/" + groupId + "/" + newPosition + "/", {
        method: "POST",
        headers: { "X-Requested-With": "XMLHttpRequest", "X-CSRFToken": getCsrfToken() },
      })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (data && data.status === "success") {
            window.location.reload();
          } else {
            if (window.showAjaxError) window.showAjaxError();
          }
        })
        .catch(function () {
          if (window.showAjaxError) window.showAjaxError();
        });
      return;
    }

    var duplicateTaskBtn = e.target.closest(".Dashboard-duplicateTaskBtn");
    if (duplicateTaskBtn) {
      closeAllMenus();
      var taskId = duplicateTaskBtn.getAttribute("data-task-id");
      var taskPosition = parseFloat(duplicateTaskBtn.getAttribute("data-task-position") || "0");
      if (!taskId) return;
      var taskLi = duplicateTaskBtn.closest(".Dashboard-task");
      var nextTaskLi = taskLi && taskLi.nextElementSibling;
      var nextTaskPosition = nextTaskLi ? parseFloat(nextTaskLi.getAttribute("data-task-position") || "NaN") : NaN;
      var newPosition = !isNaN(nextTaskPosition) ? (taskPosition + nextTaskPosition) / 2 : taskPosition + 1;
      fetch("/task/duplicate/" + taskId + "/" + newPosition + "/", {
        method: "POST",
        headers: { "X-Requested-With": "XMLHttpRequest", "X-CSRFToken": getCsrfToken() },
      })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (data && data.status === "success") {
            window.location.reload();
          } else {
            if (window.showAjaxError) window.showAjaxError();
          }
        })
        .catch(function () {
          if (window.showAjaxError) window.showAjaxError();
        });
      return;
    }

    var deleteTaskBtn = e.target.closest(".Dashboard-deleteTaskMenuBtn");
    if (deleteTaskBtn) {
      closeAllMenus();
      var taskId = deleteTaskBtn.getAttribute("data-task-id");
      if (!taskId) return;
      if (!confirm("Delete this task?")) return;
      var doDelete = function () {
        fetch("/task/delete/" + taskId + "/", {
          method: "POST",
          headers: { "X-Requested-With": "XMLHttpRequest", "X-CSRFToken": getCsrfToken() },
        })
          .then(function (r) { return r.json(); })
          .then(function (data) {
            if (data && data.status === "success") {
              window.location.reload();
            } else {
              if (window.showAjaxError) window.showAjaxError(doDelete);
            }
          })
          .catch(function () {
            if (window.showAjaxError) window.showAjaxError(doDelete);
          });
      };
      doDelete();
      return;
    }

  });

  // Render deadline badges using user's local timezone
  function renderDeadlineBadges() {
    var cards = document.querySelectorAll(".Dashboard-task[data-task-deadline]");
    cards.forEach(function (card) {
      var iso = card.getAttribute("data-task-deadline");
      var badge = card.querySelector(".Dashboard-taskDeadlineBadge");
      if (!badge) return;
      if (!iso) { badge.setAttribute("hidden", ""); return; }
      var parts = iso.split("-");
      var d = parts.length === 3 ? new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10)) : null;
      if (!d || isNaN(d.getTime())) { badge.setAttribute("hidden", ""); return; }
      var today = new Date(); today.setHours(0, 0, 0, 0);
      var isOverdue = d < today;
      badge.textContent = d.toLocaleString(undefined, { month: "short", day: "numeric" });
      badge.removeAttribute("hidden");
      badge.classList.toggle("Dashboard-taskDeadlineBadge--overdue", isOverdue);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderDeadlineBadges);
  } else {
    renderDeadlineBadges();
  }

  var now = new Date();
  var offsetMinutes = -now.getTimezoneOffset();
  var offsetSign = offsetMinutes >= 0 ? "+" : "-";
  var offsetHours = Math.floor(Math.abs(offsetMinutes) / 60);
  var offsetMins = Math.abs(offsetMinutes) % 60;
  var utcOffset = "UTC" + offsetSign + String(offsetHours).padStart(2, "0") + ":" + String(offsetMins).padStart(2, "0");
  console.log("Timezone:", Intl.DateTimeFormat().resolvedOptions().timeZone);
  console.log("UTC offset:", utcOffset);
  console.log("Current time (UTC):", now.toUTCString());
})();
