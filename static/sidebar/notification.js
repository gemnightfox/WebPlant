/**
 * Notification overlay (used with sidebar/notification.html + sidebar/notification.css).
 * - Notification list loaded via GET /notification/get-notifications/ only when the user opens the overlay (bell click).
 * - Open/close overlay; open state in sessionStorage (base_notification_open).
 * - Unread badge: updated from DOM and via GET /notification/get-unread-count/ every 30s.
 * - Read all / Delete read: POST endpoints; optimistic UI.
 * - Per-item: toggle read/unread, delete; expand/collapse on click.
 */
(function () {
  const OVERLAY_KEY = "base_notification_open";
  const EXPANDED_KEY = "Base_notification_expanded";
  const BADGE_COUNT_KEY = "base_unread_notifications_count";
  const FILTER_STORAGE_KEY = "base_notification_filters";

  const FILTER_KEYS = ["unread", "read"];
  const DEFAULT_FILTERS = { unread: true, read: true, dates: [] };

  const overlay = document.getElementById("Base-notificationOverlay");
  const openBtn = document.getElementById("Base-notificationsButton");
  const closeBtn = document.getElementById("Base-notificationClose");
  const readAllBtn = document.getElementById("Base-notificationReadAll");
  const deleteReadBtn = document.getElementById("Base-notificationDeleteRead");
  const bodyEl = overlay && overlay.querySelector(".Base-notificationBody");
  const filterCountEl = document.getElementById("Base-notificationFilterCount");

  let currentPage = 1;
  let lastPage = 1;

  if (!overlay || !openBtn || !closeBtn) return;

  const open = () => {
    overlay.classList.add("is-open");
    document.body.style.overflow = "hidden";
    try { sessionStorage.setItem(OVERLAY_KEY, "1"); } catch (_) {}
    loadNotificationsIntoOverlay();
  };

  const close = () => {
    overlay.classList.remove("is-open");
    document.body.style.overflow = "";
    try { sessionStorage.removeItem(OVERLAY_KEY); } catch (_) {}
  };

  try {
    if (sessionStorage.getItem(OVERLAY_KEY) === "1") {
      overlay.classList.add("is-open");
      document.body.style.overflow = "hidden";
    }
  } catch (_) {}

  openBtn.addEventListener("click", (e) => {
    e.preventDefault();
    open();
  });
  closeBtn.addEventListener("click", (e) => {
    e.preventDefault();
    close();
  });
  closeBtn.addEventListener("dragstart", (e) => e.preventDefault());
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });

  const getCSRFToken = () => {
    const name = "csrftoken=";
    const parts = document.cookie.split(";").map((c) => c.trim());
    for (const p of parts) if (p.startsWith(name)) return decodeURIComponent(p.slice(name.length));
    return "";
  };

  const escapeHtml = (s) => {
    const div = document.createElement("div");
    div.textContent = s == null ? "" : String(s);
    return div.innerHTML;
  };

  const formatSentAt = (iso) => {
    if (!iso) return "";
    try {
      const d = new Date(iso);
      const day = d.getDate();
      const months = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec";
      const month = months.split(" ")[d.getMonth()];
      const year = d.getFullYear();
      return `${day} ${month} ${year}`;
    } catch (_) {
      return typeof iso === "string" ? iso : "";
    }
  };

  const buildNotificationItem = (n) => {
    const id = n.id != null ? String(n.id) : "";
    const isUnread = !n.read_status;
    const item = document.createElement("div");
    item.className = "Base-notificationItem" + (isUnread ? " Base-is-unread" : "");
    item.dataset.notificationId = id;
    item.dataset.readStatus = n.read_status ? "1" : "0";

    const text = document.createElement("div");
    text.className = "Base-notificationItemText" + (isUnread ? " Base-is-unreadText" : "");
    text.textContent = n.content != null ? String(n.content) : "";

    const rawSenderEmail = n.sender_email != null ? n.sender_email : n["sender__email"];
    const senderLabel =
      rawSenderEmail != null && rawSenderEmail !== ""
        ? String(rawSenderEmail)
        : n.sender_id != null
          ? String(n.sender_id)
          : "[DELETED USER]";
    const meta = document.createElement("div");
    meta.className = "Base-notificationItemMeta";
    meta.innerHTML = "<span class=\"Base-notificationMetaSender\">" + escapeHtml(senderLabel) + "</span><span class=\"Base-notificationMetaDot\">•</span><span class=\"Base-notificationMetaTime\">" + escapeHtml(formatSentAt(n.sent_at)) + "</span>";

    const actions = document.createElement("div");
    actions.className = "Base-notificationItemActions";
    actions.innerHTML = "<button type=\"button\" class=\"Base-notificationToggleReadBtn\">" + (isUnread ? "Read" : "Unread") + "</button><button type=\"button\" class=\"Base-notificationDeleteBtn\"><svg xmlns=\"http://www.w3.org/2000/svg\" fill=\"none\" viewBox=\"0 0 24 24\" stroke-width=\"1.5\" stroke=\"currentColor\"><path stroke-linecap=\"round\" stroke-linejoin=\"round\" d=\"m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0\" /></svg></button>";

    item.appendChild(text);
    item.appendChild(meta);
    item.appendChild(actions);
    return item;
  };

  const getExpandedIds = () => {
    try {
      const raw = sessionStorage.getItem(EXPANDED_KEY);
      if (raw == null) return new Set();
      const arr = JSON.parse(raw);
      return new Set(Array.isArray(arr) ? arr : []);
    } catch (_) {
      return new Set();
    }
  };

  const saveExpandedIds = (ids) => {
    try {
      sessionStorage.setItem(EXPANDED_KEY, JSON.stringify([...ids]));
    } catch (_) {}
  };

  /* --- Notification filters (read/unread + dates); stored in localStorage --- */
  const getFilters = () => {
    try {
      const raw = window.localStorage.getItem(FILTER_STORAGE_KEY);
      if (raw == null) return Object.assign({}, DEFAULT_FILTERS);
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return Object.assign({}, DEFAULT_FILTERS);
      const unread = parsed.unread === true;
      const read = parsed.read === true;
      if (!unread && !read) return Object.assign({}, DEFAULT_FILTERS);
      const dates = Array.isArray(parsed.dates) ? parsed.dates.filter((d) => typeof d === "string") : [];
      return { unread, read, dates };
    } catch (_) {
      return Object.assign({}, DEFAULT_FILTERS);
    }
  };

  const saveFilters = (filters) => {
    try {
      window.localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filters));
    } catch (_) {}
  };

  const updateFilterCountDisplay = () => {
    if (!filterCountEl) return;
    const f = getFilters();
    const statusCount = (f.unread ? 1 : 0) + (f.read ? 1 : 0);
    const hasDates = f.dates && f.dates.length > 0;
    if (statusCount >= FILTER_KEYS.length && !hasDates) {
      filterCountEl.setAttribute("hidden", "");
      filterCountEl.textContent = "";
    } else {
      filterCountEl.removeAttribute("hidden");
      const parts = [];
      if (statusCount < FILTER_KEYS.length) {
        // Only one status selected.
        if (f.read && !f.unread) parts.push("Read only");
        else if (f.unread && !f.read) parts.push("Unread only");
        else parts.push("Filtered");
      }
      if (hasDates) parts.push(`${f.dates.length} date${f.dates.length > 1 ? "s" : ""}`);
      filterCountEl.textContent = parts.join(", ");
    }
  };

  const renderEmptyState = () => {
    if (!bodyEl) return;
    bodyEl.innerHTML = "";
    const empty = document.createElement("div");
    empty.className = "Base-notificationEmpty";
    empty.textContent = "No notifications.";
    bodyEl.appendChild(empty);
  };

  const buildPaginationControls = () => {
    if (!bodyEl || !lastPage || lastPage <= 1) return null;

    const container = document.createElement("div");
    container.className = "Base-notificationPagination";

    const summary = document.createElement("div");
    summary.className = "Base-notificationPaginationSummary";
    summary.textContent = `Page ${currentPage} of ${lastPage}`;
    container.appendChild(summary);

    const controls = document.createElement("div");
    controls.className = "Base-notificationPaginationControls";

    const makeButton = (label, targetPage, disabled) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "Base-notificationPaginationButton";
      btn.textContent = label;

      if (disabled) {
        btn.disabled = true;
        btn.classList.add("is-disabled");
      } else {
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          if (
            typeof targetPage !== "number" ||
            targetPage < 1 ||
            targetPage > lastPage ||
            targetPage === currentPage
          ) {
            return;
          }
          loadNotificationsIntoOverlay(targetPage);
        });
      }

      return btn;
    };

    const prevBtn = makeButton("Previous", currentPage - 1, currentPage <= 1);
    const nextBtn = makeButton("Next", currentPage + 1, currentPage >= lastPage);

    controls.appendChild(prevBtn);
    controls.appendChild(nextBtn);
    container.appendChild(controls);

    return container;
  };

  const loadNotificationsIntoOverlay = async (page) => {
    if (!bodyEl) return;
    try {
      const pageNumber = typeof page === "number" && page > 0 ? page : 1;
      const f = getFilters();
      const params = new URLSearchParams({ notifications_page: String(pageNumber) });
      if (f.unread) params.set("unread", "1");
      if (f.read) params.set("read", "1");
      const url = `/notification/get-notifications/?${params.toString()}`;
      const dates = Array.isArray(f.dates) ? f.dates : [];
      const fetchOpts = {
        method: "POST",
        headers: { Accept: "application/json", "X-CSRFToken": getCSRFToken() },
      };
      if (dates.length > 0) {
        const body = new FormData();
        body.append("notification_dates", JSON.stringify(dates));
        fetchOpts.body = body;
      }
      const res = await fetch(url, fetchOpts);
      if (!res.ok) throw new Error("get-notifications failed");
      const data = await res.json();
      const list = Array.isArray(data.notifications) ? data.notifications : [];
      const expandedIds = getExpandedIds();

      bodyEl.innerHTML = "";

      currentPage = pageNumber;
      lastPage =
        typeof data.last_page === "number" && data.last_page > 0
          ? data.last_page
          : 1;

      if (list.length === 0) {
        renderEmptyState();
        refreshHeaderButtons();
        updateUnreadBadgeFromDOM();
        return;
      }

      const container = document.createElement("div");
      container.className = "Base-notificationBodyInner";

      const listEl = document.createElement("div");
      listEl.className = "Base-notificationList";
      list.forEach((n) => listEl.appendChild(buildNotificationItem(n)));
      listEl.querySelectorAll(".Base-notificationItem").forEach((item) => {
        if (item.dataset.notificationId && expandedIds.has(item.dataset.notificationId)) {
          item.classList.add("is-expanded");
        }
      });

      container.appendChild(listEl);

      const pagination = buildPaginationControls();
      if (pagination) {
        container.appendChild(pagination);
      }

      bodyEl.appendChild(container);

      refreshHeaderButtons();
      updateUnreadBadgeFromDOM();
    } catch (_) {
      bodyEl.innerHTML = "<div class=\"Base-notificationEmpty\">Unable to load notifications.</div>";
      refreshHeaderButtons();
      updateUnreadBadgeFromDOM();
    }
  };

  const hasUnread = () => !!overlay.querySelector(".Base-notificationItem.Base-is-unread");
  const hasRead = () => !!overlay.querySelector('.Base-notificationItem[data-read-status="1"]');

  const setReadAllDisabled = (disabled) => {
    if (!readAllBtn) return;
    readAllBtn.disabled = !!disabled;
  };

  const setDeleteReadDisabled = (disabled) => {
    if (!deleteReadBtn) return;
    deleteReadBtn.disabled = !!disabled;
  };

  /* Unread badge: create/update/remove on sidebar bell */
  const getBadgeEl = () => openBtn.querySelector(".Base-badge");

  const getStoredUnreadCount = () => {
    try {
      const raw = window.localStorage.getItem(BADGE_COUNT_KEY);
      if (raw == null) return null;
      const num = parseInt(raw, 10);
      if (Number.isNaN(num) || num < 0) return null;
      return num;
    } catch (_) {
      return null;
    }
  };

  const saveStoredUnreadCount = (count) => {
    try {
      if (!count || count <= 0) {
        window.localStorage.removeItem(BADGE_COUNT_KEY);
      } else {
        window.localStorage.setItem(BADGE_COUNT_KEY, String(count));
      }
    } catch (_) {}
  };

  const setUnreadBadge = (count) => {
    const existing = getBadgeEl();

    if (!count || count <= 0) {
      if (existing) existing.remove();
      saveStoredUnreadCount(0);
      return;
    }

    const text = count > 99 ? "99+" : String(count);

    if (existing) {
      existing.textContent = text;
      saveStoredUnreadCount(count);
      return;
    }

    const badge = document.createElement("span");
    badge.className = "Base-badge";
    badge.textContent = text;
    openBtn.appendChild(badge);
    saveStoredUnreadCount(count);
  };

  const updateUnreadBadgeFromDOM = () => {
    const unreadCount = overlay.querySelectorAll(".Base-notificationItem.Base-is-unread").length;
    setUnreadBadge(unreadCount);
  };

  const primeUnreadBadgeFromStorage = () => {
    const stored = getStoredUnreadCount();
    if (stored != null) {
      setUnreadBadge(stored);
      return;
    }
    updateUnreadBadgeFromDOM();
  };

  /* Poll server every 30s so badge stays correct across tabs */
  const fetchUnreadCountFromServer = async () => {
    try {
      const res = await fetch("/notification/get-unread-count/", {
        method: "GET",
        headers: { Accept: "application/json" },
      });

      if (!res.ok) throw new Error("unread-count failed");

      const data = await res.json();
      if (typeof data.unread_count === "number") {
        setUnreadBadge(data.unread_count);
      }
    } catch (_) {}
  };

  const refreshHeaderButtons = () => {
    if (readAllBtn) setReadAllDisabled(!hasUnread());
    if (deleteReadBtn) setDeleteReadDisabled(!hasRead());
  };

  const setItemReadUI = (item, isRead) => {
    const text = item.querySelector(".Base-notificationItemText");
    const btn = item.querySelector(".Base-notificationToggleReadBtn");

    item.dataset.readStatus = isRead ? "1" : "0";

    if (isRead) {
      item.classList.remove("Base-is-unread");
      if (text) text.classList.remove("Base-is-unreadText");
      if (btn) btn.textContent = "Unread";
    } else {
      item.classList.add("Base-is-unread");
      if (text) text.classList.add("Base-is-unreadText");
      if (btn) btn.textContent = "Read";
    }

    refreshHeaderButtons();
    updateUnreadBadgeFromDOM();
  };

  const removeItemUI = (item) => {
    item.style.transition = "opacity 120ms ease, height 180ms ease, margin 180ms ease, padding 180ms ease";
    item.style.opacity = "0";
    item.style.height = item.offsetHeight + "px";
    requestAnimationFrame(() => {
      item.style.height = "0";
      item.style.marginTop = "0";
      item.style.marginBottom = "0";
      item.style.paddingTop = "0";
      item.style.paddingBottom = "0";
      item.style.overflow = "hidden";
    });
    setTimeout(() => {
      item.remove();
      if (!overlay.querySelector(".Base-notificationItem")) {
        renderEmptyState();
      }
    }, 220);
  };

  refreshHeaderButtons();
  primeUnreadBadgeFromStorage();
  updateFilterCountDisplay();
  fetchUnreadCountFromServer();
  setInterval(fetchUnreadCountFromServer, 30_000);
  if (overlay.classList.contains("is-open")) loadNotificationsIntoOverlay();

  /* --- Notification filter popup: sync from storage on open; Reset / Apply; date tags --- */
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
    const f = getFilters();
    const unreadCb = popup.querySelector('input[name="unread"]');
    const readCb = popup.querySelector('input[name="read"]');
    if (unreadCb) unreadCb.checked = !!f.unread;
    if (readCb) readCb.checked = !!f.read;
    pendingDates = Array.isArray(f.dates) ? [...f.dates] : [];
    const tagsContainer = popup.querySelector("#Base-notificationFilterDateTags");
    renderDateTags(tagsContainer);
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
    let dragMode = null; // 'add' | 'remove'

    const getDatesInRange = (a, b) => {
      const [start, end] = a <= b ? [a, b] : [b, a];
      const dates = [];
      const cur = new Date(start + "T00:00:00");
      const last = new Date(end + "T00:00:00");
      while (cur <= last) {
        dates.push(`${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,"0")}-${String(cur.getDate()).padStart(2,"0")}`);
        cur.setDate(cur.getDate() + 1);
      }
      return dates;
    };

    const updateDragPreview = () => {
      if (!calendarEl || dragStart === null) return;
      const range = getDatesInRange(dragStart, dragEnd || dragStart);
      calendarEl.querySelectorAll(".Base-notifCalDay").forEach(b => {
        b.classList.toggle("is-drag-range", range.includes(b.dataset.date));
      });
    };

    const renderCalendar = () => {
      if (!calendarEl) return;
      const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
      const DAYS = ["Su","Mo","Tu","We","Th","Fr","Sa"];
      const firstDay = new Date(calYear, calMonth, 1).getDay();
      const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;
      let html = `<div class="Base-notifCalHeader"><button type="button" class="Base-notifCalNav" data-dir="-1">&#8249;</button><span class="Base-notifCalMonthYear">${MONTHS[calMonth]} ${calYear}</span><button type="button" class="Base-notifCalNav" data-dir="1">&#8250;</button></div><div class="Base-notifCalGrid">`;
      DAYS.forEach(d => { html += `<span class="Base-notifCalDayName">${d}</span>`; });
      for (let i = 0; i < firstDay; i++) html += `<span></span>`;
      for (let d = 1; d <= daysInMonth; d++) {
        const ds = `${calYear}-${String(calMonth+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
        let cls = "Base-notifCalDay";
        if (pendingDates.includes(ds)) cls += " is-selected";
        if (ds === todayStr) cls += " is-today";
        html += `<button type="button" class="${cls}" data-date="${ds}">${d}</button>`;
      }
      html += `</div>`;
      calendarEl.innerHTML = html;
      calendarEl.querySelectorAll(".Base-notifCalNav").forEach(btn => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          calMonth += parseInt(btn.dataset.dir, 10);
          if (calMonth > 11) { calMonth = 0; calYear++; }
          if (calMonth < 0) { calMonth = 11; calYear--; }
          renderCalendar();
        });
      });
      calendarEl.querySelectorAll(".Base-notifCalDay").forEach(btn => {
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
      });
    };
    rerenderCalendar = renderCalendar;

    document.addEventListener("mouseup", () => {
      if (dragStart === null) return;
      const range = getDatesInRange(dragStart, dragEnd || dragStart);
      if (dragMode === "add") {
        range.forEach(d => { if (!pendingDates.includes(d)) pendingDates.push(d); });
      } else {
        pendingDates = pendingDates.filter(d => !range.includes(d));
      }
      pendingDates.sort();
      dragStart = null;
      dragEnd = null;
      dragMode = null;
      renderDateTags(tagsContainer);
      renderCalendar();
    });

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
          window.alert("At least one status filter must be selected.");
          return;
        }
        saveFilters({ unread, read, dates: [...pendingDates] });
        updateFilterCountDisplay();
        if (typeof window.closePopup === "function") {
          window.closePopup(popup);
        }
        if (overlay && overlay.classList.contains("is-open")) {
          document.body.style.overflow = "hidden";
        }
        loadNotificationsIntoOverlay(1);
      });
    }
  };

  /* Re-lock scroll when filter popup closes while notification overlay is still open */
  const filterPopupEl = document.getElementById(FILTER_POPUP_ID);
  if (filterPopupEl) {
    const filterPopupObserver = new MutationObserver(() => {
      if (filterPopupEl.hasAttribute("hidden") && overlay.classList.contains("is-open")) {
        document.body.style.overflow = "hidden";
      }
    });
    filterPopupObserver.observe(filterPopupEl, { attributes: true, attributeFilter: ["hidden"] });
  }

  bindFilterPopover();
  window.addEventListener("popup-opened", (e) => {
    if (e.detail && e.detail.id === FILTER_POPUP_ID) {
      syncFilterPopoverFromStorage();
      bindFilterPopover();
    }
  });

  /* --- Read all: confirm then POST; optimistic UI --- */
  if (readAllBtn) {
    readAllBtn.addEventListener("click", async (e) => {
      e.preventDefault();

      if (!hasUnread()) {
        refreshHeaderButtons();
        return;
      }

      const ok = window.confirm("Mark all notifications as read?");
      if (!ok) return;

      setReadAllDisabled(true);

      // Optimistic UI
      overlay.querySelectorAll(".Base-notificationItem").forEach((item) => setItemReadUI(item, true));

      try {
        const res = await fetch("/notification/read-all/", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": getCSRFToken(),
          },
          body: JSON.stringify({}),
        });
        if (!res.ok) throw new Error("read-all failed");
      } catch (_) {
        window.location.reload();
      } finally {
        refreshHeaderButtons();
      }
    });
  }

  /* --- Delete all read: confirm then POST; optimistic UI --- */
  if (deleteReadBtn) {
    deleteReadBtn.addEventListener("click", async (e) => {
      e.preventDefault();

      if (!hasRead()) {
        refreshHeaderButtons();
        return;
      }

      const ok = window.confirm("Delete all read notifications?");
      if (!ok) return;

      setDeleteReadDisabled(true);

      // Optimistic UI: remove only read items
      const readItems = Array.from(
        overlay.querySelectorAll('.Base-notificationItem[data-read-status="1"]')
      );
      readItems.forEach(removeItemUI);

      // Badge is unread-based, but update anyway to stay consistent
      updateUnreadBadgeFromDOM();

      try {
        const res = await fetch("/notification/delete-read/", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": getCSRFToken(),
          },
          body: JSON.stringify({}),
        });
        if (!res.ok) throw new Error("delete-read failed");
      } catch (_) {
        window.location.reload();
      } finally {
        refreshHeaderButtons();
      }
    });
  }

  /* --- Expand/collapse notification item on click (not on action buttons) --- */
  overlay.addEventListener("click", (e) => {
    if (e.target.closest(".Base-notificationToggleReadBtn")) return;
    if (e.target.closest(".Base-notificationDeleteBtn")) return;

    const item = e.target.closest(".Base-notificationItem");
    if (!item) return;

    item.classList.toggle("is-expanded");
    const id = item.dataset.notificationId;
    if (id) {
      const ids = getExpandedIds();
      if (item.classList.contains("is-expanded")) ids.add(id);
      else ids.delete(id);
      saveExpandedIds(ids);
    }
  });

  /* --- Toggle read/unread for single notification --- */
  overlay.addEventListener("click", async (e) => {
    const btn = e.target.closest(".Base-notificationToggleReadBtn");
    if (!btn) return;

    e.preventDefault();
    e.stopPropagation();

    const item = btn.closest(".Base-notificationItem");
    if (!item) return;

    const id = item.dataset.notificationId;
    const currentlyRead = item.dataset.readStatus === "1";
    const nextRead = !currentlyRead;

    setItemReadUI(item, nextRead);
    btn.disabled = true;

    try {
      const url = nextRead ? `/notification/read/${id}/` : `/notification/unread/${id}/`;

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": getCSRFToken(),
        },
        body: JSON.stringify({}),
      });

      if (!res.ok) throw new Error("toggle read failed");
    } catch (_) {
      window.location.reload();
    } finally {
      btn.disabled = false;
      refreshHeaderButtons();
    }
  });

  /* --- Delete single notification --- */
  overlay.addEventListener("click", async (e) => {
    const btn = e.target.closest(".Base-notificationDeleteBtn");
    if (!btn) return;

    e.preventDefault();
    e.stopPropagation();

    const item = btn.closest(".Base-notificationItem");
    if (!item) return;

    const id = item.dataset.notificationId;

    btn.disabled = true;

    removeItemUI(item);
    updateUnreadBadgeFromDOM();

    try {
      const res = await fetch(`/notification/delete/${id}/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": getCSRFToken(),
        },
        body: JSON.stringify({}),
      });

      if (!res.ok) throw new Error("delete failed");
    } catch (_) {
      window.location.reload();
    } finally {
      refreshHeaderButtons();
    }
  });
})();
