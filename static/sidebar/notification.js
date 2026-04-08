/**
 * Notification core behavior and shared state.
 * Extra behavior is split into notification.filters.js and notification.actions.js.
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

  if (!overlay || !openBtn || !closeBtn) return;

  let currentPage = 1;
  let lastPage = 1;

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

  const getEffectiveNotificationTimezone = () => {
    try {
      const raw = document.body && document.body.getAttribute("data-user-timezone");
      if (raw && typeof raw === "string" && raw.trim()) return raw.trim();
    } catch (_) {}
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch (_) {
      return "UTC";
    }
  };

  /*
   * Date and read/unread filtering: the API returns paginated rows without applying filters; we fetch
   * every page, dedupe, filter by status and (optional) calendar days in the account timezone, sort by
   * sent_at, then paginate in the overlay.
   */
  const SERVER_PAGE_SIZE = 100;

  const ymdFormatterCache = new Map();
  const getYmdFormatter = (tz) => {
    if (!ymdFormatterCache.has(tz)) {
      ymdFormatterCache.set(
        tz,
        new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" })
      );
    }
    return ymdFormatterCache.get(tz);
  };

  const ymdInTz = (ms, tz) => getYmdFormatter(tz).format(new Date(ms));

  const sentAtIsoToLocalYmd = (iso, tz) => {
    if (!iso) return "";
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) return "";
    return ymdInTz(t, tz);
  };

  /** Matches sidebar status toggles (read / unread). */
  const notificationMatchesStatusFilter = (n, f) => {
    const isRead = !!n.read_status;
    if (f.unread && f.read) return true;
    if (f.unread && !f.read) return !isRead;
    if (!f.unread && f.read) return isRead;
    return true;
  };

  const fetchNotificationsPageJson = async (pageNumber, f) => {
    const params = new URLSearchParams({ notifications_page: String(pageNumber) });
    if (f.unread) params.set("unread", "1");
    if (f.read) params.set("read", "1");
    const fetchOpts = { method: "POST", headers: { Accept: "application/json", "X-CSRFToken": getCSRFToken() } };
    const res = await fetch(`/notification/get-notifications/?${params.toString()}`, fetchOpts);
    if (!res.ok) throw new Error("get-notifications failed");
    return res.json();
  };

  const formatSentAt = (iso) => {
    if (!iso) return "";
    try {
      const d = new Date(iso);
      const tz = getEffectiveNotificationTimezone();
      return new Intl.DateTimeFormat(undefined, { timeZone: tz, day: "numeric", month: "short", year: "numeric" }).format(d);
    } catch (_) {
      return typeof iso === "string" ? iso : "";
    }
  };

  const getExpandedIds = () => {
    try {
      const raw = sessionStorage.getItem(EXPANDED_KEY);
      const arr = raw == null ? [] : JSON.parse(raw);
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

  const getFilters = () => {
    try {
      const raw = window.localStorage.getItem(FILTER_STORAGE_KEY);
      if (raw == null) return { ...DEFAULT_FILTERS };
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return { ...DEFAULT_FILTERS };
      const unread = parsed.unread === true;
      const read = parsed.read === true;
      if (!unread && !read) return { ...DEFAULT_FILTERS };
      const dates = Array.isArray(parsed.dates) ? parsed.dates.filter((d) => typeof d === "string") : [];
      return { unread, read, dates };
    } catch (_) {
      return { ...DEFAULT_FILTERS };
    }
  };

  const saveFilters = (filters) => {
    try {
      window.localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filters));
    } catch (_) {}
  };

  const DELETE_TRASH_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>';
  const DELETE_CHECK_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>';

  const resetDeleteConfirmButtons = () => {
    overlay.querySelectorAll(".Base-notificationDeleteBtn--confirm").forEach((btn) => {
      btn.classList.remove("Base-notificationDeleteBtn--confirm");
      btn.setAttribute("aria-label", "Delete notification");
      btn.setAttribute("title", "Delete");
    });
  };

  const updateFilterCountDisplay = () => {
    if (!filterCountEl) return;
    const f = getFilters();
    const statusCount = (f.unread ? 1 : 0) + (f.read ? 1 : 0);
    const hasDates = Array.isArray(f.dates) && f.dates.length > 0;
    if (statusCount >= FILTER_KEYS.length && !hasDates) {
      filterCountEl.setAttribute("hidden", "");
      filterCountEl.textContent = "";
      return;
    }
    filterCountEl.removeAttribute("hidden");
    const parts = [];
    if (statusCount < FILTER_KEYS.length) {
      if (f.read && !f.unread) parts.push("Read only");
      else if (f.unread && !f.read) parts.push("Unread only");
      else parts.push("Filtered");
    }
    if (hasDates) parts.push(`${f.dates.length} date${f.dates.length > 1 ? "s" : ""}`);
    filterCountEl.textContent = parts.join(", ");
  };

  const buildNotificationItem = (n) => {
    const id = n.id != null ? String(n.id) : "";
    const isUnread = !n.read_status;
    const item = document.createElement("div");
    item.className = `Base-notificationItem${isUnread ? " Base-is-unread" : ""}`;
    item.dataset.notificationId = id;
    item.dataset.readStatus = n.read_status ? "1" : "0";

    const text = document.createElement("div");
    text.className = `Base-notificationItemText${isUnread ? " Base-is-unreadText" : ""}`;
    text.textContent = n.content != null ? String(n.content) : "";

    const rawSenderEmail = n.sender_email != null ? n.sender_email : n["sender__email"];
    const senderLabel = rawSenderEmail != null && rawSenderEmail !== ""
      ? String(rawSenderEmail).split("@")[0]
      : n.sender_id != null ? String(n.sender_id) : "[DELETED USER]";

    const meta = document.createElement("div");
    meta.className = "Base-notificationItemMeta";
    meta.innerHTML =
      `<span class="Base-notificationMetaSender">${escapeHtml(senderLabel)}</span>` +
      `<span class="Base-notificationMetaDot">•</span>` +
      `<span class="Base-notificationMetaTime">${escapeHtml(formatSentAt(n.sent_at))}</span>`;

    const actions = document.createElement("div");
    actions.className = "Base-notificationItemActions";
    actions.innerHTML =
      `<button type="button" class="Base-notificationToggleReadBtn">${isUnread ? "Read" : "Unread"}</button>` +
      `<button type="button" class="Base-notificationDeleteBtn" aria-label="Delete notification" title="Delete">` +
      `<span class="Base-notificationDeleteBtn-trash" aria-hidden="true">${DELETE_TRASH_SVG}</span>` +
      `<span class="Base-notificationDeleteBtn-confirm" aria-hidden="true">${DELETE_CHECK_SVG}</span>` +
      `</button>`;

    item.appendChild(text);
    item.appendChild(meta);
    item.appendChild(actions);
    return item;
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
    container.innerHTML =
      `<div class="Base-notificationPaginationSummary">Page ${currentPage} of ${lastPage}</div>` +
      `<div class="Base-notificationPaginationControls"></div>`;
    const controls = container.querySelector(".Base-notificationPaginationControls");
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
          if (typeof targetPage !== "number" || targetPage < 1 || targetPage > lastPage || targetPage === currentPage) return;
          loadNotificationsIntoOverlay(targetPage);
        });
      }
      return btn;
    };
    controls.appendChild(makeButton("Previous", currentPage - 1, currentPage <= 1));
    controls.appendChild(makeButton("Next", currentPage + 1, currentPage >= lastPage));
    return container;
  };

  const setReadAllDisabled = (disabled) => { if (readAllBtn) readAllBtn.disabled = !!disabled; };
  const setDeleteReadDisabled = (disabled) => { if (deleteReadBtn) deleteReadBtn.disabled = !!disabled; };
  const hasUnread = () => !!overlay.querySelector(".Base-notificationItem.Base-is-unread");
  const hasRead = () => !!overlay.querySelector('.Base-notificationItem[data-read-status="1"]');

  const getBadgeEl = () => openBtn.querySelector(".Base-badge");
  const getStoredUnreadCount = () => {
    try {
      const raw = window.localStorage.getItem(BADGE_COUNT_KEY);
      const num = raw == null ? NaN : parseInt(raw, 10);
      return Number.isNaN(num) || num < 0 ? null : num;
    } catch (_) {
      return null;
    }
  };
  const saveStoredUnreadCount = (count) => {
    try {
      if (!count || count <= 0) window.localStorage.removeItem(BADGE_COUNT_KEY);
      else window.localStorage.setItem(BADGE_COUNT_KEY, String(count));
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
    if (existing) existing.textContent = text;
    else {
      const badge = document.createElement("span");
      badge.className = "Base-badge";
      badge.textContent = text;
      openBtn.appendChild(badge);
    }
    saveStoredUnreadCount(count);
  };
  const updateUnreadBadgeFromDOM = () => setUnreadBadge(overlay.querySelectorAll(".Base-notificationItem.Base-is-unread").length);
  const refreshHeaderButtons = () => {
    setReadAllDisabled(!hasUnread());
    setDeleteReadDisabled(!hasRead());
  };

  const setItemReadUI = (item, isRead) => {
    const delBtn = item.querySelector(".Base-notificationDeleteBtn");
    if (delBtn) {
      delBtn.classList.remove("Base-notificationDeleteBtn--confirm");
      delBtn.setAttribute("aria-label", "Delete notification");
      delBtn.setAttribute("title", "Delete");
    }
    const text = item.querySelector(".Base-notificationItemText");
    const btn = item.querySelector(".Base-notificationToggleReadBtn");
    item.dataset.readStatus = isRead ? "1" : "0";
    item.classList.toggle("Base-is-unread", !isRead);
    if (text) text.classList.toggle("Base-is-unreadText", !isRead);
    if (btn) btn.textContent = isRead ? "Unread" : "Read";
    refreshHeaderButtons();
    updateUnreadBadgeFromDOM();
  };

  const removeItemUI = (item) => {
    item.style.transition = "opacity 120ms ease, height 180ms ease, margin 180ms ease, padding 180ms ease";
    item.style.opacity = "0";
    item.style.height = `${item.offsetHeight}px`;
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
      if (!overlay.querySelector(".Base-notificationItem")) renderEmptyState();
    }, 220);
  };

  const loadNotificationsIntoOverlay = async (page) => {
    if (!bodyEl) return;
    try {
      const pageNumber = typeof page === "number" && page > 0 ? page : 1;
      const f = getFilters();
      const expandedIds = getExpandedIds();
      const hasLocalDates = Array.isArray(f.dates) && f.dates.length > 0;
      const selectedLocal = hasLocalDates ? new Set(f.dates) : null;
      const tz = hasLocalDates ? getEffectiveNotificationTimezone() : "";

      let merged = [];
      let serverLastPage = 1;
      for (let p = 1; p <= serverLastPage; p++) {
        const data = await fetchNotificationsPageJson(p, f);
        const chunk = Array.isArray(data.notifications) ? data.notifications : [];
        merged = merged.concat(chunk);
        serverLastPage = typeof data.last_page === "number" && data.last_page > 0 ? data.last_page : 1;
      }

      const byId = new Map();
      merged.forEach((n) => {
        if (n && n.id != null) byId.set(String(n.id), n);
      });

      let filtered = Array.from(byId.values()).filter((n) => notificationMatchesStatusFilter(n, f));
      if (selectedLocal) {
        filtered = filtered.filter((n) => selectedLocal.has(sentAtIsoToLocalYmd(n.sent_at, tz)));
      }
      filtered.sort((a, b) => {
        const ta = new Date(a.sent_at).getTime();
        const tb = new Date(b.sent_at).getTime();
        return tb - ta;
      });

      const total = filtered.length;
      lastPage = Math.max(1, Math.ceil(total / SERVER_PAGE_SIZE) || 1);
      const effectivePage = Math.min(pageNumber, lastPage);
      currentPage = effectivePage;
      const start = (effectivePage - 1) * SERVER_PAGE_SIZE;
      const list = filtered.slice(start, start + SERVER_PAGE_SIZE);

      bodyEl.innerHTML = "";
      if (list.length === 0) {
        renderEmptyState();
      } else {
        const container = document.createElement("div");
        container.className = "Base-notificationBodyInner";
        const listEl = document.createElement("div");
        listEl.className = "Base-notificationList";
        list.forEach((n) => listEl.appendChild(buildNotificationItem(n)));
        listEl.querySelectorAll(".Base-notificationItem").forEach((item) => {
          if (item.dataset.notificationId && expandedIds.has(item.dataset.notificationId)) item.classList.add("is-expanded");
        });
        container.appendChild(listEl);
        const pagination = buildPaginationControls();
        if (pagination) container.appendChild(pagination);
        bodyEl.appendChild(container);
      }
      refreshHeaderButtons();
      updateUnreadBadgeFromDOM();
    } catch (_) {
      bodyEl.innerHTML = '<div class="Base-notificationEmpty">Unable to load notifications.</div>';
      refreshHeaderButtons();
      updateUnreadBadgeFromDOM();
    }
  };

  const fetchUnreadCountFromServer = async () => {
    try {
      const res = await fetch("/notification/get-unread-count/", { method: "GET", headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error("unread-count failed");
      const data = await res.json();
      if (typeof data.unread_count === "number") setUnreadBadge(data.unread_count);
    } catch (_) {}
  };

  const open = () => {
    overlay.classList.add("is-open");
    document.body.style.overflow = "hidden";
    try { sessionStorage.setItem(OVERLAY_KEY, "1"); } catch (_) {}
    loadNotificationsIntoOverlay();
  };
  const close = () => {
    resetDeleteConfirmButtons();
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

  openBtn.addEventListener("click", (e) => { e.preventDefault(); open(); });
  closeBtn.addEventListener("click", (e) => { e.preventDefault(); close(); });
  closeBtn.addEventListener("dragstart", (e) => e.preventDefault());
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });

  const stored = getStoredUnreadCount();
  if (stored != null) setUnreadBadge(stored);
  else updateUnreadBadgeFromDOM();
  updateFilterCountDisplay();
  refreshHeaderButtons();
  fetchUnreadCountFromServer();
  setInterval(fetchUnreadCountFromServer, 30_000);
  if (overlay.classList.contains("is-open")) loadNotificationsIntoOverlay();
  window.addEventListener("user-timezone-changed", () => {
    if (!overlay.classList.contains("is-open")) return;
    loadNotificationsIntoOverlay(currentPage);
  });

  window.BaseNotification = {
    overlay,
    readAllBtn,
    deleteReadBtn,
    getCSRFToken,
    getExpandedIds,
    saveExpandedIds,
    getFilters,
    saveFilters,
    updateFilterCountDisplay,
    loadNotificationsIntoOverlay,
    refreshHeaderButtons,
    setItemReadUI,
    removeItemUI,
    updateUnreadBadgeFromDOM,
    hasUnread,
    hasRead,
    resetDeleteConfirmButtons,
    getEffectiveNotificationTimezone,
  };
})();
