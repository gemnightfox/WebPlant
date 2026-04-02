(function () {
  const api = window.BaseNotification;
  if (!api || !api.overlay) return;

  const { overlay, readAllBtn, deleteReadBtn } = api;

  if (readAllBtn) {
    readAllBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      if (!api.hasUnread()) {
        api.refreshHeaderButtons();
        return;
      }
      if (!window.confirm("Mark all notifications as read?")) return;
      readAllBtn.disabled = true;
      api.resetDeleteConfirmButtons();
      overlay.querySelectorAll(".Base-notificationItem").forEach((item) => api.setItemReadUI(item, true));
      try {
        const res = await fetch("/notification/read-all/", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-CSRFToken": api.getCSRFToken() },
          body: JSON.stringify({}),
        });
        if (!res.ok) throw new Error("read-all failed");
      } catch (_) {
        window.location.reload();
      } finally {
        api.refreshHeaderButtons();
      }
    });
  }

  if (deleteReadBtn) {
    deleteReadBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      if (!api.hasRead()) {
        api.refreshHeaderButtons();
        return;
      }
      if (!window.confirm("Delete all read notifications?")) return;
      deleteReadBtn.disabled = true;
      api.resetDeleteConfirmButtons();
      Array.from(overlay.querySelectorAll('.Base-notificationItem[data-read-status="1"]')).forEach(api.removeItemUI);
      api.updateUnreadBadgeFromDOM();
      try {
        const res = await fetch("/notification/delete-read/", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-CSRFToken": api.getCSRFToken() },
          body: JSON.stringify({}),
        });
        if (!res.ok) throw new Error("delete-read failed");
      } catch (_) {
        window.location.reload();
      } finally {
        api.refreshHeaderButtons();
      }
    });
  }

  overlay.addEventListener("click", (e) => {
    if (e.target.closest(".Base-notificationToggleReadBtn")) return;
    if (e.target.closest(".Base-notificationDeleteBtn")) return;
    api.resetDeleteConfirmButtons();
    const item = e.target.closest(".Base-notificationItem");
    if (!item) return;
    item.classList.toggle("is-expanded");
    const id = item.dataset.notificationId;
    if (!id) return;
    const ids = api.getExpandedIds();
    if (item.classList.contains("is-expanded")) ids.add(id);
    else ids.delete(id);
    api.saveExpandedIds(ids);
  });

  overlay.addEventListener("click", async (e) => {
    const btn = e.target.closest(".Base-notificationToggleReadBtn");
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    api.resetDeleteConfirmButtons();
    const item = btn.closest(".Base-notificationItem");
    if (!item) return;
    const id = item.dataset.notificationId;
    const nextRead = item.dataset.readStatus !== "1";
    api.setItemReadUI(item, nextRead);
    btn.disabled = true;
    try {
      const url = nextRead ? `/notification/read/${id}/` : `/notification/unread/${id}/`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRFToken": api.getCSRFToken() },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error("toggle read failed");
    } catch (_) {
      window.location.reload();
    } finally {
      btn.disabled = false;
      api.refreshHeaderButtons();
    }
  });

  overlay.addEventListener("click", async (e) => {
    const btn = e.target.closest(".Base-notificationDeleteBtn");
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    const item = btn.closest(".Base-notificationItem");
    if (!item) return;
    const id = item.dataset.notificationId;

    if (!btn.classList.contains("Base-notificationDeleteBtn--confirm")) {
      api.resetDeleteConfirmButtons();
      btn.classList.add("Base-notificationDeleteBtn--confirm");
      btn.setAttribute("aria-label", "Click again to delete");
      btn.setAttribute("title", "Confirm delete");
      return;
    }

    btn.classList.remove("Base-notificationDeleteBtn--confirm");
    btn.setAttribute("aria-label", "Delete notification");
    btn.setAttribute("title", "Delete");
    btn.disabled = true;
    api.removeItemUI(item);
    api.updateUnreadBadgeFromDOM();
    try {
      const res = await fetch(`/notification/delete/${id}/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRFToken": api.getCSRFToken() },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error("delete failed");
    } catch (_) {
      window.location.reload();
    } finally {
      api.refreshHeaderButtons();
    }
  });
})();
