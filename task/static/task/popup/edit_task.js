/**
 * Edit task popup (task app). Opens on task card click.
 * Supports: inline rename, delete, deadline (calendar + drag spinners).
 */
(function () {
  function getCsrfToken() {
    var input = document.querySelector('input[name="csrfmiddlewaretoken"]');
    if (input) return input.value;
    var match = document.cookie.match(/csrftoken=([^;]+)/);
    return match ? match[1] : "";
  }

  var currentTaskId = null;
  var currentGroupId = null;

  var EDIT_TASK_POPUP_STORAGE_KEY = "webplant_edit_task_popup";

  function getDashboardProjectId() {
    var dash = document.querySelector(".Dashboard[data-dashboard-path]");
    return dash ? String(dash.getAttribute("data-dashboard-path") || "") : "";
  }

  function persistEditTaskPopupOpen() {
    try {
      var projectId = getDashboardProjectId();
      if (!projectId || !currentTaskId) return;
      sessionStorage.setItem(
        EDIT_TASK_POPUP_STORAGE_KEY,
        JSON.stringify({ projectId: projectId, taskId: currentTaskId })
      );
    } catch (e) {}
  }

  function clearEditTaskPopupPersist() {
    try {
      sessionStorage.removeItem(EDIT_TASK_POPUP_STORAGE_KEY);
    } catch (e) {}
  }

  function tryRestoreEditTaskPopup(prepareFn) {
    var projectId = getDashboardProjectId();
    if (!projectId) return;
    var raw;
    try {
      raw = sessionStorage.getItem(EDIT_TASK_POPUP_STORAGE_KEY);
    } catch (e) {
      return;
    }
    if (!raw) return;
    var data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      clearEditTaskPopupPersist();
      return;
    }
    if (!data || !data.taskId) {
      clearEditTaskPopupPersist();
      return;
    }
    if (String(data.projectId) !== String(projectId)) {
      clearEditTaskPopupPersist();
      return;
    }
    var taskIdStr = String(data.taskId);
    var card = document.querySelector(
      '.Dashboard-task[data-task-id="' + taskIdStr.replace(/"/g, "") + '"]'
    );
    if (!card) {
      clearEditTaskPopupPersist();
      return;
    }
    window.openPopup("edit-task-popup");
    prepareFn(card);
    focusEditTaskPopupContainer();
  }

  function getDashboardEl() {
    return document.querySelector('.Dashboard[data-current-user]');
  }
  function getCurrentUser() {
    var el = getDashboardEl();
    return el ? el.getAttribute('data-current-user') : '';
  }
  function getWorkspaceOwner() {
    var el = getDashboardEl();
    return el ? el.getAttribute('data-workspace-owner') : '';
  }
  function canManageComment(addedBy) {
    var me = getCurrentUser();
    return me && (me === addedBy || me === getWorkspaceOwner());
  }

  // ── Calendar state ──────────────────────────────────────────────────────────
  var calendarYear  = new Date().getFullYear();
  var calendarMonth = new Date().getMonth();
  var calendarDay   = 0; // 0 = no date selected

  // ── Reminder calendar state ─────────────────────────────────────────────────
  var reminderYear  = new Date().getFullYear();
  var reminderMonth = new Date().getMonth();
  var reminderDay   = 0; // 0 = no date selected

  function pad2(n) { return String(n).padStart(2, "0"); }

  /** Write YYYY-MM-DD into the hidden deadline input. */
  function syncDeadlineHidden() {
    var dateInput = document.getElementById("edit-task-deadline-date");
    var hidden = document.getElementById("edit-task-deadline-value");
    if (!hidden) return;
    hidden.value = dateInput ? dateInput.value : "";
  }

  // ── Calendar (grid) ─────────────────────────────────────────────────────────

  var CAL_MONTHS = ["January","February","March","April","May","June",
                    "July","August","September","October","November","December"];
  var CAL_DAYS   = ["Su","Mo","Tu","We","Th","Fr","Sa"];

  function initToday() {
    var t = new Date();
    calendarDay   = t.getDate();
    calendarMonth = t.getMonth();
    calendarYear  = t.getFullYear();
  }

  function setDateFromParts() {
    var dateInput = document.getElementById("edit-task-deadline-date");
    if (!dateInput) return;
    dateInput.value = calendarDay > 0
      ? calendarYear + "-" + pad2(calendarMonth + 1) + "-" + pad2(calendarDay)
      : "";
    syncDeadlineHidden();
  }

  function renderCalendar() {
    var container = document.getElementById("edit-task-calendar");
    if (!container) return;
    var firstDay    = new Date(calendarYear, calendarMonth, 1).getDay();
    var daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
    var today       = new Date();
    var todayStr    = today.getFullYear() + "-" + pad2(today.getMonth() + 1) + "-" + pad2(today.getDate());
    var selStr      = calendarDay > 0
      ? calendarYear + "-" + pad2(calendarMonth + 1) + "-" + pad2(calendarDay)
      : "";

    var html = '<div class="Base-notifCalHeader">' +
      '<button type="button" class="Base-notifCalNav" data-cal-dir="-1">&#8249;</button>' +
      '<span class="Base-notifCalMonthYear">' + CAL_MONTHS[calendarMonth] + " " + calendarYear + "</span>" +
      '<button type="button" class="Base-notifCalNav" data-cal-dir="1">&#8250;</button>' +
      '</div><div class="Base-notifCalGrid">';
    CAL_DAYS.forEach(function (d) { html += '<span class="Base-notifCalDayName">' + d + "</span>"; });
    for (var i = 0; i < firstDay; i++) html += "<span></span>";
    for (var d = 1; d <= daysInMonth; d++) {
      var ds  = calendarYear + "-" + pad2(calendarMonth + 1) + "-" + pad2(d);
      var cls = "Base-notifCalDay";
      if (ds === selStr)   cls += " is-selected";
      if (ds === todayStr) cls += " is-today";
      if (ds < todayStr)   cls += " is-past";
      html += '<button type="button" class="' + cls + '"' + (ds < todayStr ? ' disabled' : '') + ' data-cal-date="' + ds + '">' + d + "</button>";
    }
    html += "</div>";
    container.className = "Base-notifCalendar";
    container.innerHTML = html;
  }

  // ── Reminder calendar (grid) ────────────────────────────────────────────────

  function renderReminderCalendar() {
    var container = document.getElementById("edit-task-reminder-calendar");
    if (!container) return;
    var firstDay    = new Date(reminderYear, reminderMonth, 1).getDay();
    var daysInMonth = new Date(reminderYear, reminderMonth + 1, 0).getDate();
    var today       = new Date();
    var todayStr    = today.getFullYear() + "-" + pad2(today.getMonth() + 1) + "-" + pad2(today.getDate());
    var selStr      = reminderDay > 0
      ? reminderYear + "-" + pad2(reminderMonth + 1) + "-" + pad2(reminderDay)
      : "";

    var html = '<div class="Base-notifCalHeader">' +
      '<button type="button" class="Base-notifCalNav" data-reminder-cal-dir="-1">&#8249;</button>' +
      '<span class="Base-notifCalMonthYear">' + CAL_MONTHS[reminderMonth] + " " + reminderYear + "</span>" +
      '<button type="button" class="Base-notifCalNav" data-reminder-cal-dir="1">&#8250;</button>' +
      '</div><div class="Base-notifCalGrid">';
    CAL_DAYS.forEach(function (d) { html += '<span class="Base-notifCalDayName">' + d + "</span>"; });
    for (var i = 0; i < firstDay; i++) html += "<span></span>";
    for (var d = 1; d <= daysInMonth; d++) {
      var ds  = reminderYear + "-" + pad2(reminderMonth + 1) + "-" + pad2(d);
      var cls = "Base-notifCalDay";
      if (ds === selStr)   cls += " is-selected";
      if (ds === todayStr) cls += " is-today";
      if (ds < todayStr)   cls += " is-past";
      html += '<button type="button" class="' + cls + '"' + (ds < todayStr ? ' disabled' : '') + ' data-reminder-cal-date="' + ds + '">' + d + "</button>";
    }
    html += "</div>";
    container.className = "Base-notifCalendar";
    container.innerHTML = html;
  }

  // ── Populate deadline from ISO UTC ──────────────────────────────────────────

  function canEditTaskDeadline() {
    var dash = document.querySelector(".Dashboard[data-dashboard-path]");
    return !!(dash && dash.getAttribute("data-can-edit-task-deadline") === "true");
  }

  function applyEditTaskDeadlinePermission() {
    var can = canEditTaskDeadline();
    var addBtn = document.getElementById("edit-task-add-deadline-btn");
    var removeBtn = document.getElementById("edit-task-remove-deadline-btn");
    var displayRow = document.getElementById("edit-task-deadline-display");
    var picker = document.getElementById("edit-task-deadline-picker");
    if (addBtn) {
      if (can) {
        addBtn.removeAttribute("hidden");
        addBtn.classList.remove("Popup-panelRow--noAccess");
        addBtn.removeAttribute("aria-disabled");
      } else {
        addBtn.classList.add("Popup-panelRow--noAccess");
        addBtn.setAttribute("aria-disabled", "true");
        var hasDeadline = displayRow && !displayRow.hasAttribute("hidden");
        if (hasDeadline) {
          addBtn.setAttribute("hidden", "");
        } else {
          addBtn.removeAttribute("hidden");
        }
      }
    }
    if (removeBtn && displayRow) {
      if (can && !displayRow.hasAttribute("hidden")) removeBtn.removeAttribute("hidden");
      else removeBtn.setAttribute("hidden", "");
    }
    if (!can && picker) picker.setAttribute("hidden", "");
    if (displayRow) {
      if (can) displayRow.classList.remove("Popup-deadlineDisplay--readOnly");
      else displayRow.classList.add("Popup-deadlineDisplay--readOnly");
    }
  }

  function updateDeadlineBtn() {
    var displayRow = document.getElementById("edit-task-deadline-display");
    var displayText = document.getElementById("edit-task-deadline-display-text");
    var dateInput = document.getElementById("edit-task-deadline-date");
    if (!displayRow || !displayText) return;
    if (dateInput && dateInput.value) {
      var p = dateInput.value.split("-");
      var months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      displayText.textContent = parseInt(p[2], 10) + " " + months[parseInt(p[1], 10) - 1] + " " + p[0];
      displayRow.removeAttribute("hidden");
    } else {
      displayRow.setAttribute("hidden", "");
    }
    applyEditTaskDeadlinePermission();
  }

  function positionPicker(picker, anchorEl) {
    if (!anchorEl) return;
    var rect = anchorEl.getBoundingClientRect();
    var top  = rect.bottom + 4;
    var left = rect.left;
    var availableW = window.innerWidth - 8 - left;
    var width = Math.min(300, availableW);
    if (top + 380 > window.innerHeight - 8) top = window.innerHeight - 388;
    if (top < 8) top = 8;
    picker.style.top   = top + "px";
    picker.style.left  = left + "px";
    picker.style.width = width + "px";
  }

  function showDeadlinePicker(anchorEl) {
    if (!canEditTaskDeadline()) return;
    var picker = document.getElementById("edit-task-deadline-picker");
    if (!picker) return;
    positionPicker(picker, anchorEl);
    picker.removeAttribute("hidden");
  }

  function hideDeadlinePicker() {
    var picker = document.getElementById("edit-task-deadline-picker");
    if (picker) picker.setAttribute("hidden", "");
    var dateInput = document.getElementById("edit-task-deadline-date");
    if (dateInput) dateInput.value = "";
    var hidden = document.getElementById("edit-task-deadline-value");
    if (hidden) hidden.value = "";
    calendarDay = 0;
    updateDeadlineBtn();
  }

  function populateDeadline(iso) {
    var dateInput = document.getElementById("edit-task-deadline-date");
    var hidden = document.getElementById("edit-task-deadline-value");
    if (!dateInput || !hidden) return;
    var picker = document.getElementById("edit-task-deadline-picker");
    if (picker) picker.setAttribute("hidden", "");
    var parts = iso ? iso.split("-") : [];
    if (parts.length !== 3 || parts.some(function (p) { return isNaN(parseInt(p, 10)); })) {
      var t = new Date();
      calendarYear = t.getFullYear(); calendarMonth = t.getMonth(); calendarDay = 0;
      dateInput.value = ""; hidden.value = "";
      updateDeadlineBtn();
      return;
    }
    calendarYear  = parseInt(parts[0], 10);
    calendarMonth = parseInt(parts[1], 10) - 1;
    calendarDay   = parseInt(parts[2], 10);
    dateInput.value = calendarYear + "-" + pad2(calendarMonth + 1) + "-" + pad2(calendarDay);
    syncDeadlineHidden();
    updateDeadlineBtn();
  }


  // ── Reminder display & card data ────────────────────────────────────────────

  function getCurrentCard() {
    return currentTaskId
      ? document.querySelector('.Dashboard-task[data-task-id="' + currentTaskId + '"]')
      : null;
  }

  function formatReminderDisplay(isoStr) {
    if (!isoStr) return "";
    var d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    var months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return d.getDate() + " " + months[d.getMonth()] + " " + String(d.getFullYear()).slice(-2) + " (" + pad2(d.getHours()) + ":" + pad2(d.getMinutes()) + ")";
  }

  function setReminderTimeValue(timeStr) {
    var input = document.getElementById("edit-task-reminder-time");
    if (!input) return;
    var match = /^(\d{2}):(\d{2})$/.exec(timeStr || "");
    var h = match ? match[1] : "09";
    var m = match ? match[2] : "00";
    input.value = h + ":" + m;
  }

  function getReminderTimeValue() {
    var input = document.getElementById("edit-task-reminder-time");
    var raw = (input && input.value) ? input.value.trim() : "09:00";
    var match = /^(\d{1,2}):(\d{1,2})$/.exec(raw);
    if (!match) return "";
    var h = parseInt(match[1], 10);
    var m = parseInt(match[2], 10);
    if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) return "";
    return pad2(h) + ":" + pad2(m);
  }

  function getTaskReminders(taskId) {
    var el = document.getElementById('reminders-' + taskId);
    if (!el) return [];
    try { return JSON.parse(el.textContent.replace(/,\s*\]/g, ']')) || []; } catch(e) { return []; }
  }

  function updateTaskReminders(taskId, reminders) {
    var el = document.getElementById('reminders-' + taskId);
    if (el) el.textContent = JSON.stringify(reminders);
  }

  function renderReminders(taskId) {
    var list = document.getElementById('edit-task-reminders-list');
    if (!list) return;
    var reminders = getTaskReminders(taskId);
    list.innerHTML = '';
    reminders.forEach(function(r) {
      var li = document.createElement('li');
      li.className = 'TaskReminder';
      var textEl = document.createElement('span');
      textEl.className = 'TaskReminder-text';
      textEl.textContent = formatReminderDisplay(r.send_at);
      var removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'Popup-deadlineRemoveBtn';
      removeBtn.setAttribute('aria-label', 'Remove reminder');
      removeBtn.innerHTML = '&times;';
      removeBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        if (!confirm('Remove this reminder?')) return;
        var formData = new FormData();
        formData.append('csrfmiddlewaretoken', getCsrfToken());
        fetch(r.delete_url, {
          method: 'POST',
          headers: { 'X-Requested-With': 'XMLHttpRequest' },
          body: formData,
        })
          .then(function(resp) { return resp.json(); })
          .then(function(data) {
            if (data && data.status === 'success') {
              li.remove();
              var all = getTaskReminders(taskId);
              var idx = all.findIndex(function(x) { return x.id === r.id; });
              if (idx !== -1) all.splice(idx, 1);
              updateTaskReminders(taskId, all);
            }
          });
      });
      li.appendChild(textEl);
      li.appendChild(removeBtn);
      list.appendChild(li);
    });
  }

  function populateReminderFromCard(card) {
    var picker = document.getElementById("edit-task-reminder-picker");
    if (picker) picker.setAttribute("hidden", "");
    var t = new Date();
    reminderYear  = t.getFullYear();
    reminderMonth = t.getMonth();
    reminderDay   = 0;
    setReminderTimeValue("09:00");
    var taskId = card ? card.getAttribute("data-task-id") : currentTaskId;
    renderReminders(taskId);
  }

  function showReminderPicker(anchorEl) {
    var picker = document.getElementById("edit-task-reminder-picker");
    if (!picker) return;
    positionPicker(picker, anchorEl);
    picker.removeAttribute("hidden");
  }

  function hideReminderPicker() {
    var picker = document.getElementById("edit-task-reminder-picker");
    if (picker) picker.setAttribute("hidden", "");
  }

  // ── Reminder notifications ───────────────────────────────────────────────────


  // ── Comments ─────────────────────────────────────────────────────────────────

  function showCommentError() {
    var el = document.querySelector('[data-role="edit-task-comment-error"]');
    if (el) el.removeAttribute('hidden');
  }

  function hideCommentError() {
    var el = document.querySelector('[data-role="edit-task-comment-error"]');
    if (el) el.setAttribute('hidden', '');
  }

  function getTaskComments(taskId) {
    var scriptEl = document.getElementById('comments-' + taskId);
    if (!scriptEl) return [];
    try { return JSON.parse(scriptEl.textContent) || []; } catch (e) { return []; }
  }

  function updateTaskComments(taskId, comments) {
    var scriptEl = document.getElementById('comments-' + taskId);
    if (scriptEl) scriptEl.textContent = JSON.stringify(comments);
  }

  /** Keeps the task card comment bubble in sync with embedded JSON (first comment creates the badge). */
  function syncDashboardCommentBadge(taskId) {
    var card = document.querySelector('.Dashboard-task[data-task-id="' + taskId + '"]');
    if (!card) return;
    var body = card.querySelector('.Dashboard-taskBody');
    if (!body) return;
    var count = getTaskComments(taskId).length;
    var countEl = card.querySelector('.Dashboard-commentCount');
    var bubbleSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
    if (count <= 0) {
      if (countEl) countEl.remove();
      return;
    }
    if (!countEl) {
      countEl = document.createElement('span');
      countEl.className = 'Dashboard-commentCount';
      body.appendChild(countEl);
    }
    countEl.innerHTML = bubbleSvg + ' ' + count;
  }

  function renderComments(taskId) {
    var list = document.getElementById('edit-task-comments-list');
    if (!list) return;

    var comments = getTaskComments(taskId);
    list.innerHTML = '';

    comments.forEach(function (comment) {
      var li = document.createElement('li');
      li.className = 'TaskComment';
      li.setAttribute('data-comment-id', comment.id);

      var authorEl = document.createElement('span');
      authorEl.className = 'TaskComment-author';
      authorEl.textContent = comment.added_by || '';

      var textEl = document.createElement('span');
      textEl.className = 'TaskComment-content';
      textEl.textContent = comment.content;

      var editInput = document.createElement('textarea');
      editInput.className = 'Popup-input TaskComment-editInput';
      editInput.value = comment.content;
      editInput.rows = 1;
      editInput.maxLength = 3000;
      editInput.hidden = true;
      editInput.addEventListener('input', function () {
        editInput.style.height = 'auto';
        editInput.style.height = editInput.scrollHeight + 'px';
      });

      var actions = document.createElement('div');
      actions.className = 'TaskComment-actions';

      var menuBtn = document.createElement('button');
      menuBtn.type = 'button';
      menuBtn.className = 'TaskComment-menuBtn';
      menuBtn.title = 'Options';
      menuBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 15 15" fill="currentColor" aria-hidden="true"><circle cx="7.5" cy="2.5" r="1.5"/><circle cx="7.5" cy="7.5" r="1.5"/><circle cx="7.5" cy="12.5" r="1.5"/></svg>';

      var menuDropdown = document.createElement('div');
      menuDropdown.className = 'TaskComment-menu';

      var editMenuItem = document.createElement('button');
      editMenuItem.type = 'button';
      editMenuItem.className = 'TaskComment-menuItem';
      editMenuItem.textContent = 'Edit';

      var deleteMenuItem = document.createElement('button');
      deleteMenuItem.type = 'button';
      deleteMenuItem.className = 'TaskComment-menuItem TaskComment-menuItem--danger';
      deleteMenuItem.textContent = 'Delete';

      menuDropdown.appendChild(editMenuItem);
      menuDropdown.appendChild(deleteMenuItem);

      var editBtn = editMenuItem;
      var deleteBtn = deleteMenuItem;

      function saveEdit() {
        var newContent = editInput.value.trim();
        if (!newContent) return;
        var formData = new FormData();
        formData.append('content', newContent);
        fetch('/task/comment/edit/' + comment.id + '/', {
          method: 'POST',
          headers: { 'X-Requested-With': 'XMLHttpRequest', 'X-CSRFToken': getCsrfToken() },
          body: formData,
        })
          .then(function (r) { return r.json(); })
          .then(function (data) {
            if (data && data.status === 'success') {
              comment.content = newContent;
              textEl.textContent = newContent;
              var comments = getTaskComments(currentTaskId);
              var c = comments.find(function (c) { return c.id === comment.id; });
              if (c) c.content = newContent;
              updateTaskComments(currentTaskId, comments);
              exitEditMode();
            } else {
              showCommentError();
            }
          })
          .catch(showCommentError);
      }

      var editActions = document.createElement('div');
      editActions.className = 'TaskComment-editActions';
      editActions.hidden = true;

      var saveBtn = document.createElement('button');
      saveBtn.type = 'button';
      saveBtn.className = 'Popup-submit TaskComment-editSaveBtn';
      saveBtn.textContent = 'Save';

      var cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.className = 'Popup-cancelBtn TaskComment-editCancelBtn';
      cancelBtn.textContent = 'Cancel';

      editActions.appendChild(cancelBtn);
      editActions.appendChild(saveBtn);

      saveBtn.addEventListener('click', saveEdit);
      cancelBtn.addEventListener('click', exitEditMode);

      function closeMenu() {
        actions.classList.remove('TaskComment-actions--open');
      }

      function enterEditMode() {
        textEl.hidden = true;
        editInput.hidden = false;
        editActions.hidden = false;
        editInput.style.height = 'auto';
        editInput.style.height = editInput.scrollHeight + 'px';
        editInput.focus();
        editInput.selectionStart = editInput.selectionEnd = editInput.value.length;
        menuBtn.hidden = true;
        closeMenu();
      }

      function exitEditMode() {
        textEl.hidden = false;
        editInput.hidden = true;
        editActions.hidden = true;
        editInput.value = comment.content;
        menuBtn.hidden = false;
      }

      menuBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        var isOpen = actions.classList.contains('TaskComment-actions--open');
        // Close all other open menus first
        document.querySelectorAll('.TaskComment-actions--open').forEach(function (a) {
          a.classList.remove('TaskComment-actions--open');
        });
        if (!isOpen) actions.classList.add('TaskComment-actions--open');
      });

      editMenuItem.addEventListener('click', function () {
        closeMenu();
        enterEditMode();
      });

      editInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          saveEdit();
        }
        if (e.key === 'Escape') exitEditMode();
      });

      deleteBtn.addEventListener('click', function () {
        if (!confirm('Delete this comment?')) return;
        fetch('/task/comment/delete/' + comment.id + '/', {
          method: 'POST',
          headers: { 'X-Requested-With': 'XMLHttpRequest', 'X-CSRFToken': getCsrfToken() },
        })
          .then(function (r) { return r.json(); })
          .then(function (data) {
            if (data && data.status === 'success') {
              li.remove();
              var comments = getTaskComments(currentTaskId);
              var idx = comments.findIndex(function (c) { return c.id === comment.id; });
              if (idx !== -1) comments.splice(idx, 1);
              updateTaskComments(currentTaskId, comments);
              syncDashboardCommentBadge(currentTaskId);
            } else {
              showCommentError();
            }
          })
          .catch(showCommentError);
      });

      if (canManageComment(comment.added_by)) {
        actions.appendChild(menuBtn);
        actions.appendChild(menuDropdown);
      }

      var contentWrapper = document.createElement('div');
      contentWrapper.className = 'TaskComment-body';
      contentWrapper.appendChild(authorEl);
      contentWrapper.appendChild(textEl);
      contentWrapper.appendChild(editInput);
      contentWrapper.appendChild(editActions);

      li.appendChild(contentWrapper);
      li.appendChild(actions);
      list.appendChild(li);
    });
  }

  // ── Prepare / reset ──────────────────────────────────────────────────────────

  function resetEditState() {
    var displayEl = document.getElementById("edit-task-name-display");
    var editWrap = document.getElementById("edit-task-name-edit-wrap");
    var nameInput = document.getElementById("id_edit_task_name");
    var form = document.getElementById("edit-task-form");
    if (displayEl) displayEl.removeAttribute("hidden");
    if (editWrap) editWrap.setAttribute("hidden", "");
    if (nameInput) {
      nameInput.value = nameInput.defaultValue;
      nameInput.style.height = "";
      nameInput.style.overflowY = "";
    }
    if (form) form.classList.remove("is-editing-name");
  }

  function prepare(card) {
    resetEditState();

    currentTaskId  = card.getAttribute("data-task-id");
    currentGroupId = card.getAttribute("data-task-group-id") || "";

    var name = card.getAttribute("data-task-name") || "";

    var displayEl = document.getElementById("edit-task-name-display");
    if (displayEl) displayEl.textContent = name;

    var nameInput = document.getElementById("id_edit_task_name");
    if (nameInput) { nameInput.value = name; nameInput.defaultValue = name; }

    var posInput = document.getElementById("edit-task-position-input");
    if (posInput) posInput.value = card.getAttribute("data-task-position") || "0";

    var completedInput = document.getElementById("edit-task-completed-input");
    if (completedInput) {
      completedInput.value = card.getAttribute("data-task-completed") === "true" ? "on" : "";
    }

    var form = document.getElementById("edit-task-form");
    if (form) form.setAttribute("data-url", "/task/edit/" + currentTaskId + "/");

    var groupInput = document.getElementById("edit-task-group-value");
    if (groupInput) groupInput.value = currentGroupId || "";

    // Deadline
    populateDeadline(card.getAttribute("data-task-deadline") || "");

    // Comments (collapsed by default)
    var commentInput = document.getElementById("edit-task-comment-input");
    if (commentInput) commentInput.value = "";
    hideCommentError();
    renderComments(currentTaskId);
    var commentsBody = document.getElementById("edit-task-comments-body");
    var commentsToggle = document.getElementById("edit-task-comments-toggle");
    if (commentsBody) commentsBody.setAttribute("hidden", "");
    if (commentsToggle) { commentsToggle.setAttribute("aria-expanded", "false"); commentsToggle.classList.remove("is-open"); }

    var panelBody = document.getElementById("edit-task-panel-body");
    var panelToggle = document.getElementById("edit-task-panel-toggle");
    var panelShell = document.querySelector("#edit-task-popup .Popup-panel");
    if (panelBody) panelBody.classList.remove("is-open");
    if (panelShell) panelShell.classList.remove("Popup-panel--mobileOpen");
    if (panelToggle) {
      panelToggle.setAttribute("aria-expanded", "false");
      panelToggle.classList.remove("is-open");
    }

    // Reminder
    populateReminderFromCard(card);
  }

  function focusEditTaskPopupContainer() {
    var popup = document.getElementById("edit-task-popup");
    if (!popup) return;
    var box = popup.querySelector(".Popup-box");
    if (!box || typeof box.focus !== "function") return;
    if (!box.hasAttribute("tabindex")) box.setAttribute("tabindex", "-1");
    setTimeout(function () {
      try { box.focus(); } catch (_) {}
    }, 0);
  }

  // ── Init ─────────────────────────────────────────────────────────────────────

  function init() {
    // Open popup on task card click
    document.body.addEventListener("click", function (e) {
      if (e.target.closest(".Dashboard-menuWrapper")) return;
      if (e.target.closest(".Dashboard-taskCheckbox")) return;

      // Task card click
      var card = e.target.closest(".Dashboard-task");
      if (!card) return;
      window.openPopup("edit-task-popup");
      prepare(card);
      focusEditTaskPopupContainer();
      persistEditTaskPopupOpen();
    });

    // Deadline row button: toggle calendar open / closed
    var addDeadlineBtn = document.getElementById("edit-task-add-deadline-btn");
    if (addDeadlineBtn) {
      addDeadlineBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        if (!canEditTaskDeadline()) return;
        var picker = document.getElementById("edit-task-deadline-picker");
        if (picker && !picker.hasAttribute("hidden")) {
          picker.setAttribute("hidden", "");
          return;
        }
        var reminderPicker = document.getElementById("edit-task-reminder-picker");
        if (reminderPicker) reminderPicker.setAttribute("hidden", "");
        if (calendarDay === 0) {
          var t = new Date();
          calendarYear = t.getFullYear();
          calendarMonth = t.getMonth();
        }
        renderCalendar();
        showDeadlinePicker(this);
      });
    }
    var removeDeadlineBtn = document.getElementById("edit-task-remove-deadline-btn");
    if (removeDeadlineBtn) {
      removeDeadlineBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        if (!canEditTaskDeadline()) return;
        if (!confirm("Remove the deadline?")) return;
        hideDeadlinePicker();
        var editTaskForm = document.getElementById("edit-task-form");
        if (editTaskForm) editTaskForm.requestSubmit();
      });
    }

    // Reminder row button: toggle reminder picker
    var addReminderBtn = document.getElementById("edit-task-add-reminder-btn");
    if (addReminderBtn) {
      addReminderBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        var picker = document.getElementById("edit-task-reminder-picker");
        if (picker && !picker.hasAttribute("hidden")) { picker.setAttribute("hidden", ""); return; }
        var deadlinePicker = document.getElementById("edit-task-deadline-picker");
        if (deadlinePicker) deadlinePicker.setAttribute("hidden", "");
        if (reminderDay === 0) {
          var t = new Date();
          reminderYear  = t.getFullYear();
          reminderMonth = t.getMonth();
        }
        renderReminderCalendar();
        showReminderPicker(this);
      });
    }

    var setReminderBtn = document.getElementById("edit-task-set-reminder-btn");
    if (setReminderBtn) {
      setReminderBtn.addEventListener("click", function () {
        if (reminderDay === 0) { alert("Please select a date for the reminder."); return; }
        var timeVal = getReminderTimeValue();
        if (!timeVal) { alert("Please enter time in 24-hour format (HH:mm)."); return; }
        var datetimeStr = reminderYear + "-" + pad2(reminderMonth + 1) + "-" + pad2(reminderDay) + " " + timeVal;
        var dt = new Date(reminderYear, reminderMonth, reminderDay,
          parseInt(timeVal.split(":")[0], 10), parseInt(timeVal.split(":")[1], 10));
        if (isNaN(dt.getTime()) || dt <= new Date()) {
          alert("Please select a future date and time for the reminder.");
          return;
        }
        var card = getCurrentCard();
        var addUrl = card ? card.getAttribute("data-task-add-reminder-url") : "";
        if (!addUrl) return;
        var formData = new FormData();
        formData.append("csrfmiddlewaretoken", getCsrfToken());
        formData.append("send_at", datetimeStr);
        fetch(addUrl, {
          method: "POST",
          headers: { "X-Requested-With": "XMLHttpRequest" },
          body: formData,
        })
          .then(function (r) { return r.json(); })
          .then(function (data) {
            if (data && data.status === "success" && data.new_object_id != null && currentTaskId) {
              var idStr = String(data.new_object_id);
              var deleteUrl = "/task/reminder/delete/" + idStr + "/";
              var sendAtIso = dt.toISOString();
              var reminders = getTaskReminders(currentTaskId);
              reminders.push({ id: idStr, send_at: sendAtIso, delete_url: deleteUrl });
              updateTaskReminders(currentTaskId, reminders);
              hideReminderPicker();
              renderReminders(currentTaskId);
            } else if (data && data.status === "success") {
              alert("Could not update the reminder list. Try refreshing the page.");
            }
          })
          .catch(function () {
            alert("Something went wrong. Please try again.");
          });
      });
    }

    // Reminder calendar navigation and day selection
    document.body.addEventListener("click", function (e) {
      var navBtn = e.target.closest("[data-reminder-cal-dir]");
      if (navBtn) {
        e.stopPropagation();
        var dir = parseInt(navBtn.getAttribute("data-reminder-cal-dir"), 10);
        reminderMonth += dir;
        if (reminderMonth > 11) { reminderMonth = 0; reminderYear++; }
        if (reminderMonth < 0)  { reminderMonth = 11; reminderYear--; }
        renderReminderCalendar();
        return;
      }
      var dayBtn = e.target.closest("[data-reminder-cal-date]");
      if (dayBtn) {
        e.stopPropagation();
        var parts = dayBtn.getAttribute("data-reminder-cal-date").split("-");
        reminderYear  = parseInt(parts[0], 10);
        reminderMonth = parseInt(parts[1], 10) - 1;
        reminderDay   = parseInt(parts[2], 10);
        renderReminderCalendar();
      }
    });

    setReminderTimeValue("09:00");

    // Click on task name display → enter edit mode
    function enterNameEditMode() {
      var displayEl = document.getElementById("edit-task-name-display");
      var editWrap = document.getElementById("edit-task-name-edit-wrap");
      var nameInput = document.getElementById("id_edit_task_name");
      var form = document.getElementById("edit-task-form");
      if (displayEl) displayEl.setAttribute("hidden", "");
      if (editWrap) editWrap.removeAttribute("hidden");
      if (form) form.classList.add("is-editing-name");
      if (nameInput) {
        autoResize(nameInput);
        nameInput.focus();
        nameInput.selectionStart = nameInput.selectionEnd = nameInput.value.length;
      }
    }

    var nameDisplayEl = document.getElementById("edit-task-name-display");
    if (nameDisplayEl) {
      nameDisplayEl.addEventListener("click", enterNameEditMode);
      nameDisplayEl.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); enterNameEditMode(); }
      });
    }

    // Cancel button → exit edit mode
    var cancelBtn = document.getElementById("edit-task-cancel-btn");
    if (cancelBtn) {
      cancelBtn.addEventListener("click", function () {
        resetEditState();
      });
    }

    // Press Escape in textarea → cancel; Enter → save; Shift+Enter → newline
    var nameInput = document.getElementById("id_edit_task_name");
    if (nameInput) {
      nameInput.addEventListener("keydown", function (e) {
        if (e.key === "Escape") { e.preventDefault(); resetEditState(); }
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          document.getElementById("edit-task-form").requestSubmit();
        }
      });
    }


    // ── Calendar navigation and day selection ────────────────────────────────
    document.body.addEventListener("click", function (e) {
      var navBtn = e.target.closest("[data-cal-dir]");
      if (navBtn) {
        if (!navBtn.closest("#edit-task-deadline-picker") || !canEditTaskDeadline()) return;
        e.stopPropagation();
        var dir = parseInt(navBtn.getAttribute("data-cal-dir"), 10);
        calendarMonth += dir;
        if (calendarMonth > 11) { calendarMonth = 0; calendarYear++; }
        if (calendarMonth < 0)  { calendarMonth = 11; calendarYear--; }
        renderCalendar();
        return;
      }
      var dayBtn = e.target.closest("[data-cal-date]");
      if (dayBtn) {
        if (!dayBtn.closest("#edit-task-deadline-picker") || !canEditTaskDeadline()) return;
        e.stopPropagation();
        var parts = dayBtn.getAttribute("data-cal-date").split("-");
        calendarYear  = parseInt(parts[0], 10);
        calendarMonth = parseInt(parts[1], 10) - 1;
        calendarDay   = parseInt(parts[2], 10);
        setDateFromParts();
        renderCalendar();
        updateDeadlineBtn();
        var picker = document.getElementById("edit-task-deadline-picker");
        if (picker) picker.setAttribute("hidden", "");
        var editTaskForm = document.getElementById("edit-task-form");
        if (editTaskForm) editTaskForm.requestSubmit();
      }
    });

    // Close comment menus on outside click
    document.addEventListener("click", function (e) {
      if (!e.target.closest('.TaskComment-menuBtn')) {
        document.querySelectorAll('.TaskComment-actions--open').forEach(function (a) {
          a.classList.remove('TaskComment-actions--open');
        });
      }
    });

    // Close calendar on outside click
    document.addEventListener("click", function (e) {
      var picker = document.getElementById("edit-task-deadline-picker");
      if (!picker || picker.hasAttribute("hidden")) return;
      if (picker.contains(e.target)) return;
      if (e.target.closest("#edit-task-add-deadline-btn")) return;
      picker.setAttribute("hidden", "");
    });

    // Close reminder picker on outside click
    document.addEventListener("click", function (e) {
      var picker = document.getElementById("edit-task-reminder-picker");
      if (!picker || picker.hasAttribute("hidden")) return;
      if (picker.contains(e.target)) return;
      if (e.target.closest("#edit-task-add-reminder-btn")) return;
      picker.setAttribute("hidden", "");
    });


    // Auto-resize textarea helper
    function autoResize(el) {
      if (!el) return;
      el.style.height = "auto";
      if (el.id === "id_edit_task_name") {
        var editWrap = document.getElementById("edit-task-name-edit-wrap");
        var maxHeight = editWrap ? editWrap.clientHeight : 0;
        if (maxHeight > 0) {
          var nextHeight = Math.min(el.scrollHeight, maxHeight);
          el.style.height = nextHeight + "px";
          el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
          return;
        }
      }
      el.style.height = el.scrollHeight + "px";
    }
    function bindAutoResize(el) {
      if (!el) return;
      el.addEventListener("input", function () { autoResize(el); });
    }

    // Add comment
    var addCommentBtn = document.getElementById("edit-task-add-comment-btn");
    var commentInputEl = document.getElementById("edit-task-comment-input");
    if (commentInputEl) {
      bindAutoResize(commentInputEl);
      commentInputEl.addEventListener("keydown", function (e) {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          if (addCommentBtn) addCommentBtn.click();
        }
      });
    }

    // Auto-resize task name edit textarea
    var taskNameTextarea = document.getElementById("id_edit_task_name");
    if (taskNameTextarea) bindAutoResize(taskNameTextarea);
    if (addCommentBtn) {
      addCommentBtn.addEventListener("click", function () {
        var content = commentInputEl ? commentInputEl.value.trim() : "";
        if (!content || !currentTaskId) return;
        hideCommentError();
        var formData = new FormData();
        formData.append("content", content);
        fetch("/task/comment/add/" + currentTaskId + "/", {
          method: "POST",
          headers: { "X-Requested-With": "XMLHttpRequest", "X-CSRFToken": getCsrfToken() },
          body: formData,
        })
          .then(function (r) { return r.json(); })
          .then(function (data) {
            if (data && data.status === "success" && data.new_object_id != null) {
              var idStr = String(data.new_object_id);
              var addedBy = getCurrentUser();
              var comments = getTaskComments(currentTaskId);
              comments.push({ id: idStr, content: content, added_by: addedBy });
              updateTaskComments(currentTaskId, comments);
              if (commentInputEl) {
                commentInputEl.value = "";
                commentInputEl.style.height = "auto";
                commentInputEl.style.height = commentInputEl.scrollHeight + "px";
              }
              renderComments(currentTaskId);
              syncDashboardCommentBadge(currentTaskId);
            } else {
              showCommentError();
            }
          })
          .catch(showCommentError);
      });
    }

    // Toggle comments
    var commentsToggle = document.getElementById("edit-task-comments-toggle");
    var commentsBody   = document.getElementById("edit-task-comments-body");
    if (commentsToggle && commentsBody) {
      commentsToggle.addEventListener("click", function () {
        var hidden = commentsBody.hasAttribute("hidden");
        if (hidden) {
          commentsBody.removeAttribute("hidden");
          commentsToggle.setAttribute("aria-expanded", "true");
          commentsToggle.classList.add("is-open");
        } else {
          commentsBody.setAttribute("hidden", "");
          commentsToggle.setAttribute("aria-expanded", "false");
          commentsToggle.classList.remove("is-open");
        }
      });
    }

    var panelToggle = document.getElementById("edit-task-panel-toggle");
    var panelBody = document.getElementById("edit-task-panel-body");
    if (panelToggle && panelBody) {
      panelToggle.addEventListener("click", function () {
        var nowOpen = panelBody.classList.toggle("is-open");
        panelToggle.setAttribute("aria-expanded", nowOpen ? "true" : "false");
        panelToggle.classList.toggle("is-open", nowOpen);
        var shell = panelBody.closest(".Popup-panel");
        if (shell) shell.classList.toggle("Popup-panel--mobileOpen", nowOpen);
      });
    }

    // Backdrop close — clone to remove popup.js listener, then add calendar-aware one
    var popup = document.getElementById("edit-task-popup");
    if (popup) {
      var backdrop = popup.querySelector(".Popup-backdrop");
      if (backdrop) {
        var newBackdrop = backdrop.cloneNode(true);
        backdrop.parentNode.replaceChild(newBackdrop, backdrop);
        newBackdrop.addEventListener("click", function () {
          var deadlinePicker = document.getElementById("edit-task-deadline-picker");
          var reminderPicker = document.getElementById("edit-task-reminder-picker");
          var deadlineOpen = deadlinePicker && !deadlinePicker.hasAttribute("hidden");
          var reminderOpen = reminderPicker && !reminderPicker.hasAttribute("hidden");
          if (deadlineOpen) { deadlinePicker.setAttribute("hidden", ""); return; }
          if (reminderOpen) { reminderPicker.setAttribute("hidden", ""); return; }
          window.closePopup(popup);
        });
      }
    }

    // Edit-task form: submit without closing the popup
    var editTaskForm = document.getElementById("edit-task-form");
    if (editTaskForm) {
      editTaskForm.addEventListener("submit", function (e) {
        e.preventDefault();
        var url = editTaskForm.getAttribute("data-url");
        if (!url) return;

        var errorEl = editTaskForm.querySelector('[data-role="edit-task-error"]');
        if (errorEl) errorEl.setAttribute("hidden", "");

        var nameInput = document.getElementById("id_edit_task_name");
        if (nameInput && !nameInput.value.trim()) {
          if (errorEl) {
            errorEl.textContent = "Task name cannot be empty.";
            errorEl.removeAttribute("hidden");
          }
          return;
        }

        var saveBtn = document.getElementById("edit-task-save-btn");
        var formData = new FormData(editTaskForm);
        var submittedName = (formData.get("name") || "").toString();
        var wasEditingName = editTaskForm.classList.contains("is-editing-name");
        if (wasEditingName) {
          var displayElNow = document.getElementById("edit-task-name-display");
          if (displayElNow) displayElNow.textContent = submittedName;
          // `resetEditState()` restores the textarea value from `defaultValue`.
          // Update `defaultValue` now so we don't lose the user's new name
          // before the fetch response handler runs.
          if (nameInput) nameInput.defaultValue = submittedName;
          resetEditState();
        }

        var doSubmit = function () {
          fetch(url, {
            method: "POST",
            headers: { "X-Requested-With": "XMLHttpRequest", "X-CSRFToken": getCsrfToken() },
            body: formData,
          })
            .then(function (r) { return r.json(); })
            .then(function (data) {
              if (data && data.status === "success") {
                // Use the name we submitted (not the potentially-reset textarea value).
                var newName = submittedName;
                // Update card in dashboard
                var card = document.querySelector(".Dashboard-task[data-task-id='" + currentTaskId + "']");
                if (card) {
                  var wasCompletedBefore = card.getAttribute("data-task-completed") === "true";
                  if (typeof data.position === "number") {
                    card.setAttribute("data-task-position", String(data.position));
                  }
                  if (typeof data.is_completed === "boolean") {
                    card.setAttribute("data-task-completed", data.is_completed ? "true" : "false");
                    card.classList.toggle("Dashboard-task--completed", data.is_completed);
                    var taskCb = card.querySelector(".Dashboard-taskCheckbox");
                    if (taskCb) taskCb.checked = data.is_completed;
                    if (data.is_completed && !wasCompletedBefore) {
                      var taskList = card.closest(".Dashboard-tasks");
                      if (taskList) taskList.appendChild(card);
                    }
                  }
                  var nameSpan = card.querySelector(".Dashboard-taskName");
                  if (nameSpan) nameSpan.textContent = newName;
                  card.setAttribute("data-task-name", newName);
                  card.title = newName;
                  // Update deadline badge
                  var deadlineVal = (editTaskForm.querySelector('[name="deadline"]') || {}).value || "";
                  card.setAttribute("data-task-deadline", deadlineVal);
                  var badge = card.querySelector(".Dashboard-taskDeadlineBadge");
                  if (badge) {
                    if (deadlineVal) {
                      var dp = deadlineVal.split("-");
                      var d = dp.length === 3 ? new Date(parseInt(dp[0], 10), parseInt(dp[1], 10) - 1, parseInt(dp[2], 10)) : null;
                      if (d && !isNaN(d.getTime())) {
                        badge.textContent = d.toLocaleString(undefined, { month: "short", day: "numeric" });
                        badge.removeAttribute("hidden");
                        var today = new Date(); today.setHours(0, 0, 0, 0);
                        badge.classList.toggle("Dashboard-taskDeadlineBadge--overdue", d < today);
                      } else {
                        badge.setAttribute("hidden", "");
                      }
                    } else {
                      badge.setAttribute("hidden", "");
                    }
                  }
                }
                // Update display name
                var displayEl = document.getElementById("edit-task-name-display");
                if (displayEl) displayEl.textContent = newName;
                var ni = document.getElementById("id_edit_task_name");
                if (ni) ni.defaultValue = newName;
                // Close rename mode immediately after a successful save.
                if (saveBtn) saveBtn.textContent = "Save";
                resetEditState();
              } else {
                if (wasEditingName) {
                  enterNameEditMode();
                  var reopenNameInput = document.getElementById("id_edit_task_name");
                  if (reopenNameInput) reopenNameInput.value = submittedName;
                }
                if (errorEl) errorEl.removeAttribute("hidden");
                if (window.showAjaxError) window.showAjaxError(doSubmit);
              }
            })
            .catch(function () {
              if (wasEditingName) {
                enterNameEditMode();
                var reopenNameInput = document.getElementById("id_edit_task_name");
                if (reopenNameInput) reopenNameInput.value = submittedName;
              }
              if (errorEl) errorEl.removeAttribute("hidden");
              if (window.showAjaxError) window.showAjaxError(doSubmit);
            });
        };
        doSubmit();
      });
    }

    document.addEventListener("popup-closed", function (e) {
      if (e.detail && e.detail.id === "edit-task-popup") {
        clearEditTaskPopupPersist();
      }
    });

    /* Reload/navigation does not call closePopup; clear stale persist when the popup is not open at leave. */
    function clearPersistIfEditTaskPopupClosedAtLeave() {
      var pop = document.getElementById("edit-task-popup");
      if (!pop || pop.hasAttribute("hidden")) {
        clearEditTaskPopupPersist();
      }
    }
    window.addEventListener("pagehide", clearPersistIfEditTaskPopupClosedAtLeave);
    window.addEventListener("beforeunload", clearPersistIfEditTaskPopupClosedAtLeave);

    tryRestoreEditTaskPopup(prepare);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
