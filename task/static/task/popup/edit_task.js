/**
 * Edit task popup (task app). Opens on task card click.
 * Supports: inline rename, delete, deadline & reminders (calendars + time use account timezone from body[data-user-timezone]; deadline/reminder posted as UTC ISO).
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
  var attachmentUploadInProgress = false;

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

  function isReloadNavigation() {
    try {
      if (window.performance && typeof window.performance.getEntriesByType === "function") {
        var navEntries = window.performance.getEntriesByType("navigation");
        if (navEntries && navEntries.length > 0) {
          return navEntries[0].type === "reload";
        }
      }
      if (window.performance && window.performance.navigation) {
        return window.performance.navigation.type === 1;
      }
    } catch (e) {}
    return false;
  }

  function tryRestoreEditTaskPopup(prepareFn) {
    // Do not reopen the task popup after an explicit page reload.
    if (isReloadNavigation()) {
      clearEditTaskPopupPersist();
      return;
    }
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
    return document.querySelector('.Dashboard[data-current-user-id]');
  }
  function getCurrentUserId() {
    var el = getDashboardEl();
    return el ? el.getAttribute('data-current-user-id') : '';
  }
  function getCurrentUsername() {
    var el = getDashboardEl();
    return el ? el.getAttribute('data-current-username') : '';
  }
  function getWorkspaceOwnerId() {
    var el = getDashboardEl();
    return el ? el.getAttribute('data-workspace-owner-id') : '';
  }
  function canManageComment(addedById) {
    var me = getCurrentUserId();
    return me && (me === String(addedById || '') || me === getWorkspaceOwnerId());
  }

  /** True when Enter should submit the task name (PC-style); false → Enter inserts a newline (typical touch / on-screen keyboard). */
  function isPcTaskNameEnterSubmitBehavior() {
    try {
      if (window.matchMedia && window.matchMedia("(pointer: fine)").matches) return true;
      if (window.matchMedia && window.matchMedia("(any-pointer: fine)").matches) return true;
    } catch (e) {}
    return false;
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
  function floorMinuteToFive(minute) {
    var m = parseInt(minute, 10);
    if (isNaN(m)) return 55;
    if (m < 0) m = 0;
    if (m > 59) m = 59;
    return Math.floor(m / 5) * 5;
  }

  function getEffectiveTaskTz() {
    try {
      var raw = document.body && document.body.getAttribute("data-user-timezone");
      if (raw && typeof raw === "string" && raw.trim()) return raw.trim();
    } catch (e) {}
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch (e2) {
      return "UTC";
    }
  }

  function syncEditTaskSettingsTimezoneLabel() {
    var el = document.getElementById("edit-task-settings-timezone");
    if (!el) return;
    el.textContent = "Timezone: " + getEffectiveTaskTz();
  }

  var ymdFormatterCache = {};
  function getYmdFormatter(tz) {
    if (!ymdFormatterCache[tz]) {
      ymdFormatterCache[tz] = new Intl.DateTimeFormat("en-CA", {
        timeZone: tz,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
    }
    return ymdFormatterCache[tz];
  }

  function ymdInTz(ms, tz) {
    return getYmdFormatter(tz).format(new Date(ms));
  }

  (function initCalendarNavStateFromAccountTz() {
    try {
      var tz = getEffectiveTaskTz();
      var parts = ymdInTz(Date.now(), tz).split("-");
      calendarYear = parseInt(parts[0], 10);
      calendarMonth = parseInt(parts[1], 10) - 1;
      reminderYear = calendarYear;
      reminderMonth = calendarMonth;
    } catch (e) {}
  })();

  function startOfDayInTz(year, month, day, tz) {
    var target = year + "-" + pad2(month) + "-" + pad2(day);
    var lo = Date.UTC(year, month - 1, day - 3, 12, 0, 0);
    var hi = Date.UTC(year, month - 1, day + 3, 12, 0, 0);
    var guard = 0;
    while (lo < hi - 1 && guard < 100) {
      guard++;
      var mid = Math.floor((lo + hi) / 2);
      var ymd = ymdInTz(mid, tz);
      if (ymd >= target) hi = mid;
      else lo = mid;
    }
    return hi;
  }

  function addOneGregorianDay(ymd) {
    var p = ymd.split("-").map(Number);
    var dt = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
    dt.setUTCDate(dt.getUTCDate() + 1);
    return dt.getUTCFullYear() + "-" + pad2(dt.getUTCMonth() + 1) + "-" + pad2(dt.getUTCDate());
  }

  function getDaysInMonthGregorian(year, month0) {
    return new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
  }

  function weekdayInTz(ms, tz) {
    var parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).formatToParts(new Date(ms));
    var w = parts.find(function (x) {
      return x.type === "weekday";
    });
    var map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    return w && map[w.value] != null ? map[w.value] : 0;
  }

  function timeHmInTz(ms, tz) {
    var parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(new Date(ms));
    var h = parts.find(function (x) {
      return x.type === "hour";
    });
    var m = parts.find(function (x) {
      return x.type === "minute";
    });
    if (!h || !m) return "";
    return pad2(parseInt(h.value, 10)) + ":" + pad2(parseInt(m.value, 10));
  }

  /** Wall clock in account TZ → UTC ms (DST-aware). Returns NaN if no matching instant (gap). */
  function localDateTimeToUtcMs(y, m, d, hour, minute, tz) {
    var ymdTarget = y + "-" + pad2(m) + "-" + pad2(d);
    var hmTarget = pad2(hour) + ":" + pad2(minute);
    var dayStart = startOfDayInTz(y, m, d, tz);
    var nextYmd = addOneGregorianDay(ymdTarget);
    var np = nextYmd.split("-").map(Number);
    var dayEnd = startOfDayInTz(np[0], np[1], np[2], tz);
    for (var ms = dayStart; ms < dayEnd; ms += 60000) {
      if (ymdInTz(ms, tz) !== ymdTarget) continue;
      if (timeHmInTz(ms, tz) === hmTarget) return ms;
    }
    return NaN;
  }

  function setDeadlineTimeValue(timeStr) {
    var hEl = document.getElementById("edit-task-deadline-time-h");
    var mEl = document.getElementById("edit-task-deadline-time-m");
    var merEl = document.getElementById("edit-task-deadline-time-meridiem");
    if (!hEl || !mEl || !merEl) return;
    var match = /^(\d{2}):(\d{2})$/.exec(timeStr || "");
    var h24 = match ? parseInt(match[1], 10) : 23;
    var mer = h24 >= 12 ? "PM" : "AM";
    var h12 = h24 % 12;
    if (h12 === 0) h12 = 12;
    var h = String(h12);
    var mi = pad2(match ? floorMinuteToFive(match[2]) : 55);
    hEl.value = h;
    mEl.value = mi;
    merEl.value = mer;
  }

  function getDeadlineTimeValue() {
    var hEl = document.getElementById("edit-task-deadline-time-h");
    var mEl = document.getElementById("edit-task-deadline-time-m");
    var merEl = document.getElementById("edit-task-deadline-time-meridiem");
    if (!hEl || !mEl || !merEl) return "";
    var hs = hEl.value.trim();
    var ms = mEl.value.trim();
    var mer = (merEl.value || "").toUpperCase();
    if (hs === "" && ms === "") return "";
    var h12 = parseInt(hs, 10);
    var mi = parseInt(ms, 10);
    if (hs === "" || ms === "" || isNaN(h12) || isNaN(mi)) return "";
    if (h12 < 1 || h12 > 12 || mi < 0 || mi > 59 || mi % 5 !== 0) return "";
    if (mer !== "AM" && mer !== "PM") return "";
    var h = h12 % 12;
    if (mer === "PM") h += 12;
    return pad2(h) + ":" + pad2(mi);
  }

  /** Wall date + time (account TZ) → UTC ISO in the hidden deadline input. */
  function syncDeadlineHidden() {
    var dateInput = document.getElementById("edit-task-deadline-date");
    var hidden = document.getElementById("edit-task-deadline-value");
    if (!hidden) return;
    var dv = dateInput && dateInput.value ? dateInput.value.trim() : "";
    if (!dv) {
      hidden.value = "";
      return;
    }
    var dp = dv.split("-");
    if (dp.length !== 3) {
      hidden.value = "";
      return;
    }
    var y = parseInt(dp[0], 10);
    var mo = parseInt(dp[1], 10);
    var da = parseInt(dp[2], 10);
    var hm = getDeadlineTimeValue();
    if (!hm) hm = "23:55";
    var hmp = /^(\d{2}):(\d{2})$/.exec(hm);
    if (!hmp) {
      hidden.value = "";
      return;
    }
    var hour = parseInt(hmp[1], 10);
    var minute = parseInt(hmp[2], 10);
    var tz = getEffectiveTaskTz();
    var ms = localDateTimeToUtcMs(y, mo, da, hour, minute, tz);
    if (isNaN(ms)) {
      hidden.value = "";
      return;
    }
    hidden.value = new Date(ms).toISOString();
  }

  // ── Calendar (grid) ─────────────────────────────────────────────────────────

  var CAL_MONTHS = ["January","February","March","April","May","June",
                    "July","August","September","October","November","December"];
  var CAL_DAYS   = ["Su","Mo","Tu","We","Th","Fr","Sa"];

  /** One implementation for deadline + reminder pickers (account TZ, DST via Intl). */
  function buildTaskPopupMonthGridHtml(opts) {
    var tz = getEffectiveTaskTz();
    var year = opts.year;
    var month0 = opts.month0;
    var daySelected = opts.daySelected;
    var todayStr = ymdInTz(Date.now(), tz);
    var firstMs = startOfDayInTz(year, month0 + 1, 1, tz);
    var firstDay = weekdayInTz(firstMs, tz);
    var daysInMonth = getDaysInMonthGregorian(year, month0);
    var selStr =
      daySelected > 0
        ? year + "-" + pad2(month0 + 1) + "-" + pad2(daySelected)
        : "";
    var allowPastSelection = opts.allowPastSelection !== false;
    var navAttr = opts.navAttr;
    var dateAttr = opts.dateAttr;
    var html =
      '<div class="Base-notifCalHeader">' +
      '<button type="button" class="Base-notifCalNav" ' +
      navAttr +
      '="-1">&#8249;</button>' +
      '<span class="Base-notifCalMonthYear">' +
      CAL_MONTHS[month0] +
      " " +
      year +
      "</span>" +
      '<button type="button" class="Base-notifCalNav" ' +
      navAttr +
      '="1">&#8250;</button>' +
      '</div><div class="Base-notifCalGrid">';
    CAL_DAYS.forEach(function (d) {
      html += '<span class="Base-notifCalDayName">' + d + "</span>";
    });
    for (var i = 0; i < firstDay; i++) html += "<span></span>";
    for (var d = 1; d <= daysInMonth; d++) {
      var ds = year + "-" + pad2(month0 + 1) + "-" + pad2(d);
      var cls = "Base-notifCalDay";
      if (ds === selStr) cls += " is-selected";
      if (ds === todayStr) cls += " is-today";
      if (ds < todayStr) cls += " is-past";
      html +=
        '<button type="button" class="' +
        cls +
        '"' +
        (!allowPastSelection && ds < todayStr ? " disabled" : "") +
        " " +
        dateAttr +
        '="' +
        ds +
        '">' +
        d +
        "</button>";
    }
    html += "</div>";
    return html;
  }

  function initToday() {
    var tz = getEffectiveTaskTz();
    var parts = ymdInTz(Date.now(), tz).split("-");
    calendarYear = parseInt(parts[0], 10);
    calendarMonth = parseInt(parts[1], 10) - 1;
    calendarDay = parseInt(parts[2], 10);
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
    container.className = "Base-notifCalendar";
    container.innerHTML = buildTaskPopupMonthGridHtml({
      year: calendarYear,
      month0: calendarMonth,
      daySelected: calendarDay,
      navAttr: "data-cal-dir",
      dateAttr: "data-cal-date",
      allowPastSelection: true,
    });
  }

  // ── Reminder calendar (grid) ────────────────────────────────────────────────

  function renderReminderCalendar() {
    var container = document.getElementById("edit-task-reminder-calendar");
    if (!container) return;
    container.className = "Base-notifCalendar";
    container.innerHTML = buildTaskPopupMonthGridHtml({
      year: reminderYear,
      month0: reminderMonth,
      daySelected: reminderDay,
      navAttr: "data-reminder-cal-dir",
      dateAttr: "data-reminder-cal-date",
      allowPastSelection: false,
    });
  }

  // ── Populate deadline from ISO UTC ──────────────────────────────────────────

  function canEditTaskDeadline() {
    var dash = document.querySelector(".Dashboard[data-dashboard-path]");
    return !!(dash && dash.getAttribute("data-can-edit-task-deadline") === "true");
  }

  function canEditTaskAttachments() {
    var dash = document.querySelector(".Dashboard[data-dashboard-path]");
    return !!(dash && dash.getAttribute("data-can-edit-task-attachments") === "true");
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
      var tz = getEffectiveTaskTz();
      var y = parseInt(p[0], 10);
      var mo = parseInt(p[1], 10);
      var da = parseInt(p[2], 10);
      var hm = getDeadlineTimeValue();
      if (!hm) hm = "23:55";
      var hmp = /^(\d{2}):(\d{2})$/.exec(hm);
      var hour = hmp ? parseInt(hmp[1], 10) : 23;
      var minute = hmp ? parseInt(hmp[2], 10) : 59;
      var ms = localDateTimeToUtcMs(y, mo, da, hour, minute, tz);
      if (isNaN(ms)) ms = startOfDayInTz(y, mo, da, tz);
      displayText.textContent = formatTaskPopupDateTime(ms, tz);
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
    if (top + 430 > window.innerHeight - 8) top = window.innerHeight - 438;
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
    setDeadlineTimeValue("23:55");
    calendarDay = 0;
    updateDeadlineBtn();
  }

  function populateDeadline(iso) {
    var dateInput = document.getElementById("edit-task-deadline-date");
    var hidden = document.getElementById("edit-task-deadline-value");
    if (!dateInput || !hidden) return;
    var picker = document.getElementById("edit-task-deadline-picker");
    if (picker) picker.setAttribute("hidden", "");
    var tz = getEffectiveTaskTz();
    if (!iso || !String(iso).trim()) {
      var t = new Date();
      calendarYear = t.getFullYear(); calendarMonth = t.getMonth(); calendarDay = 0;
      dateInput.value = ""; hidden.value = "";
      setDeadlineTimeValue("23:55");
      updateDeadlineBtn();
      return;
    }
    iso = String(iso).trim();
    var plain = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (plain) {
      calendarYear = parseInt(plain[1], 10);
      calendarMonth = parseInt(plain[2], 10) - 1;
      calendarDay = parseInt(plain[3], 10);
      dateInput.value = iso;
      setDeadlineTimeValue("23:55");
      syncDeadlineHidden();
      updateDeadlineBtn();
      return;
    }
    var ms = Date.parse(iso);
    if (!isNaN(ms)) {
      var ymd = ymdInTz(ms, tz);
      var yp = ymd.split("-");
      calendarYear = parseInt(yp[0], 10);
      calendarMonth = parseInt(yp[1], 10) - 1;
      calendarDay = parseInt(yp[2], 10);
      dateInput.value = ymd;
      setDeadlineTimeValue(timeHmInTz(ms, tz));
      syncDeadlineHidden();
      updateDeadlineBtn();
      return;
    }
    var t = new Date();
    calendarYear = t.getFullYear(); calendarMonth = t.getMonth(); calendarDay = 0;
    dateInput.value = ""; hidden.value = "";
    setDeadlineTimeValue("23:55");
    updateDeadlineBtn();
  }


  // ── Reminder display & card data ────────────────────────────────────────────

  function getCurrentCard() {
    return currentTaskId
      ? document.querySelector('.Dashboard-task[data-task-id="' + currentTaskId + '"]')
      : null;
  }

  function dismissDeadlinePicker(revert) {
    var picker = document.getElementById("edit-task-deadline-picker");
    if (picker) picker.setAttribute("hidden", "");
    if (revert) {
      var card = getCurrentCard();
      populateDeadline(card ? (card.getAttribute("data-task-deadline") || "") : "");
    }
  }

  function commitDeadlineAndClose() {
    if (!canEditTaskDeadline()) return;
    if (calendarDay === 0) {
      alert("Please select a date for the deadline.");
      return;
    }
    syncDeadlineHidden();
    updateDeadlineBtn();
    var picker = document.getElementById("edit-task-deadline-picker");
    if (picker) picker.setAttribute("hidden", "");
    var editTaskForm = document.getElementById("edit-task-form");
    if (editTaskForm) editTaskForm.requestSubmit();
  }

  function getYearInTz(ms, tz) {
    var parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
    }).formatToParts(new Date(ms));
    var yearPart = parts.find(function (p) {
      return p.type === "year";
    });
    return yearPart ? parseInt(yearPart.value, 10) : NaN;
  }

  function formatTaskPopupDateTime(ms, tz) {
    if (isNaN(ms)) return "";
    var isCurrentYear = getYearInTz(ms, tz) === getYearInTz(Date.now(), tz);
    var dateOptions = {
      timeZone: tz,
      day: "numeric",
      month: "short",
    };
    if (!isCurrentYear) dateOptions.year = "numeric";
    var dateFormatter = new Intl.DateTimeFormat("en-GB", dateOptions);
    var timeText = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
      .format(new Date(ms))
      .replace(/\s+/g, "")
      .toLowerCase();
    return dateFormatter.format(new Date(ms)) + ", " + timeText;
  }

  function formatReminderDisplay(isoStr) {
    if (!isoStr) return "";
    var ms = new Date(isoStr).getTime();
    if (isNaN(ms)) return isoStr;
    var tz = getEffectiveTaskTz();
    return formatTaskPopupDateTime(ms, tz);
  }

  function setReminderTimeValue(timeStr) {
    var hEl = document.getElementById("edit-task-reminder-time-h");
    var mEl = document.getElementById("edit-task-reminder-time-m");
    var merEl = document.getElementById("edit-task-reminder-time-meridiem");
    if (!hEl || !mEl || !merEl) return;
    var match = /^(\d{2}):(\d{2})$/.exec(timeStr || "");
    var h24 = match ? parseInt(match[1], 10) : 23;
    var mer = h24 >= 12 ? "PM" : "AM";
    var h12 = h24 % 12;
    if (h12 === 0) h12 = 12;
    var h = String(h12);
    var m = pad2(match ? floorMinuteToFive(match[2]) : 55);
    hEl.value = h;
    mEl.value = m;
    merEl.value = mer;
  }

  function getReminderTimeValue() {
    var hEl = document.getElementById("edit-task-reminder-time-h");
    var mEl = document.getElementById("edit-task-reminder-time-m");
    var merEl = document.getElementById("edit-task-reminder-time-meridiem");
    if (!hEl || !mEl || !merEl) return "";
    var hs = hEl.value.trim();
    var ms = mEl.value.trim();
    var mer = (merEl.value || "").toUpperCase();
    if (hs === "" && ms === "") return "";
    var h12 = parseInt(hs, 10);
    var mi = parseInt(ms, 10);
    if (hs === "" || ms === "" || isNaN(h12) || isNaN(mi)) return "";
    if (h12 < 1 || h12 > 12 || mi < 0 || mi > 59 || mi % 5 !== 0) return "";
    if (mer !== "AM" && mer !== "PM") return "";
    var h = h12 % 12;
    if (mer === "PM") h += 12;
    return pad2(h) + ":" + pad2(mi);
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
    var tz = getEffectiveTaskTz();
    var parts = ymdInTz(Date.now(), tz).split("-");
    reminderYear = parseInt(parts[0], 10);
    reminderMonth = parseInt(parts[1], 10) - 1;
    reminderDay = 0;
    setReminderTimeValue("23:55");
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

  function showAttachmentError() {
    var el = document.querySelector('[data-role="edit-task-attachment-error"]');
    if (el) el.removeAttribute("hidden");
  }

  function hideAttachmentError() {
    var el = document.querySelector('[data-role="edit-task-attachment-error"]');
    if (el) el.setAttribute("hidden", "");
  }

  function getTaskAttachments(taskId) {
    var scriptEl = document.getElementById("attachments-" + taskId);
    if (!scriptEl) return [];
    try { return JSON.parse(scriptEl.textContent) || []; } catch (e) { return []; }
  }

  function updateTaskAttachments(taskId, attachments) {
    var scriptEl = document.getElementById("attachments-" + taskId);
    if (scriptEl) scriptEl.textContent = JSON.stringify(attachments);
  }

  function renderAttachments(taskId) {
    var list = document.getElementById("edit-task-attachments-list");
    if (!list) return;
    var canEdit = canEditTaskAttachments();
    var addBtn = document.getElementById("edit-task-add-attachment-btn");
    if (addBtn) {
      if (canEdit) addBtn.removeAttribute("hidden");
      else addBtn.setAttribute("hidden", "");
    }
    list.innerHTML = "";

    var attachments = getTaskAttachments(taskId);
    attachments.forEach(function (attachment) {
      var li = document.createElement("li");
      li.className = "TaskAttachment";

      var link = document.createElement("a");
      link.className = "TaskAttachment-link";
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      var rawAttachmentName = attachment.name || "Attachment";
      link.textContent = rawAttachmentName.replace(/^media\//i, "");
      if (attachment.url) link.href = attachment.url;

      li.appendChild(link);

      if (canEdit) {
        var removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.className = "Popup-deadlineRemoveBtn";
        removeBtn.setAttribute("aria-label", "Remove attachment");
        removeBtn.innerHTML = "&times;";
        removeBtn.addEventListener("click", function () {
          if (!confirm("Remove this attachment?")) return;
          var formData = new FormData();
          formData.append("csrfmiddlewaretoken", getCsrfToken());
          fetch(attachment.delete_url, {
            method: "POST",
            headers: {
              "X-Requested-With": "XMLHttpRequest",
              "X-CSRFToken": getCsrfToken(),
            },
            credentials: "same-origin",
            body: formData,
          })
            .then(function (r) { return r.json(); })
            .then(function (data) {
              if (data && data.status === "success") {
                var all = getTaskAttachments(taskId).filter(function (x) {
                  return String(x.id) !== String(attachment.id);
                });
                updateTaskAttachments(taskId, all);
                renderAttachments(taskId);
              } else {
                showAttachmentError();
              }
            })
            .catch(showAttachmentError);
        });
        li.appendChild(removeBtn);
      }

      list.appendChild(li);
    });
    setAttachmentUploadState(attachmentUploadInProgress);
  }

  function setAttachmentUploadState(isUploading) {
    attachmentUploadInProgress = !!isUploading;
    var addBtn = document.getElementById("edit-task-add-attachment-btn");
    if (!addBtn) return;
    if (!addBtn.dataset.defaultHtml) addBtn.dataset.defaultHtml = addBtn.innerHTML;
    if (attachmentUploadInProgress) {
      addBtn.classList.add("is-uploading");
      addBtn.setAttribute("disabled", "");
      addBtn.setAttribute("aria-busy", "true");
      addBtn.textContent = "Uploading...";
    } else {
      addBtn.classList.remove("is-uploading");
      addBtn.removeAttribute("disabled");
      addBtn.removeAttribute("aria-busy");
      addBtn.innerHTML = addBtn.dataset.defaultHtml || "Add file";
    }
  }

  function setAttachmentUploadProgress(percent) {
    var progressWrap = document.getElementById("edit-task-attachment-progress");
    var progressFill = document.getElementById("edit-task-attachment-progress-fill");
    var progressText = document.getElementById("edit-task-attachment-progress-text");
    var progressBar = progressWrap ? progressWrap.querySelector(".TaskAttachments-progressBar") : null;
    if (!progressWrap || !progressFill || !progressText) return;
    var safePercent = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
    if (attachmentUploadInProgress) progressWrap.removeAttribute("hidden");
    else progressWrap.setAttribute("hidden", "");
    progressFill.style.width = safePercent + "%";
    progressText.textContent = "Uploading... " + safePercent + "%";
    if (progressBar) progressBar.setAttribute("aria-valuenow", String(safePercent));
  }

  function uploadAttachmentRequest(taskId, formData, onProgress) {
    return new Promise(function (resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.open("POST", "/task/attachment/add/" + taskId + "/", true);
      xhr.setRequestHeader("X-Requested-With", "XMLHttpRequest");
      xhr.setRequestHeader("X-CSRFToken", getCsrfToken());

      xhr.upload.onprogress = function (e) {
        if (!e.lengthComputable || typeof onProgress !== "function") return;
        onProgress((e.loaded / e.total) * 100);
      };

      xhr.onload = function () {
        if (xhr.status < 200 || xhr.status >= 300) {
          reject(new Error("Upload failed with HTTP " + xhr.status));
          return;
        }
        try {
          resolve(JSON.parse(xhr.responseText || "{}"));
        } catch (e) {
          reject(new Error("Upload response was not valid JSON."));
        }
      };
      xhr.onerror = function () {
        reject(new Error("Network error while uploading attachment."));
      };
      xhr.onabort = function () {
        reject(new Error("Upload request was aborted."));
      };

      xhr.send(formData);
    });
  }

  function getAttachmentUrlFromUploadResponse(data, file) {
    if (data && typeof data.url === "string" && data.url) return data.url;
    if (data && typeof data.file_url === "string" && data.file_url) return data.file_url;
    if (data && typeof data.attachment_url === "string" && data.attachment_url) return data.attachment_url;
    if (
      data &&
      data.attachment &&
      typeof data.attachment.url === "string" &&
      data.attachment.url
    ) {
      return data.attachment.url;
    }
    try {
      if (file && typeof URL !== "undefined" && typeof URL.createObjectURL === "function") {
        return URL.createObjectURL(file);
      }
    } catch (e) {}
    return "";
  }

  var ATTACHMENT_MAX_SIZE = 100 * 1024 * 1024; // 100 MB

  function uploadAttachmentFile(file) {
    if (!file) {
      console.warn("[edit-task][attachments] Upload skipped: no file selected.");
      return;
    }
    if (!currentTaskId) {
      console.warn("[edit-task][attachments] Upload skipped: missing currentTaskId.");
      return;
    }
    if (!canEditTaskAttachments()) {
      console.warn("[edit-task][attachments] Upload skipped: attachment edit permission denied.");
      return;
    }
    if (attachmentUploadInProgress) {
      console.warn("[edit-task][attachments] Upload skipped: another upload is already in progress.");
      return;
    }
    hideAttachmentError();
    if (file.size > ATTACHMENT_MAX_SIZE) {
      var sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      console.warn("[edit-task][attachments] Upload skipped: file too large (" + sizeMB + " MB).");
      showAttachmentError();
      alert("File is too large (" + sizeMB + " MB). Maximum size is 100 MB.");
      return;
    }

    console.log("[edit-task][attachments] Upload starting:", {
      taskId: currentTaskId,
      name: file.name,
      size: file.size,
      type: file.type || "unknown",
    });
    setAttachmentUploadState(true);
    setAttachmentUploadProgress(0);
    var formData = new FormData();
    formData.append("file", file);
    formData.append("csrfmiddlewaretoken", getCsrfToken());
    uploadAttachmentRequest(currentTaskId, formData, function (percent) {
      setAttachmentUploadProgress(percent);
    })
      .then(function (data) {
        if (data && data.status === "success" && data.new_object_id != null) {
          console.log("[edit-task][attachments] Upload success:", data);
          setAttachmentUploadProgress(100);
          var all = getTaskAttachments(currentTaskId);
          var attachmentUrl = getAttachmentUrlFromUploadResponse(data, file);
          all.push({
            id: String(data.new_object_id),
            name: file.name,
            url: attachmentUrl,
            delete_url: "/task/attachment/delete/" + String(data.new_object_id) + "/",
          });
          updateTaskAttachments(currentTaskId, all);
          renderAttachments(currentTaskId);
        } else {
          console.warn("[edit-task][attachments] Upload failed response:", data);
          showAttachmentError();
          alert("Upload failed. Please try again.");
        }
      })
      .catch(function (err) {
        console.error("[edit-task][attachments] Upload request error:", err);
        showAttachmentError();
        alert("Upload failed. Please try again.");
      })
      .finally(function () {
        setAttachmentUploadState(false);
        setAttachmentUploadProgress(0);
      });
  }

  function promptAndUploadAttachment() {
    if (!canEditTaskAttachments() || attachmentUploadInProgress) return;
    var pickerInput = document.getElementById("edit-task-attachment-file-input");
    if (!pickerInput) return;
    pickerInput.value = "";
    pickerInput.click();
  }

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

      if (canManageComment(comment.added_by_id)) {
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
    renderAttachments(currentTaskId);
    var commentsBody = document.getElementById("edit-task-comments-body");
    var commentsToggle = document.getElementById("edit-task-comments-toggle");
    if (commentsBody) commentsBody.setAttribute("hidden", "");
    if (commentsToggle) { commentsToggle.setAttribute("aria-expanded", "false"); commentsToggle.classList.remove("is-open"); }
    var attachmentsBody = document.getElementById("edit-task-attachments-body");
    var attachmentsToggle = document.getElementById("edit-task-attachments-toggle");
    if (attachmentsBody) attachmentsBody.removeAttribute("hidden");
    if (attachmentsToggle) {
      attachmentsToggle.setAttribute("aria-expanded", "true");
      attachmentsToggle.classList.add("is-open");
    }
    hideAttachmentError();
    var attachmentInput = document.getElementById("edit-task-attachment-input");
    if (attachmentInput) attachmentInput.value = "";

    var panelBody = document.getElementById("edit-task-panel-body");
    var panelToggle = document.getElementById("edit-task-panel-toggle");
    var panelShell = document.querySelector("#edit-task-popup .Popup-panel");
    if (panelBody) panelBody.classList.remove("is-open");
    if (panelShell) panelShell.classList.remove("Popup-panel--mobileOpen");
    if (panelToggle) {
      panelToggle.setAttribute("aria-expanded", "false");
      panelToggle.classList.remove("is-open");
    }
    syncEditTaskSettingsTimezoneLabel();

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
          dismissDeadlinePicker(true);
          return;
        }
        var reminderPicker = document.getElementById("edit-task-reminder-picker");
        if (reminderPicker) reminderPicker.setAttribute("hidden", "");
        if (calendarDay === 0) {
          var tz = getEffectiveTaskTz();
          var p = ymdInTz(Date.now(), tz).split("-");
          calendarYear = parseInt(p[0], 10);
          calendarMonth = parseInt(p[1], 10) - 1;
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

    function onDeadlineTimeInput() {
      syncDeadlineHidden();
      updateDeadlineBtn();
    }
    var deadlineTimeH = document.getElementById("edit-task-deadline-time-h");
    var deadlineTimeM = document.getElementById("edit-task-deadline-time-m");
    var deadlineTimeMer = document.getElementById("edit-task-deadline-time-meridiem");
    if (deadlineTimeH) deadlineTimeH.addEventListener("change", onDeadlineTimeInput);
    if (deadlineTimeM) deadlineTimeM.addEventListener("change", onDeadlineTimeInput);
    if (deadlineTimeMer) deadlineTimeMer.addEventListener("change", onDeadlineTimeInput);

    var saveDeadlineBtn = document.getElementById("edit-task-save-deadline-btn");
    if (saveDeadlineBtn) {
      saveDeadlineBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        commitDeadlineAndClose();
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
        if (deadlinePicker) dismissDeadlinePicker(true);
        if (reminderDay === 0) {
          var tz = getEffectiveTaskTz();
          var p = ymdInTz(Date.now(), tz).split("-");
          reminderYear = parseInt(p[0], 10);
          reminderMonth = parseInt(p[1], 10) - 1;
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
        if (!timeVal) { alert("Please enter a valid time (hh:mm and AM/PM)."); return; }
        var tz = getEffectiveTaskTz();
        var h = parseInt(timeVal.split(":")[0], 10);
        var min = parseInt(timeVal.split(":")[1], 10);
        var utcMs = localDateTimeToUtcMs(
          reminderYear,
          reminderMonth + 1,
          reminderDay,
          h,
          min,
          tz
        );
        if (isNaN(utcMs)) {
          alert("That local time does not exist on this date (DST). Try another time.");
          return;
        }
        var selectedYmd = reminderYear + "-" + pad2(reminderMonth + 1) + "-" + pad2(reminderDay);
        var todayYmd = ymdInTz(Date.now(), tz);
        var isToday = selectedYmd === todayYmd;
        if (!isToday && utcMs <= Date.now()) {
          alert("Please select a future date and time for the reminder.");
          return;
        }
        var card = getCurrentCard();
        var addUrl = card ? card.getAttribute("data-task-add-reminder-url") : "";
        if (!addUrl) return;
        var formData = new FormData();
        formData.append("csrfmiddlewaretoken", getCsrfToken());
        formData.append("send_at", new Date(utcMs).toISOString());
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
              var sendAtIso = new Date(utcMs).toISOString();
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

    // Press Escape in textarea → cancel.
    // PC-ish pointer: Enter → save; Shift+Enter → newline.
    // Touch-primary: Enter → newline (do not submit); use Save button to submit.
    var nameInput = document.getElementById("id_edit_task_name");
    if (nameInput) {
      nameInput.addEventListener("keydown", function (e) {
        if (e.key === "Escape") { e.preventDefault(); resetEditState(); }
        if (e.key !== "Enter") return;
        if (!isPcTaskNameEnterSubmitBehavior()) return;
        if (e.shiftKey) return;
        e.preventDefault();
        document.getElementById("edit-task-form").requestSubmit();
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
      dismissDeadlinePicker(true);
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
              var addedBy = getCurrentUsername();
              var addedById = getCurrentUserId();
              var comments = getTaskComments(currentTaskId);
              comments.push({ id: idStr, content: content, added_by: addedBy, added_by_id: addedById });
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

    var attachmentsToggle = document.getElementById("edit-task-attachments-toggle");
    var attachmentsBody = document.getElementById("edit-task-attachments-body");
    if (attachmentsToggle && attachmentsBody) {
      attachmentsToggle.addEventListener("click", function () {
        if (attachmentsBody.hasAttribute("hidden")) {
          attachmentsBody.removeAttribute("hidden");
          attachmentsToggle.setAttribute("aria-expanded", "true");
          attachmentsToggle.classList.add("is-open");
        }
        promptAndUploadAttachment();
      });
      var attachFileInput = document.getElementById("edit-task-attachment-file-input");
      if (attachFileInput) {
        attachFileInput.addEventListener("change", function () {
          if (!attachFileInput.files || !attachFileInput.files[0]) return;
          console.log("[edit-task][attachments] File selected:", {
            name: attachFileInput.files[0].name,
            size: attachFileInput.files[0].size,
            type: attachFileInput.files[0].type || "unknown",
          });
          uploadAttachmentFile(attachFileInput.files[0]);
          attachFileInput.value = "";
        });
      }
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
          if (deadlineOpen) { dismissDeadlinePicker(true); return; }
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
        syncDeadlineHidden();
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
                      var tz = getEffectiveTaskTz();
                      var todayStr = ymdInTz(Date.now(), tz);
                      var dms = Date.parse(deadlineVal);
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
                      } else {
                        var dp = deadlineVal.split("-");
                        if (dp.length === 3) {
                          var yy = parseInt(dp[0], 10);
                          var mm = parseInt(dp[1], 10);
                          var dd = parseInt(dp[2], 10);
                          var ms0 = startOfDayInTz(yy, mm, dd, tz);
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
                            overdue = deadlineVal < todayStr;
                          }
                          badge.textContent = new Intl.DateTimeFormat(undefined, {
                            timeZone: tz,
                            month: "short",
                            day: "numeric",
                          }).format(new Date(ms0));
                          badge.removeAttribute("hidden");
                          badge.classList.toggle("Dashboard-taskDeadlineBadge--overdue", overdue);
                        } else {
                          badge.setAttribute("hidden", "");
                        }
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

    window.addEventListener("user-timezone-changed", syncEditTaskSettingsTimezoneLabel);
    syncEditTaskSettingsTimezoneLabel();

    tryRestoreEditTaskPopup(prepare);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.WebPlantAccountTimezone = {
    getEffective: getEffectiveTaskTz,
    ymdInTz: ymdInTz,
    startOfDayInTz: startOfDayInTz,
  };
})();
