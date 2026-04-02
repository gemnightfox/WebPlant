(function () {
  const api = window.BaseNotification;
  if (!api || !api.overlay) return;

  const FILTER_POPUP_ID = "notification-filter-popup";
  let pendingDates = [];
  let calYear = new Date().getFullYear();
  let calMonth = new Date().getMonth();
  let rerenderCalendar = null;

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
    calYear = new Date().getFullYear();
    calMonth = new Date().getMonth();
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
      const cur = new Date(`${start}T00:00:00`);
      const last = new Date(`${end}T00:00:00`);
      while (cur <= last) {
        dates.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}-${String(cur.getDate()).padStart(2, "0")}`);
        cur.setDate(cur.getDate() + 1);
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
      const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
      const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
      const firstDay = new Date(calYear, calMonth, 1).getDay();
      const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      let html = `<div class="Base-notifCalHeader"><button type="button" class="Base-notifCalNav" data-dir="-1">&#8249;</button><span class="Base-notifCalMonthYear">${MONTHS[calMonth]} ${calYear}</span><button type="button" class="Base-notifCalNav" data-dir="1">&#8250;</button></div><div class="Base-notifCalGrid">`;
      DAYS.forEach((d) => { html += `<span class="Base-notifCalDayName">${d}</span>`; });
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
          if (calMonth > 11) { calMonth = 0; calYear += 1; }
          if (calMonth < 0) { calMonth = 11; calYear -= 1; }
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
      syncFilterPopoverFromStorage();
      bindFilterPopover();
    }
  });
})();
