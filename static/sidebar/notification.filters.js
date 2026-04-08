(function () {
  const api = window.BaseNotification;
  if (!api || !api.overlay) return;

  const FILTER_POPUP_ID = "notification-filter-popup";
  let pendingDates = [];
  let calYear = new Date().getFullYear();
  let calMonth = new Date().getMonth();
  let rerenderCalendar = null;

  const ymdFormatterCache = new Map();

  function getYmdFormatter(tz) {
    if (!ymdFormatterCache.has(tz)) {
      ymdFormatterCache.set(
        tz,
        new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" })
      );
    }
    return ymdFormatterCache.get(tz);
  }

  function ymdInTz(ms, tz) {
    return getYmdFormatter(tz).format(new Date(ms));
  }

  /**
   * Start of calendar day (y-m-d) in tz, as UTC ms (first instant of that local date).
   */
  function startOfDayInTz(year, month, day, tz) {
    const target = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    let lo = Date.UTC(year, month - 1, day - 3, 12, 0, 0);
    let hi = Date.UTC(year, month - 1, day + 3, 12, 0, 0);
    let guard = 0;
    while (lo < hi - 1 && guard < 100) {
      guard++;
      const mid = Math.floor((lo + hi) / 2);
      const ymd = ymdInTz(mid, tz);
      if (ymd >= target) hi = mid;
      else lo = mid;
    }
    return hi;
  }

  function weekdayInTz(ms, tz) {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).formatToParts(new Date(ms));
    const w = parts.find((p) => p.type === "weekday");
    const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    return w && map[w.value] != null ? map[w.value] : 0;
  }

  function getDaysInMonthGregorian(year, month0) {
    return new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
  }

  function addOneGregorianDay(ymd) {
    const [y, m, d] = ymd.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() + 1);
    return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
  }

  function getEffectiveTz() {
    if (typeof api.getEffectiveNotificationTimezone === "function") {
      return api.getEffectiveNotificationTimezone();
    }
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch (_) {
      return "UTC";
    }
  }

  /**
   * UTC offset for `timeZone` at the given instant (DST-aware).
   * Returns signed minutes east of UTC (e.g. Sydney summer ≈ +660) and a UTC±HH:MM label.
   */
  function getUtcOffsetInfo(timeZone, atDate) {
    const d = atDate instanceof Date ? atDate : new Date();
    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: timeZone,
        timeZoneName: "longOffset"
      }).formatToParts(d);
      const raw = parts.find((p) => p.type === "timeZoneName");
      const gmt = raw && raw.value ? raw.value : "";
      const m = gmt.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/i);
      if (!m) {
        return { minutes: 0, label: "UTC+00:00" };
      }
      const sign = m[1] === "-" ? -1 : 1;
      const hours = parseInt(m[2], 10);
      const mins = m[3] ? parseInt(m[3], 10) : 0;
      const totalMinutes = sign * (hours * 60 + mins);
      const abs = Math.abs(totalMinutes);
      const h = Math.floor(abs / 60);
      const mi = abs % 60;
      const signStr = totalMinutes >= 0 ? "+" : "-";
      const label = `UTC${signStr}${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}`;
      return { minutes: totalMinutes, label };
    } catch (_) {
      return { minutes: 0, label: "UTC+00:00" };
    }
  }

  const renderDateTags = (container) => {
    if (!container) return;
    container.innerHTML = "";
    if (pendingDates.length === 0) return;
    const tag = document.createElement("span");
    tag.className = "Base-notificationFilterDateTag";
    tag.textContent = `${pendingDates.length} date${pendingDates.length === 1 ? "" : "s"} selected`;
    container.appendChild(tag);
  };

  const syncFilterPopoverFromStorage = () => {
    const popup = document.getElementById(FILTER_POPUP_ID);
    if (!popup) return;
    const f = api.getFilters();
    const unreadCb = popup.querySelector('input[name="unread"]');
    const readCb = popup.querySelector('input[name="read"]');
    if (unreadCb) unreadCb.checked = !!f.unread;
    if (readCb) readCb.checked = !!f.read;
    pendingDates = Array.isArray(f.dates) ? [...f.dates] : [];
    renderDateTags(popup.querySelector("#Base-notificationFilterDateTags"));
    const tz = getEffectiveTz();
    const todayStr = ymdInTz(Date.now(), tz);
    const [py, pm] = todayStr.split("-").map(Number);
    calYear = py;
    calMonth = pm - 1;
    if (rerenderCalendar) rerenderCalendar();
  };

  const bindFilterPopover = () => {
    const popup = document.getElementById(FILTER_POPUP_ID);
    if (!popup || popup.dataset.filterBound === "1") return;
    popup.dataset.filterBound = "1";

    const resetBtn = popup.querySelector(".Base-notificationFilterResetBtn");
    const applyBtn = popup.querySelector(".Base-notificationFilterApplyBtn");
    const unreadCb = popup.querySelector('input[name="unread"]');
    const readCb = popup.querySelector('input[name="read"]');
    const calendarEl = popup.querySelector("#Base-notifCalendar");
    const tagsContainer = popup.querySelector("#Base-notificationFilterDateTags");

    let dragStart = null;
    let dragEnd = null;
    let dragMode = null;
    let activeTouchId = null;

    const getDayButtonFromPoint = (clientX, clientY) => {
      const el = document.elementFromPoint(clientX, clientY);
      if (!el || !el.closest) return null;
      return el.closest(".Base-notifCalDay");
    };

    const getDatesInRange = (a, b) => {
      const [start, end] = a <= b ? [a, b] : [b, a];
      const dates = [];
      let cur = start;
      while (cur <= end) {
        dates.push(cur);
        cur = addOneGregorianDay(cur);
      }
      return dates;
    };

    const updateDragPreview = () => {
      if (!calendarEl || dragStart === null) return;
      const range = getDatesInRange(dragStart, dragEnd || dragStart);
      calendarEl.querySelectorAll(".Base-notifCalDay").forEach((b) => {
        b.classList.toggle("is-drag-range", range.includes(b.dataset.date));
      });
    };

    const renderCalendar = () => {
      if (!calendarEl) return;
      const tz = getEffectiveTz();
      const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
      const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
      const firstMs = startOfDayInTz(calYear, calMonth + 1, 1, tz);
      const firstDay = weekdayInTz(firstMs, tz);
      const daysInMonth = getDaysInMonthGregorian(calYear, calMonth);
      const todayStr = ymdInTz(Date.now(), tz);
      let html = `<div class="Base-notifCalHeader"><button type="button" class="Base-notifCalNav" data-dir="-1">&#8249;</button><span class="Base-notifCalMonthYear">${MONTHS[calMonth]} ${calYear}</span><button type="button" class="Base-notifCalNav" data-dir="1">&#8250;</button></div><div class="Base-notifCalGrid">`;
      DAYS.forEach((d) => {
        html += `<span class="Base-notifCalDayName">${d}</span>`;
      });
      for (let i = 0; i < firstDay; i++) html += "<span></span>";
      for (let d = 1; d <= daysInMonth; d++) {
        const ds = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        let cls = "Base-notifCalDay";
        if (pendingDates.includes(ds)) cls += " is-selected";
        if (ds === todayStr) cls += " is-today";
        html += `<button type="button" class="${cls}" data-date="${ds}">${d}</button>`;
      }
      html += "</div>";
      calendarEl.innerHTML = html;

      calendarEl.querySelectorAll(".Base-notifCalNav").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          calMonth += parseInt(btn.dataset.dir, 10);
          if (calMonth > 11) {
            calMonth = 0;
            calYear += 1;
          }
          if (calMonth < 0) {
            calMonth = 11;
            calYear -= 1;
          }
          renderCalendar();
        });
      });
      calendarEl.querySelectorAll(".Base-notifCalDay").forEach((btn) => {
        btn.addEventListener("mousedown", (e) => {
          e.preventDefault();
          e.stopPropagation();
          dragStart = btn.dataset.date;
          dragEnd = dragStart;
          dragMode = pendingDates.includes(dragStart) ? "remove" : "add";
          updateDragPreview();
        });
        btn.addEventListener("mouseover", () => {
          if (dragStart === null) return;
          dragEnd = btn.dataset.date;
          updateDragPreview();
        });

        btn.addEventListener(
          "touchstart",
          (e) => {
            const touch = e.changedTouches && e.changedTouches.length ? e.changedTouches[0] : null;
            if (!touch) return;
            activeTouchId = touch.identifier;
            e.preventDefault();
            e.stopPropagation();
            dragStart = btn.dataset.date;
            dragEnd = dragStart;
            dragMode = pendingDates.includes(dragStart) ? "remove" : "add";
            updateDragPreview();
          },
          { passive: false }
        );
      });
    };
    rerenderCalendar = renderCalendar;

    const finalizeDrag = () => {
      if (dragStart === null) return;
      const range = getDatesInRange(dragStart, dragEnd || dragStart);
      if (dragMode === "add") range.forEach((d) => { if (!pendingDates.includes(d)) pendingDates.push(d); });
      else pendingDates = pendingDates.filter((d) => !range.includes(d));
      pendingDates.sort();
      dragStart = null;
      dragEnd = null;
      dragMode = null;
      activeTouchId = null;
      renderDateTags(tagsContainer);
      renderCalendar();
    };

    // Desktop: mouse-driven drag selection.
    document.addEventListener("mouseup", () => finalizeDrag());

    // Mobile: touch-driven drag selection.
    // We use `elementFromPoint` so the finger can slide over day cells without relying on hover.
    const onTouchMove = (e) => {
      if (dragStart === null) return;
      if (activeTouchId === null && e.touches && e.touches.length) activeTouchId = e.touches[0].identifier;

      const touch =
        (e.changedTouches && activeTouchId !== null)
          ? Array.from(e.changedTouches).find((t) => t.identifier === activeTouchId)
          : (e.touches && e.touches.length ? e.touches[0] : null);
      if (!touch) return;

      const dayBtn = getDayButtonFromPoint(touch.clientX, touch.clientY);
      if (!dayBtn) return;
      const ds = dayBtn.dataset.date;
      if (!ds) return;

      dragEnd = ds;
      updateDragPreview();

      // Prevent page scrolling while selecting dates.
      e.preventDefault();
    };

    const onTouchEndOrCancel = (e) => {
      if (dragStart === null) return;
      if (activeTouchId === null) {
        finalizeDrag();
        return;
      }
      if (!e.changedTouches || e.changedTouches.length === 0) return;
      const ended = Array.from(e.changedTouches).some((t) => t.identifier === activeTouchId);
      if (!ended) return;
      finalizeDrag();
    };

    if (calendarEl) {
      // `passive:false` is required so `preventDefault()` works.
      calendarEl.addEventListener("touchmove", onTouchMove, { passive: false });
      calendarEl.addEventListener("touchcancel", onTouchEndOrCancel);
    }
    document.addEventListener("touchend", onTouchEndOrCancel);

    renderCalendar();

    if (resetBtn) {
      resetBtn.addEventListener("click", (e) => {
        e.preventDefault();
        if (unreadCb) unreadCb.checked = true;
        if (readCb) readCb.checked = true;
        pendingDates = [];
        renderDateTags(tagsContainer);
        renderCalendar();
      });
    }

    if (applyBtn) {
      applyBtn.addEventListener("click", (e) => {
        e.preventDefault();
        const unread = !!(unreadCb && unreadCb.checked);
        const read = !!(readCb && readCb.checked);
        if (!unread && !read) {
          window.alert("At least one status filter must be selected (read/unread).");
          return;
        }
        api.saveFilters({ unread, read, dates: [...pendingDates] });
        api.updateFilterCountDisplay();
        if (typeof window.closePopup === "function") window.closePopup(popup);
        if (api.overlay.classList.contains("is-open")) document.body.style.overflow = "hidden";
        api.loadNotificationsIntoOverlay(1);
      });
    }
  };

  const filterPopupEl = document.getElementById(FILTER_POPUP_ID);
  if (filterPopupEl) {
    const observer = new MutationObserver(() => {
      if (filterPopupEl.hasAttribute("hidden") && api.overlay.classList.contains("is-open")) {
        document.body.style.overflow = "hidden";
      }
    });
    observer.observe(filterPopupEl, { attributes: true, attributeFilter: ["hidden"] });
  }

  bindFilterPopover();
  window.addEventListener("popup-opened", (e) => {
    if (e.detail && e.detail.id === FILTER_POPUP_ID) {
      const tz = getEffectiveTz();
      const utcOff = getUtcOffsetInfo(tz);
      console.log(
        "Notification filter — timezone:",
        tz,
        "UTC offset:",
        utcOff.label,
        `(${utcOff.minutes >= 0 ? "+" : ""}${utcOff.minutes} min from UTC)`
      );
      syncFilterPopoverFromStorage();
      bindFilterPopover();
    }
  });
})();
