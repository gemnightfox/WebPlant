/**
 * Sidebar bottom behavior (used with sidebar/bottom.html + sidebar/bottom.css).
 * Workspace panels: expand/collapse; last open workspace id in localStorage (base_open_workspace).
 * Workspace "..." menu: dropdown; "New project" uses data-popup + data-workspace-id (handled by popup.js).
 */
(function () {
  const OPEN_WORKSPACE_KEY = "base_open_workspace";
  const INVITES_BADGE_KEY = "base_pending_invites_count";

  const sidebar = document.getElementById("Base-sidebar");
  if (!sidebar) return;

  /* Pending invites badge for "Check pending invites" */
  function getStoredInvitesCount() {
    try {
      const raw = window.localStorage.getItem(INVITES_BADGE_KEY);
      if (raw == null) return null;
      const num = parseInt(raw, 10);
      if (Number.isNaN(num) || num < 0) return null;
      return num;
    } catch (_) {
      return null;
    }
  }

  function saveStoredInvitesCount(count) {
    try {
      if (!count || count <= 0) {
        window.localStorage.removeItem(INVITES_BADGE_KEY);
      } else {
        window.localStorage.setItem(INVITES_BADGE_KEY, String(count));
      }
    } catch (_) {}
  }

  function getInvitesBadgeEl() {
    const container = document.querySelector(".Base-newWorkspace");
    return container ? container.querySelector(".Base-invitesBadge") : null;
  }

  function getInvitesMarkEl() {
    const container = document.querySelector(".Base-newWorkspace");
    return container ? container.querySelector(".Base-newWorkspace-invitesMark") : null;
  }

  function getWorkspaceOptionsAlertEl() {
    const btn = document.querySelector(".Base-workspaceOptions-btn");
    return btn ? btn.querySelector(".Base-newWorkspace-alert") : null;
  }

  function setWorkspaceOptionsAlert(count) {
    const alertEl = getWorkspaceOptionsAlertEl();
    if (!alertEl) return;
    if (!count || count <= 0) {
      alertEl.hidden = true;
      return;
    }
    alertEl.hidden = false;
  }

  function setInvitesUI(count) {
    const mark = getInvitesMarkEl();
    if (!mark) return;
    let badge = getInvitesBadgeEl();
    if (!badge) {
      badge = document.createElement("span");
      badge.className = "Base-invitesBadge";
      badge.hidden = true;
      mark.appendChild(badge);
    }

    if (!count || count <= 0) {
      badge.hidden = true;
      mark.hidden = true;
      setWorkspaceOptionsAlert(0);
      saveStoredInvitesCount(0);
      return;
    }

    const text = count > 99 ? "99+" : String(count);
    badge.textContent = text;
    badge.hidden = false;
    mark.hidden = false;
    setWorkspaceOptionsAlert(count);
    saveStoredInvitesCount(count);
  }

  function fetchInvitesCountFromServer() {
    try {
      const popup = document.getElementById("pending-invites-popup");
      if (!popup) return;
      const url = popup.getAttribute("data-check-count-url");
      if (!url) return;
      fetch(url, { headers: { "X-Requested-With": "XMLHttpRequest" } })
        .then((r) => r.json())
        .then((data) => {
          const count = (data && typeof data.invite_count === "number") ? data.invite_count : 0;
          window.setPendingInvitesBadgeCount(count);
        })
        .catch(() => {
          if (window.setPendingInvitesBadgeCount) {
            window.setPendingInvitesBadgeCount(0);
          }
        });
    } catch (_) {}
  }

  // Expose setter so pending_invites.js can update when list changes
  window.setPendingInvitesBadgeCount = function (count) {
    setInvitesUI(count);
  };

  /* Workspace panels: expand/collapse and persist last open workspace */
  let savedOpenWorkspaceId = null;
  try {
    savedOpenWorkspaceId = localStorage.getItem(OPEN_WORKSPACE_KEY);
  } catch (_) {}

  document.querySelectorAll(".Base-workspaces-toggle").forEach((btn) => {
    const workspaceItem = btn.closest(".Base-workspace-item");
    const workspaceId = workspaceItem?.dataset.workspaceId;
    const panel = workspaceItem?.querySelector(".Base-workspaces-panel");
    if (!panel) return;
    if (workspaceId && savedOpenWorkspaceId && workspaceId === savedOpenWorkspaceId) {
      panel.removeAttribute("hidden");
      btn.classList.add("is-open");
      workspaceItem?.classList.add("is-expanded");
    }
  });

  // Initialize invites badge from localStorage (if any), then sync with server and poll periodically
  const storedInvites = getStoredInvitesCount();
  if (storedInvites != null) {
    setInvitesUI(storedInvites);
  } else {
    setInvitesUI(0);
  }
  fetchInvitesCountFromServer();
  setInterval(fetchInvitesCountFromServer, 30_000);

  function toggleWorkspacePanel(workspaceItem) {
    const btn = workspaceItem?.querySelector(".Base-workspaces-toggle");
    const panel = workspaceItem?.querySelector(".Base-workspaces-panel");
    const workspaceId = workspaceItem?.dataset?.workspaceId;
    if (!panel || !btn) return;
    const isHidden = panel.hasAttribute("hidden");
    if (isHidden) {
      panel.removeAttribute("hidden");
      btn.classList.add("is-open");
      workspaceItem.classList.add("is-expanded");
      if (workspaceId) {
        try { localStorage.setItem(OPEN_WORKSPACE_KEY, workspaceId); } catch (_) {}
      }
    } else {
      panel.setAttribute("hidden", "");
      btn.classList.remove("is-open");
      workspaceItem.classList.remove("is-expanded");
      if (workspaceId) {
        try { localStorage.removeItem(OPEN_WORKSPACE_KEY); } catch (_) {}
      }
    }
  }

  document.body.addEventListener("click", (e) => {
    const toggle = e.target.closest(".Base-workspaces-toggle");
    if (!toggle || e.target.closest(".Base-workspace-menu-btn")) return;
    const workspaceItem = toggle.closest(".Base-workspace-item");
    if (workspaceItem) toggleWorkspacePanel(workspaceItem);
  });

  document.body.addEventListener("keydown", (e) => {
    const toggle = e.target.closest(".Base-workspaces-toggle");
    if (!toggle || (e.key !== "Enter" && e.key !== " ")) return;
    e.preventDefault();
    const workspaceItem = toggle.closest(".Base-workspace-item");
    if (workspaceItem) toggleWorkspacePanel(workspaceItem);
  });

  /* Close all sidebar dropdowns (workspace options, workspace "...", project) */
  function closeAllSidebarDropdowns() {
    document.querySelectorAll(".Base-workspaceOptions-dropdown").forEach((d) => {
      d.hidden = true;
      d.classList.remove("Base-workspaceOptions-dropdown--above");
    });
    document.querySelectorAll(".Base-workspaceOptions-btn").forEach((b) => {
      b.setAttribute("aria-expanded", "false");
    });
    document.querySelectorAll(".Base-workspace-dropdown").forEach((d) => {
      d.hidden = true;
      d.classList.remove("Base-workspace-dropdown--above");
    });
    document.querySelectorAll(".Base-workspace-menu-btn").forEach((b) => {
      b.setAttribute("aria-expanded", "false");
    });
    document.querySelectorAll(".Base-project-dropdown").forEach((d) => {
      d.hidden = true;
      d.classList.remove("Base-project-dropdown--above");
    });
    document.querySelectorAll(".Base-project-menu-btn").forEach((b) => {
      b.setAttribute("aria-expanded", "false");
    });
  }

  function flipDropdownIfOverflowing(dropdown, aboveClass) {
    requestAnimationFrame(() => {
      if (dropdown.hidden) return;
      dropdown.classList.remove(aboveClass);
      const rect = dropdown.getBoundingClientRect();
      const scrollParent = dropdown.closest(".Base-workspaces") || sidebar;
      const maxBottom = scrollParent
        ? Math.min(scrollParent.getBoundingClientRect().bottom, window.innerHeight)
        : window.innerHeight;
      if (rect.bottom > maxBottom) {
        dropdown.classList.add(aboveClass);
      }
    });
  }

  /* Workspace options button: show dropdown; close all others first */
  const workspaceOptionsBtn = document.querySelector(".Base-workspaceOptions-btn");
  const workspaceOptionsDropdown = document.querySelector(".Base-workspaceOptions-dropdown");
  if (workspaceOptionsBtn && workspaceOptionsDropdown) {
    workspaceOptionsBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = !workspaceOptionsDropdown.hidden;
      closeAllSidebarDropdowns();
      if (!isOpen) {
        workspaceOptionsDropdown.hidden = false;
        workspaceOptionsBtn.setAttribute("aria-expanded", "true");
        flipDropdownIfOverflowing(workspaceOptionsDropdown, "Base-workspaceOptions-dropdown--above");
      }
    });
  }

  /* Workspace "..." menu: delegated so dynamically added workspaces work */
  document.body.addEventListener("click", (e) => {
    const menuBtn = e.target.closest(".Base-workspace-menu-btn");
    if (!menuBtn) return;
    const header = menuBtn.closest(".Base-workspace-header");
    const dropdown = header?.querySelector(".Base-workspace-dropdown");
    if (!dropdown) return;
    e.stopPropagation();
    const isOpen = !dropdown.hidden;
    closeAllSidebarDropdowns();
    if (!isOpen) {
      dropdown.hidden = false;
      menuBtn.setAttribute("aria-expanded", "true");
      flipDropdownIfOverflowing(dropdown, "Base-workspace-dropdown--above");
    }
  });

  document.addEventListener("click", closeAllSidebarDropdowns);

  /* Project "..." menu (inside anchor): show dropdown; close all others first */
  const projectMenuBtns = document.querySelectorAll(".Base-project-menu-btn");
  projectMenuBtns.forEach((menuBtn) => {
    const row = menuBtn.closest(".Base-project-row");
    const dropdown = row?.querySelector(".Base-project-dropdown");
    if (!dropdown) return;

    const toggleDropdown = (e) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      const isOpen = !dropdown.hidden;
      closeAllSidebarDropdowns();
      if (!isOpen) {
        dropdown.hidden = false;
        menuBtn.setAttribute("aria-expanded", "true");
        flipDropdownIfOverflowing(dropdown, "Base-project-dropdown--above");
      }
    };

    menuBtn.addEventListener("click", toggleDropdown);
    menuBtn.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        toggleDropdown(e);
      }
    });
  });

  /* Block clicks on disabled workspace dropdown items (e.g. no perms) */
  document.body.addEventListener("click", (e) => {
    const disabledItem = e.target.closest(".Base-workspace-dropdown-item[data-disabled='true']");
    if (!disabledItem) return;
    e.preventDefault();
    e.stopPropagation();
  });

  /* Inside dropdowns: allow data-popup buttons to bubble so popup.js can open popup */
  document.querySelectorAll(".Base-workspace-dropdown, .Base-workspaceOptions-dropdown").forEach((dropdown) => {
    dropdown.addEventListener("click", (e) => {
      if (e.target.closest("[data-popup]")) return;
      e.stopPropagation();
    });
  });

  /* Duplicate project via AJAX POST */
  document.body.addEventListener("click", (e) => {
    const btn = e.target.closest(".Base-project-duplicateBtn");
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    const projectId = btn.dataset.projectId;
    if (!projectId) return;
    const match = document.cookie.match(/csrftoken=([^;]+)/);
    const csrfToken = match ? match[1] : "";
    fetch("/project/duplicate/" + projectId + "/", {
      method: "POST",
      headers: { "X-CSRFToken": csrfToken },
    })
      .then((res) => {
        if (res.redirected) { window.location.href = res.url; return; }
        if (res.ok) return res.json().then((data) => { if (data.redirect) window.location.href = data.redirect; else window.location.reload(); });
        console.error("Duplicate project failed", res.status);
      })
      .catch((err) => console.error("Duplicate project error", err));
  });

  /* Persist open workspace when navigating to a project so panel stays open on return */
  document.body.addEventListener("click", (e) => {
    const link = e.target.closest(".Base-project-link");
    if (!link) return;
    const workspaceItem = link.closest(".Base-workspace-item");
    const workspaceId = workspaceItem?.dataset.workspaceId;
    if (!workspaceId) return;
    try { localStorage.setItem(OPEN_WORKSPACE_KEY, workspaceId); } catch (_) {}
  });

  const CHEVRON_SVG =
    '<svg class="Base-workspaces-chevronIcon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 9l6 6 6-6"/></svg>';
  const MENU_SVG =
    '<svg class="Base-workspace-menuIcon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM12.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM18.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z"/></svg>';

  function escapeAttr(s) {
    if (!s) return "";
    const div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }

  window.addSidebarWorkspace = function (workspaceId, workspaceName, settingsUrl) {
    const list = document.querySelector(".Base-workspaces-list");
    let listParent = list ? list.parentElement : null;
    if (!list) {
      const wrapper = document.querySelector(".Base-newWorkspace");
      if (!wrapper) return;
      listParent = document.createElement("div");
      listParent.className = "Base-workspaces";
      const newUl = document.createElement("ul");
      newUl.className = "Base-workspaces-list";
      listParent.appendChild(newUl);
      wrapper.after(listParent);
    }
    const ul = list || listParent.querySelector(".Base-workspaces-list");
    if (!ul) return;
    const name = escapeAttr(workspaceName);
    const url = escapeAttr(settingsUrl);
    const li = document.createElement("li");
    li.className = "Base-workspace-item";
    li.dataset.workspaceId = workspaceId;
    li.innerHTML =
      '<div class="Base-workspace-header">' +
        '<div class="Base-workspaces-toggle" role="button" tabindex="0">' +
          '<span class="Base-workspaces-label" title="' + name + '">' + name + '</span>' +
          '<span class="Base-workspace-actions">' +
            '<button type="button" class="Base-workspace-menu-btn" aria-haspopup="true" aria-expanded="false" title="Workspace options">' + MENU_SVG + '</button>' +
            '<span class="Base-workspaces-chevron" aria-hidden="true">' + CHEVRON_SVG + '</span>' +
          '</span>' +
        '</div>' +
        '<div class="Base-workspace-dropdown" hidden>' +
          '<ul class="Base-workspace-dropdown-list">' +
            '<li><a href="' + url + '" class="Base-workspace-dropdown-item">Settings</a></li>' +
            '<li><button type="button" class="Base-workspace-dropdown-item Base-workspace-newProjectBtn" data-popup="add-project-popup" data-workspace-id="' + escapeAttr(workspaceId) + '">New project</button></li>' +
          '</ul>' +
        '</div>' +
      '</div>' +
      '<div class="Base-workspaces-panel Base-workspaces-panel--empty" hidden></div>';
    ul.appendChild(li);
    const panel = li.querySelector(".Base-workspaces-panel");
    const toggle = li.querySelector(".Base-workspaces-toggle");
    if (panel && toggle) {
      panel.removeAttribute("hidden");
      toggle.classList.add("is-open");
      li.classList.add("is-expanded");
    }
  };

  // Guard: normalize UUID in workspace settings links before navigation.
  // This avoids Django's <uuid:...> converter throwing on hidden/unexpected characters.
  function normalizeUuid(maybeUuid) {
    const s = (maybeUuid || "").toString().trim();
    const hex = s.replace(/[^0-9a-fA-F]/g, "");
    if (hex.length === 32) {
      return (
        hex.slice(0, 8) +
        "-" +
        hex.slice(8, 12) +
        "-" +
        hex.slice(12, 16) +
        "-" +
        hex.slice(16, 20) +
        "-" +
        hex.slice(20, 32)
      );
    }
    const uuidMatch = s.match(
      /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/
    );
    return uuidMatch ? uuidMatch[0] : s;
  }

  /* Mobile only: collapse the sidebar whenever the user navigates via a link inside it */
  function collapseSidebarOnMobile() {
    if (window.innerWidth > 500) return;
    if (sidebar.classList.contains("is-collapsed")) return;
    sidebar.classList.add("is-collapsed");
    try { localStorage.setItem("base_sidebar_collapsed", "1"); } catch (_) {}
  }

  sidebar.addEventListener("click", (e) => {
    const link = e.target.closest("a[href]");
    if (!link) return;
    const href = link.getAttribute("href") || "";
    if (!href || href === "#" || href.startsWith("javascript:")) return;
    collapseSidebarOnMobile();
  }, true);

  document.body.addEventListener("click", (e) => {
    const a = e.target.closest('a[href*="/workspace/settings/"]');
    if (!a) return;
    e.preventDefault();

    const href = a.getAttribute("href") || "";
    const url = new URL(href, window.location.origin);
    const parts = url.pathname.split("/");
    const settingsIndex = parts.indexOf("settings");
    if (settingsIndex === -1) {
      // If parsing fails, fall back to original navigation.
      window.location.href = href;
      return;
    }
    const maybeUuid = parts[settingsIndex + 1] || "";
    const normalized = normalizeUuid(maybeUuid);
    if (!normalized) {
      window.location.href = href;
      return;
    }

    url.pathname = `/workspace/settings/${normalized}/`;
    window.location.href = url.toString();
  });
})();
