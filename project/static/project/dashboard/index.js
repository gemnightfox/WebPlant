/**
 * Project dashboard: delete groups and tasks via AJAX; group rename uses edit-group popup.
 */
(function () {
  function getCsrfToken() {
    var input = document.querySelector('input[name="csrfmiddlewaretoken"]');
    if (input) return input.value;
    var match = document.cookie.match(/csrftoken=([^;]+)/);
    return match ? match[1] : "";
  }

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
            card.setAttribute("data-task-completed", wasChecked ? "true" : "false");
            if (typeof data.position === "number") {
              card.setAttribute("data-task-position", String(data.position));
            }
            if (wasChecked) {
              var taskList = card.closest(".Dashboard-tasks");
              if (taskList) taskList.appendChild(card);
            }
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

  // Deadline badges: calendar date vs "today" in account timezone (data-user-timezone); helpers from edit_task.js
  function renderDeadlineBadges() {
    var W = window.WebPlantAccountTimezone;
    var tz =
      W && typeof W.getEffective === "function"
        ? W.getEffective()
        : (function () {
            try {
              var raw = document.body && document.body.getAttribute("data-user-timezone");
              if (raw && raw.trim()) return raw.trim();
              return Intl.DateTimeFormat().resolvedOptions().timeZone;
            } catch (e) {
              return "UTC";
            }
          })();
    var ymdInTz =
      W && typeof W.ymdInTz === "function"
        ? W.ymdInTz
        : function (ms, t) {
            return new Intl.DateTimeFormat("en-CA", {
              timeZone: t,
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
            }).format(new Date(ms));
          };
    var startOfDayInTz = W && typeof W.startOfDayInTz === "function" ? W.startOfDayInTz : null;
    var todayStr = ymdInTz(Date.now(), tz);

    var cards = document.querySelectorAll(".Dashboard-task[data-task-deadline]");
    cards.forEach(function (card) {
      var iso = card.getAttribute("data-task-deadline");
      var badge = card.querySelector(".Dashboard-taskDeadlineBadge");
      if (!badge) return;
      if (!iso) {
        badge.setAttribute("hidden", "");
        return;
      }
      var dms = Date.parse(iso);
      if (!isNaN(dms)) {
        badge.textContent = new Intl.DateTimeFormat(undefined, {
          timeZone: tz,
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        }).format(new Date(dms));
        badge.removeAttribute("hidden");
        badge.classList.toggle("Dashboard-taskDeadlineBadge--overdue", dms < Date.now());
        return;
      }
      var parts = iso.split("-");
      if (parts.length !== 3 || !startOfDayInTz) {
        badge.setAttribute("hidden", "");
        return;
      }
      var yy = parseInt(parts[0], 10);
      var mm = parseInt(parts[1], 10);
      var dd = parseInt(parts[2], 10);
      if (isNaN(yy) || isNaN(mm) || isNaN(dd)) {
        badge.setAttribute("hidden", "");
        return;
      }
      var ms = startOfDayInTz(yy, mm, dd, tz);
      var overdue = false;
      try {
        var nextDate = new Date(Date.UTC(yy, mm - 1, dd));
        nextDate.setUTCDate(nextDate.getUTCDate() + 1);
        var nextStartMs = startOfDayInTz(
          nextDate.getUTCFullYear(),
          nextDate.getUTCMonth() + 1,
          nextDate.getUTCDate(),
          tz
        );
        overdue = Date.now() >= nextStartMs;
      } catch (e) {
        overdue = iso < todayStr;
      }
      badge.textContent = new Intl.DateTimeFormat(undefined, {
        timeZone: tz,
        month: "short",
        day: "numeric",
      }).format(new Date(ms));
      badge.removeAttribute("hidden");
      badge.classList.toggle("Dashboard-taskDeadlineBadge--overdue", overdue);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderDeadlineBadges);
  } else {
    renderDeadlineBadges();
  }
})();
