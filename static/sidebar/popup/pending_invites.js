/**
 * Pending invites popup. Fetches list on open; Accept/Reject POST; reopen on reload when popup was open.
 */
(function () {
  const PLACEHOLDER_UUID = "00000000-0000-0000-0000-000000000000";

  // Best-effort canonicalization for UUID-like strings coming from JSON -> DOM attrs.
  // This defends against hidden/unicode characters that can make Django's <uuid:...> parser 500.
  function normalizeUuid(maybeUuid) {
    const s = (maybeUuid || "").toString().trim();
    // Extract all hex digits; if we have 32, format into UUID 8-4-4-4-12.
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
    // Fallback: try to find a standard UUID substring.
    const uuidMatch = s.match(
      /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/
    );
    return uuidMatch ? uuidMatch[0] : s;
  }

  function escapeHtml(s) {
    if (!s) return "";
    const div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }

  function loadPendingInvites(popup) {
    if (!popup) return;
    const checkUrl = popup.getAttribute("data-check-url");
    const loadingEl = popup.querySelector('[data-role="invites-loading"]');
    const emptyEl = popup.querySelector('[data-role="invites-empty"]');
    const listEl = popup.querySelector('[data-role="invites-list"]');
    if (!loadingEl || !emptyEl || !listEl) return;

    loadingEl.removeAttribute("hidden");
    emptyEl.setAttribute("hidden", "");
    listEl.setAttribute("hidden", "");
    listEl.innerHTML = "";

    fetch(checkUrl, { headers: { "X-Requested-With": "XMLHttpRequest" } })
      .then((r) => r.json())
      .then((data) => {
        const invited = (data && data.invited_workspaces) ? data.invited_workspaces : [];
        loadingEl.setAttribute("hidden", "");
        if (invited.length === 0) {
          emptyEl.removeAttribute("hidden");
        } else {
          invited.forEach((ws) => {
            const li = document.createElement("li");
            li.className = "Popup-invitesItem";
            li.dataset.workspaceId = ws.id;
            li.innerHTML =
              '<span class="Popup-invitesName">' + escapeHtml(ws.name) + "</span>" +
              '<span class="Popup-invitesActions">' +
              '<button type="button" class="Popup-invitesBtn Popup-invitesBtn--accept" data-action="accept" data-workspace-id="' + escapeHtml(ws.id) + '">Accept</button>' +
              '<button type="button" class="Popup-invitesBtn Popup-invitesBtn--reject" data-action="reject" data-workspace-id="' + escapeHtml(ws.id) + '">Reject</button>' +
              "</span>";
            listEl.appendChild(li);
          });
          listEl.removeAttribute("hidden");
        }
        if (typeof window.setPendingInvitesBadgeCount === "function") {
          window.setPendingInvitesBadgeCount(invited.length);
        }
      })
      .catch(() => {
        loadingEl.setAttribute("hidden", "");
        emptyEl.removeAttribute("hidden");
        emptyEl.textContent = "Could not load invites. Please try again.";
      });
  }

  document.body.addEventListener("click", (e) => {
    const btn = e.target.closest(".Popup-invitesBtn[data-action][data-workspace-id]");
    if (!btn) return;
    const popup = btn.closest(".Popup");
    if (!popup || popup.id !== "pending-invites-popup") return;

    const action = btn.getAttribute("data-action");
    // The UUID comes from JSON -> attribute; be defensive against hidden whitespace
    // or accidental extra characters so Django's <uuid:...> converter won't 500.
    let workspaceId = normalizeUuid(btn.getAttribute("data-workspace-id"));
    const prefixAttr = action === "accept" ? "data-accept-prefix" : "data-reject-prefix";
    const url = (popup.getAttribute(prefixAttr) || "").replace(PLACEHOLDER_UUID, workspaceId);
    if (!url) return;

    const csrfInput = document.querySelector('input[name="csrfmiddlewaretoken"]');
    const csrfToken = csrfInput ? csrfInput.value : "";
    btn.disabled = true;

    fetch(url, {
      method: "POST",
      headers: {
        "X-Requested-With": "XMLHttpRequest",
        "X-CSRFToken": csrfToken,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "csrfmiddlewaretoken=" + encodeURIComponent(csrfToken),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data && data.status === "success") {
          if (action === "accept") {
            const row = btn.closest(".Popup-invitesItem");
            const workspaceName = row ? (row.querySelector(".Popup-invitesName") && row.querySelector(".Popup-invitesName").textContent) : "";
            if (row) row.remove();
            const listEl = popup.querySelector('[data-role="invites-list"]');
            if (listEl && listEl.children.length === 0) {
              listEl.setAttribute("hidden", "");
              const emptyEl = popup.querySelector('[data-role="invites-empty"]');
              if (emptyEl) {
                emptyEl.textContent = "You have no pending workspace invites.";
                emptyEl.removeAttribute("hidden");
              }
            }
            const settingsPrefix = popup.getAttribute("data-workspace-settings-prefix") || "";
            const settingsUrl = settingsPrefix.replace(PLACEHOLDER_UUID, workspaceId);
            if (typeof window.addSidebarWorkspace === "function") {
              window.addSidebarWorkspace(workspaceId, workspaceName || "Workspace", settingsUrl);
            }
            const invitesList = popup.querySelector('[data-role="invites-list"]');
            const remaining = invitesList ? invitesList.children.length : 0;
            if (typeof window.setPendingInvitesBadgeCount === "function") {
              window.setPendingInvitesBadgeCount(remaining);
            }
            window.location.reload();
            return;
          }
          const row = btn.closest(".Popup-invitesItem");
          if (row) row.remove();
          const listEl = popup.querySelector('[data-role="invites-list"]');
          if (listEl && listEl.children.length === 0) {
            listEl.setAttribute("hidden", "");
            const emptyEl = popup.querySelector('[data-role="invites-empty"]');
            if (emptyEl) {
              emptyEl.textContent = "You have no pending workspace invites.";
              emptyEl.removeAttribute("hidden");
            }
          }
          const invitesList = popup.querySelector('[data-role="invites-list"]');
          const remaining = invitesList ? invitesList.children.length : 0;
          if (typeof window.setPendingInvitesBadgeCount === "function") {
            window.setPendingInvitesBadgeCount(remaining);
          }
        } else {
          btn.disabled = false;
        }
      })
      .catch(() => {
        btn.disabled = false;
      });
  });

  window.addEventListener("beforeunload", () => {
    const pendingInvitesPopup = document.getElementById("pending-invites-popup");
    if (pendingInvitesPopup && !pendingInvitesPopup.hasAttribute("hidden")) {
      try { sessionStorage.setItem("reopen_pending_invites_popup", "1"); } catch (_) {}
    }
  });

  function onPopupOpened(_e) {
    if (_e.detail.id === "pending-invites-popup") loadPendingInvites(_e.detail.popupEl);
  }

  function init() {
    window.addEventListener("popup-opened", onPopupOpened);
    try {
      if (sessionStorage.getItem("reopen_pending_invites_popup") === "1") {
        sessionStorage.removeItem("reopen_pending_invites_popup");
        if (typeof window.openPopup === "function") window.openPopup("pending-invites-popup");
        const popupEl = document.getElementById("pending-invites-popup");
        if (popupEl) loadPendingInvites(popupEl);
      }
    } catch (_) {}
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
