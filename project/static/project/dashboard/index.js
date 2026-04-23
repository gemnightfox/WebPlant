/**
 * Project dashboard: delete groups and tasks via AJAX; group rename uses edit-group popup.
 */
(function () {
  // Frontend counterpart for the backend `project:get_data` route.
  // Existing UI keeps using server-rendered data; this helper is opt-in for future incremental updates.
  function exposeProjectDataApi() {
    var dashboardEl = document.querySelector(".Dashboard");
    if (!dashboardEl) return;
    var dataUrl = dashboardEl.getAttribute("data-project-get-data-url");
    if (!dataUrl) return;
    window.WebPlantProjectDataApi = {
      url: dataUrl,
      fetchData: function () {
        return fetch(dataUrl, {
          method: "GET",
          headers: { "X-Requested-With": "XMLHttpRequest" },
        }).then(function (r) { return r.json(); });
      },
    };
  }
  exposeProjectDataApi();

  function initProjectDashboardRealtimeSync() {
    var dashboardEl = document.querySelector(".Dashboard");
    var api = window.WebPlantProjectDataApi;
    if (!dashboardEl || !api || typeof api.fetchData !== "function") return;
    var projectId = dashboardEl.getAttribute("data-dashboard-path");
    if (!projectId) return;

    var maxReconnectDelayMs = 12000;
    var socketsByKey = {};
    var reconnectTimersByKey = {};
    var reconnectDelayByKey = {};
    var pendingOwnNotificationsByKey = {};
    var hasQueuedNotificationByKey = {};
    var isFetchingByKey = {};
    var domObserver = null;

    function toKey(objectType, objectId) {
      return String(objectType || "") + ":" + String(objectId || "");
    }
    function getObjectIdFromKey(key) {
      var parts = String(key || "").split(":");
      return parts.length > 1 ? parts.slice(1).join(":") : "";
    }
    function getObjectTypeFromKey(key) {
      var parts = String(key || "").split(":");
      return parts.length > 0 ? parts[0] : "";
    }
    function getKeysForType(objectType) {
      var out = [];
      Object.keys(socketsByKey).forEach(function (key) {
        if (key.indexOf(objectType + ":") === 0) out.push(key);
      });
      return out;
    }
    function safeStringId(v) {
      return String(v || "").replace(/"/g, "");
    }
    function parsePathname(input) {
      try {
        if (typeof input === "string") return new URL(input, window.location.origin).pathname;
        if (input && typeof input.url === "string") return new URL(input.url, window.location.origin).pathname;
      } catch (e) {}
      return "";
    }
    function shouldTrackSocket(objectType, objectId) {
      if (!objectId) return false;
      if (objectType === "project") {
        return String(objectId) === String(projectId);
      }
      if (objectType === "group") {
        return !!document.querySelector('.Dashboard-groupHeader[data-group-id="' + safeStringId(objectId) + '"]');
      }
      if (objectType === "task") {
        return !!document.querySelector('.Dashboard-task[data-task-id="' + safeStringId(objectId) + '"]');
      }
      return false;
    }

    function updateProjectNameInSidebar(projectId, projectName) {
      if (!projectId || typeof projectName !== "string") return;
      var projectItem = document.querySelector('.Base-project-item[data-project-id="' + safeStringId(projectId) + '"]');
      if (!projectItem) return;
      var projectLink = projectItem.querySelector(".Base-project-link");
      var projectLinkLabel = projectItem.querySelector(".Base-project-link-label");
      if (projectLink) projectLink.setAttribute("title", projectName);
      if (projectLinkLabel) projectLinkLabel.textContent = projectName;
      projectItem.querySelectorAll("[data-project-name]").forEach(function (el) {
        el.setAttribute("data-project-name", projectName);
      });
    }
    function applyProjectData(projectData) {
      if (!projectData || !projectData.id) return;
      if (typeof projectData.name === "string" && projectData.name.trim()) {
        updateProjectNameInSidebar(String(projectData.id), projectData.name);
      }
    }
    function applyGroupData(groupData) {
      if (!groupData || !groupData.id) return;
      var groupId = String(groupData.id);
      var groupHeader = document.querySelector('.Dashboard-groupHeader[data-group-id="' + safeStringId(groupId) + '"]');
      var groupColumn = document.getElementById("group-" + groupId);
      if (groupHeader) {
        if (typeof groupData.name === "string") {
          groupHeader.setAttribute("data-group-name", groupData.name);
          var nameEl = groupHeader.querySelector(".Dashboard-groupName");
          if (nameEl) {
            nameEl.textContent = groupData.name;
            nameEl.setAttribute("title", groupData.name);
          }
        }
        if (groupData.position != null) {
          groupHeader.setAttribute("data-group-position", String(groupData.position));
          groupHeader.querySelectorAll("[data-group-position]").forEach(function (btn) {
            btn.setAttribute("data-group-position", String(groupData.position));
          });
        }
      }
      if (groupColumn && groupData.position != null) {
        groupColumn.setAttribute("data-group-position", String(groupData.position));
      }
    }
    function applyTaskData(taskData) {
      if (!taskData || !taskData.id) return;
      var taskId = String(taskData.id);
      var taskCard = document.querySelector('.Dashboard-task[data-task-id="' + safeStringId(taskId) + '"]');
      if (!taskCard) return;

      if (typeof taskData.name === "string") {
        taskCard.setAttribute("data-task-name", taskData.name);
        taskCard.setAttribute("title", taskData.name);
        var nameEl = taskCard.querySelector(".Dashboard-taskName");
        if (nameEl) nameEl.textContent = taskData.name;
      }
      if (taskData.position != null) {
        taskCard.setAttribute("data-task-position", String(taskData.position));
        taskCard.querySelectorAll("[data-task-position]").forEach(function (el) {
          el.setAttribute("data-task-position", String(taskData.position));
        });
      }
      if (typeof taskData.is_completed === "boolean") {
        taskCard.setAttribute("data-task-completed", taskData.is_completed ? "true" : "false");
        taskCard.classList.toggle("Dashboard-task--completed", taskData.is_completed);
        var taskCheckbox = taskCard.querySelector(".Dashboard-taskCheckbox");
        if (taskCheckbox) taskCheckbox.checked = taskData.is_completed;
      }
      if (typeof taskData.deadline === "string" || taskData.deadline == null) {
        taskCard.setAttribute("data-task-deadline", taskData.deadline || "");
      }
      if (taskData.group) {
        var nextGroupId = String(taskData.group);
        taskCard.setAttribute("data-task-group-id", nextGroupId);
      }

      function readTaskScriptJson(prefix, fallback) {
        var script = document.getElementById(prefix + "-" + taskId);
        if (!script) return fallback;
        try {
          return JSON.parse(script.textContent || "[]");
        } catch (e) {
          return fallback;
        }
      }
      function writeTaskScriptJson(prefix, value) {
        var script = document.getElementById(prefix + "-" + taskId);
        if (!script) return;
        try {
          script.textContent = JSON.stringify(value || []);
        } catch (e) {}
      }
      function mapById(items) {
        var m = {};
        (items || []).forEach(function (item) {
          if (!item || item.id == null) return;
          m[String(item.id)] = item;
        });
        return m;
      }
      function toArraySafe(value) {
        return Array.isArray(value) ? value : [];
      }
      function toStringSafe(value) {
        return value == null ? "" : String(value);
      }
      function syncTaskPopupDataStores() {
        var rawComments = toArraySafe(taskData.comments);
        var rawAttachments = toArraySafe(taskData.attachments);
        var rawAssignments = toArraySafe(taskData.assigned);
        var rawReminders = toArraySafe(taskData.reminders);

        var existingComments = mapById(readTaskScriptJson("comments", []));
        var existingAttachments = mapById(readTaskScriptJson("attachments", []));
        var existingAssignments = mapById(readTaskScriptJson("assignments", []));
        var existingReminders = mapById(readTaskScriptJson("reminders", []));

        var nextComments = rawComments.map(function (comment) {
          var id = toStringSafe(comment && comment.id);
          var prev = existingComments[id] || {};
          var addedById = toStringSafe(
            comment && (
              comment.added_by_id != null
                ? comment.added_by_id
                : (comment.added_by != null ? comment.added_by : prev.added_by_id)
            )
          );
          return {
            id: id,
            content: toStringSafe(comment && (comment.content != null ? comment.content : prev.content)),
            added_by: toStringSafe(
              comment && (
                comment.added_by_username != null
                  ? comment.added_by_username
                  : (comment.added_by_name != null ? comment.added_by_name : prev.added_by)
              )
            ),
            added_by_id: addedById,
          };
        });

        var nextAttachments = rawAttachments.map(function (attachment) {
          var id = toStringSafe(attachment && attachment.id);
          var prev = existingAttachments[id] || {};
          var fallbackName = toStringSafe(attachment && attachment.file);
          return {
            id: id,
            name: toStringSafe(
              attachment && (
                attachment.name != null
                  ? attachment.name
                  : (attachment.file_name != null ? attachment.file_name : (prev.name || fallbackName || "Attachment"))
              )
            ),
            url: toStringSafe(
              attachment && (
                attachment.url != null
                  ? attachment.url
                  : (attachment.file_url != null ? attachment.file_url : (attachment.file != null ? attachment.file : prev.url))
              )
            ),
            media_url: toStringSafe(
              attachment && (
                attachment.media_url != null
                  ? attachment.media_url
                  : (prev.media_url || (id ? "/task/attachment/media/" + id + "/" : ""))
              )
            ),
            delete_url: toStringSafe(
              attachment && (
                attachment.delete_url != null
                  ? attachment.delete_url
                  : (prev.delete_url || (id ? "/task/attachment/delete/" + id + "/" : ""))
              )
            ),
          };
        });

        var nextAssignments = rawAssignments.map(function (assignment) {
          var id = toStringSafe(assignment && assignment.id);
          var prev = existingAssignments[id] || {};
          var assignedToId = toStringSafe(
            assignment && (
              assignment.assigned_to_id != null
                ? assignment.assigned_to_id
                : (assignment.assigned_to != null ? assignment.assigned_to : prev.assigned_to_id)
            )
          );
          return {
            id: id,
            assigned_to_id: assignedToId,
            assigned_to: toStringSafe(
              assignment && (
                assignment.assigned_to_username != null
                  ? assignment.assigned_to_username
                  : (assignment.assigned_to_name != null ? assignment.assigned_to_name : prev.assigned_to)
              )
            ),
            delete_url: toStringSafe(
              assignment && (
                assignment.delete_url != null
                  ? assignment.delete_url
                  : (prev.delete_url || (id ? "/task/assigned/delete/" + id + "/" : ""))
              )
            ),
          };
        });

        var nextReminders = rawReminders.map(function (reminder) {
          var id = toStringSafe(reminder && reminder.id);
          var prev = existingReminders[id] || {};
          return {
            id: id,
            send_at: toStringSafe(reminder && (reminder.send_at != null ? reminder.send_at : prev.send_at)),
            delete_url: toStringSafe(
              reminder && (
                reminder.delete_url != null
                  ? reminder.delete_url
                  : (prev.delete_url || (id ? "/task/reminder/delete/" + id + "/" : ""))
              )
            ),
          };
        });

        writeTaskScriptJson("comments", nextComments);
        writeTaskScriptJson("attachments", nextAttachments);
        writeTaskScriptJson("assignments", nextAssignments);
        writeTaskScriptJson("reminders", nextReminders);
      }

      syncTaskPopupDataStores();
      try {
        window.dispatchEvent(new CustomEvent("webplant-task-data-updated", {
          detail: { taskId: taskId, task: taskData },
        }));
      } catch (e) {}
      if (typeof renderDeadlineBadges === "function") renderDeadlineBadges();
    }
    function applyFetchedPayload(objectType, payload) {
      if (objectType === "project") {
        applyProjectData(payload && payload.project ? payload.project : null);
        return;
      }
      if (objectType === "group") {
        applyGroupData(payload && payload.group ? payload.group : null);
        return;
      }
      if (objectType === "task") {
        applyTaskData(payload && payload.task ? payload.task : null);
      }
    }
    function getDataUrl(objectType, objectId) {
      if (!objectId) return "";
      if (objectType === "project" && api && api.url) return api.url;
      if (objectType === "group") return "/group/get-data/" + objectId + "/";
      if (objectType === "task") return "/task/get-data/" + objectId + "/";
      if (objectType === "project") return "/project/get-data/" + objectId + "/";
      return "";
    }
    function fetchAndApplyObjectData(objectType, objectId) {
      if (!objectId) return;
      var key = toKey(objectType, objectId);
      if (isFetchingByKey[key]) return;
      var dataUrl = getDataUrl(objectType, objectId);
      if (!dataUrl) return;
      isFetchingByKey[key] = true;

      var req;
      if (objectType === "project" && api && typeof api.fetchData === "function") {
        req = api.fetchData();
      } else {
        req = fetch(dataUrl, {
          method: "GET",
          headers: { "X-Requested-With": "XMLHttpRequest" },
        }).then(function (r) { return r.json(); });
      }

      req
        .then(function (payload) {
          applyFetchedPayload(objectType, payload);
        })
        .catch(function () {
          // Keep websocket sync active even if one refresh request fails.
        })
        .finally(function () {
          isFetchingByKey[key] = false;
        });
    }
    function getWebSocketUrl(objectType, objectId) {
      var protocol = window.location.protocol === "https:" ? "wss://" : "ws://";
      return protocol + window.location.host + "/websocket/" + objectType + "/update/" + objectId + "/";
    }
    function normalizeAction(action) {
      var value = String(action || "").toLowerCase();
      if (value === "create" || value === "delete") return value;
      return "edit";
    }
    function queueOrSendNotification(objectType, objectId, action) {
      if (!objectId) return;
      var key = toKey(objectType, objectId);
      var normalizedAction = normalizeAction(action);
      var socket = socketsByKey[key];
      if (socket && socket.readyState === WebSocket.OPEN) {
        pendingOwnNotificationsByKey[key] = (pendingOwnNotificationsByKey[key] || 0) + 1;
        console.log("[websocket-sync] sending update notification", {
          objectType: objectType,
          objectId: objectId,
          action: normalizedAction,
        });
        socket.send(JSON.stringify({ action: normalizedAction }));
        return;
      }
      if (normalizedAction === "delete") {
        // Avoid queuing delete actions for closed sockets; this can trigger a
        // reconnect to already-deleted objects and backend 404 connect traces.
        return;
      }
      hasQueuedNotificationByKey[key] = normalizedAction;
    }
    function scheduleReconnect(objectType, objectId) {
      var key = toKey(objectType, objectId);
      if (reconnectTimersByKey[key]) return;
      if (!shouldTrackSocket(objectType, objectId)) return;
      var currentDelay = reconnectDelayByKey[key] || 1000;
      reconnectTimersByKey[key] = window.setTimeout(function () {
        if (!shouldTrackSocket(objectType, objectId)) {
          reconnectTimersByKey[key] = null;
          closeSocketByKey(key);
          return;
        }
        reconnectTimersByKey[key] = null;
        reconnectDelayByKey[key] = Math.min(currentDelay * 2, maxReconnectDelayMs);
        connectSocket(objectType, objectId);
      }, currentDelay);
    }
    function connectSocket(objectType, objectId) {
      if (!objectId || !shouldTrackSocket(objectType, objectId)) return;
      var key = toKey(objectType, objectId);
      var existing = socketsByKey[key];
      if (existing && (existing.readyState === WebSocket.OPEN || existing.readyState === WebSocket.CONNECTING)) {
        return;
      }

      var socket;
      try {
        socket = new WebSocket(getWebSocketUrl(objectType, objectId));
      } catch (e) {
        scheduleReconnect(objectType, objectId);
        return;
      }
      socketsByKey[key] = socket;

      socket.addEventListener("open", function () {
        reconnectDelayByKey[key] = 1000;
        if (hasQueuedNotificationByKey[key]) {
          var queuedAction = hasQueuedNotificationByKey[key];
          hasQueuedNotificationByKey[key] = false;
          queueOrSendNotification(objectType, objectId, queuedAction);
        }
      });

      function syncDashboardEmptyState() {
        var dashboard = document.querySelector(".Dashboard");
        var groupsList = document.querySelector(".Dashboard-groups");
        if (!dashboard || !groupsList) return;
        var hasGroups = groupsList.querySelectorAll(".Dashboard-group").length > 0;
        dashboard.classList.toggle("Dashboard--hasGroups", hasGroups);
        groupsList.classList.toggle("Dashboard-groups--empty", !hasGroups);
      }
      function closeEditTaskPopupIfDeleted(taskId) {
        if (!taskId) return;
        var popup = document.getElementById("edit-task-popup");
        if (!popup || popup.hasAttribute("hidden")) return;
        var editTaskForm = document.getElementById("edit-task-form");
        if (!editTaskForm) return;
        var dataUrl = editTaskForm.getAttribute("data-url") || "";
        var match = dataUrl.match(/^\/task\/edit\/([^/]+)\/$/);
        if (!match || String(match[1]) !== String(taskId)) return;
        if (typeof window.closePopup === "function") {
          window.closePopup(popup);
        } else {
          popup.setAttribute("hidden", "");
        }
      }
      function removeTaskFromFrontend(taskId) {
        if (!taskId) return;
        var safeTaskId = safeStringId(taskId);
        var taskCard = document.querySelector('.Dashboard-task[data-task-id="' + safeTaskId + '"]');
        if (taskCard && taskCard.parentNode) taskCard.parentNode.removeChild(taskCard);
        ["comments", "attachments", "assignments", "reminders"].forEach(function (prefix) {
          var script = document.getElementById(prefix + "-" + taskId);
          if (script && script.parentNode) script.parentNode.removeChild(script);
        });
        closeEditTaskPopupIfDeleted(taskId);
      }
      function removeGroupFromFrontend(groupId) {
        if (!groupId) return;
        var groupEl = document.getElementById("group-" + groupId);
        if (groupEl && groupEl.parentNode) {
          groupEl.querySelectorAll(".Dashboard-task[data-task-id]").forEach(function (taskEl) {
            var taskId = String(taskEl.getAttribute("data-task-id") || "");
            if (!taskId) return;
            closeSocketByKey(toKey("task", taskId));
            removeTaskFromFrontend(taskId);
          });
          groupEl.parentNode.removeChild(groupEl);
        }
        syncDashboardEmptyState();
      }
      function removeProjectFromFrontend(projectIdToRemove) {
        if (!projectIdToRemove) return;
        var isCurrentDashboardProject = String(projectIdToRemove) === String(projectId);
        var projectItem = document.querySelector(
          '.Base-project-item[data-project-id="' + safeStringId(projectIdToRemove) + '"]'
        );
        var projectsPanel = projectItem ? projectItem.closest(".Base-workspaces-panel") : null;
        var projectsList = projectItem ? projectItem.closest(".Base-projects-list") : null;
        if (projectItem && projectItem.parentNode) {
          projectItem.parentNode.removeChild(projectItem);
        }
        if (projectsPanel && projectsList && projectsList.querySelectorAll(".Base-project-item").length === 0) {
          projectsPanel.classList.add("Base-workspaces-panel--empty");
        }
        if (!isCurrentDashboardProject) return;

        var nextProjectLink = document.querySelector(".Base-project-item .Base-project-link[href]");
        if (nextProjectLink && nextProjectLink.getAttribute("href")) {
          window.location.assign(nextProjectLink.getAttribute("href"));
          return;
        }
        var workspaceSettingsLink = document.querySelector('.Base-workspace-dropdown-item[href*="/workspace/settings/"]');
        if (workspaceSettingsLink && workspaceSettingsLink.getAttribute("href")) {
          window.location.assign(workspaceSettingsLink.getAttribute("href"));
          return;
        }
        var accountLink =
          document.querySelector(".Base-account-link--expanded-link[href]") ||
          document.querySelector(".Base-account-link--collapsed[href]");
        if (accountLink && accountLink.getAttribute("href")) {
          window.location.assign(accountLink.getAttribute("href"));
          return;
        }
        window.location.assign("/");
      }
      function removeDeletedObject(objectTypeToDelete, objectIdToDelete) {
        if (!objectIdToDelete) return;
        if (objectTypeToDelete === "task") {
          removeTaskFromFrontend(objectIdToDelete);
          closeSocketByKey(toKey("task", objectIdToDelete));
          return;
        }
        if (objectTypeToDelete === "group") {
          removeGroupFromFrontend(objectIdToDelete);
          closeSocketByKey(toKey("group", objectIdToDelete));
          reconcileObjectSockets();
          return;
        }
        if (objectTypeToDelete === "project") {
          closeSocketByKey(toKey("project", objectIdToDelete));
          removeProjectFromFrontend(objectIdToDelete);
        }
      }
      socket.addEventListener("message", function (event) {
        var data = null;
        try {
          data = JSON.parse(event.data);
        } catch (e) {
          return;
        }
        if (!data || data.object_type !== objectType) return;
        var messageObjectId = data.object_id != null ? String(data.object_id) : String(objectId);
        var messageAction = normalizeAction(data.action);
        if ((pendingOwnNotificationsByKey[key] || 0) > 0) {
          pendingOwnNotificationsByKey[key] -= 1;
        }
        if (messageAction === "create" && objectType === "project") {
          // Project creation affects sidebar project lists across workspaces.
          // We currently do not receive enough websocket payload to inject the
          // new item safely, so refresh to keep UI in sync.
          window.location.reload();
          return;
        }
        if (messageAction === "create" && (objectType === "group" || objectType === "task")) {
          // Group/task create payloads currently do not include enough nested
          // data to build and insert fresh task cards/group columns reliably.
          // Refresh keeps cross-user dashboard state correct.
          window.location.reload();
          return;
        }
        if (messageAction === "delete") {
          removeDeletedObject(objectType, messageObjectId);
          return;
        }
        fetchAndApplyObjectData(objectType, messageObjectId);
      });

      socket.addEventListener("close", function () {
        scheduleReconnect(objectType, objectId);
      });

      socket.addEventListener("error", function () {
        try {
          socket.close();
        } catch (e) {}
      });
    }
    function closeSocketByKey(key) {
      var socket = socketsByKey[key];
      if (!socket) return;
      delete socketsByKey[key];
      if (reconnectTimersByKey[key]) {
        window.clearTimeout(reconnectTimersByKey[key]);
        reconnectTimersByKey[key] = null;
      }
      delete reconnectDelayByKey[key];
      delete pendingOwnNotificationsByKey[key];
      delete hasQueuedNotificationByKey[key];
      delete isFetchingByKey[key];
      try {
        socket.close();
      } catch (e) {}
    }
    function getGroupIdsFromDom() {
      var ids = {};
      document.querySelectorAll(".Dashboard-groupHeader[data-group-id]").forEach(function (el) {
        var id = String(el.getAttribute("data-group-id") || "");
        if (id) ids[id] = true;
      });
      return Object.keys(ids);
    }
    function getTaskIdsFromDom() {
      var ids = {};
      document.querySelectorAll(".Dashboard-task[data-task-id]").forEach(function (el) {
        var id = String(el.getAttribute("data-task-id") || "");
        if (id) ids[id] = true;
      });
      return Object.keys(ids);
    }
    function reconcileSocketsForType(objectType, wantedIds) {
      var wanted = {};
      (wantedIds || []).forEach(function (id) {
        if (!id) return;
        wanted[id] = true;
        connectSocket(objectType, id);
      });
      getKeysForType(objectType).forEach(function (key) {
        var objectId = getObjectIdFromKey(key);
        if (!wanted[objectId]) closeSocketByKey(key);
      });
    }
    function reconcileObjectSockets() {
      reconcileSocketsForType("group", getGroupIdsFromDom());
      reconcileSocketsForType("task", getTaskIdsFromDom());
    }
    function installDomSocketObserver() {
      if (domObserver || !dashboardEl || typeof MutationObserver !== "function") return;
      domObserver = new MutationObserver(function () {
        reconcileObjectSockets();
      });
      domObserver.observe(dashboardEl, { childList: true, subtree: true });
    }
    function inferCurrentPopupTaskId() {
      var editTaskForm = document.getElementById("edit-task-form");
      if (!editTaskForm) return "";
      var dataUrl = editTaskForm.getAttribute("data-url") || "";
      var match = dataUrl.match(/^\/task\/edit\/([^/]+)\/$/);
      return match ? match[1] : "";
    }
    function inferMutationAction(pathname) {
      if (!pathname) return "edit";
      // Treat nested task additions as edits on the existing task object.
      // Marking them as "create" triggers the task-create reload path.
      if (
        /^\/task\/(?:attachment|comment|reminder|assigned)\/add\/[^/]+\//.test(pathname)
      ) {
        return "edit";
      }
      if (pathname.indexOf("/create-new/") !== -1) return "create";
      if (pathname.indexOf("/duplicate/") !== -1) return "create";
      if (pathname.indexOf("/add/") !== -1) return "create";
      if (pathname.indexOf("/delete/") !== -1) return "delete";
      return "edit";
    }
    function getMutationTargets(pathname, method) {
      var targets = [];
      if (!pathname || method === "GET" || method === "HEAD") return targets;
      var action = inferMutationAction(pathname);

      if (pathname.indexOf("/project/") === 0) {
        targets.push({ type: "project", id: projectId, action: action });
        return targets;
      }
      if (pathname.indexOf("/group/") === 0) {
        var projectActionForGroupMutation = action;
        if (/^\/group\/create-new\/[^/]+\//.test(pathname)) {
          // New group should refresh other users' boards (new column appears).
          // Reuse project "create" handling to trigger a safe reload.
          projectActionForGroupMutation = "create";
        } else {
          // Group edit/delete/duplicate mutate board content but do not create
          // or delete the project object itself.
          projectActionForGroupMutation = "edit";
        }
        targets.push({ type: "project", id: projectId, action: projectActionForGroupMutation });
        var groupMatch = pathname.match(/^\/group\/(?:edit|delete|duplicate)\/([^/]+)\//);
        if (groupMatch && groupMatch[1]) {
          targets.push({ type: "group", id: groupMatch[1], action: action });
        }
        return targets;
      }
      if (pathname.indexOf("/task/") === 0) {
        // Task mutations affect project data transitively, but project object
        // action should stay as edit to avoid false project delete handling.
        targets.push({ type: "project", id: projectId, action: "edit" });
        var createTaskMatch = pathname.match(/^\/task\/create-new\/([^/]+)\//);
        if (createTaskMatch && createTaskMatch[1]) {
          targets.push({ type: "group", id: createTaskMatch[1], action: action });
        }
        var taskMatch = pathname.match(
          /^\/task\/(?:edit|delete|duplicate|attachment\/add|attachment\/delete|comment\/add|comment\/edit|comment\/delete|reminder\/add|reminder\/delete|assigned\/add|assigned\/delete)\/([^/]+)\//
        );
        if (taskMatch && taskMatch[1]) {
          targets.push({ type: "task", id: taskMatch[1], action: action });
        } else {
          var popupTaskId = inferCurrentPopupTaskId();
          if (popupTaskId) targets.push({ type: "task", id: popupTaskId, action: action });
        }
        return targets;
      }
      return targets;
    }
    function dedupeTargets(targets) {
      var seen = {};
      var out = [];
      (targets || []).forEach(function (target) {
        if (!target || !target.type || !target.id) return;
        var key = toKey(target.type, target.id) + ":" + normalizeAction(target.action);
        if (seen[key]) return;
        seen[key] = true;
        out.push(target);
      });
      return out;
    }
    function installMutationNotifier() {
      if (window.WebPlantProjectDashboardRealtimeSync && window.WebPlantProjectDashboardRealtimeSync.installed) return;
      var originalFetch = window.fetch;
      if (typeof originalFetch !== "function") return;

      window.fetch = function (input, init) {
        var method = (init && init.method ? init.method : (input && input.method ? input.method : "GET")) || "GET";
        method = String(method).toUpperCase();
        var pathname = parsePathname(input);
        var targets = getMutationTargets(pathname, method);

        return originalFetch.apply(this, arguments).then(function (response) {
          if (!targets.length || !response || !response.ok) return response;
          // Send websocket notifications as soon as the mutation succeeds.
          // Some popup flows reload the page quickly after success, so waiting
          // for response JSON parsing can miss the websocket send.
          dedupeTargets(targets).forEach(function (target) {
            queueOrSendNotification(target.type, target.id, target.action);
          });
          response
            .clone()
            .json()
            .then(function (data) {
              if (!data || data.status !== "success") return;
            })
            .catch(function () {
              // Ignore non-JSON responses.
            });
          return response;
        });
      };

      window.WebPlantProjectDashboardRealtimeSync = {
        installed: true,
        notifyChanged: function () {
          queueOrSendNotification("project", projectId, "edit");
        },
        notifyObjectChanged: function (objectType, objectId, action) {
          queueOrSendNotification(objectType, objectId, action || "edit");
        },
      };
    }
    function refreshVisibleData() {
      fetchAndApplyObjectData("project", projectId);
      getGroupIdsFromDom().forEach(function (groupId) {
        fetchAndApplyObjectData("group", groupId);
      });
      getTaskIdsFromDom().forEach(function (taskId) {
        fetchAndApplyObjectData("task", taskId);
      });
    }

    connectSocket("project", projectId);
    reconcileObjectSockets();
    installDomSocketObserver();
    installMutationNotifier();
    // Initial dashboard data is server-rendered in HTML using project relations
    // (project -> groups -> tasks -> task items). Avoid a duplicate fetch burst
    // on first paint; keep fetch refreshes for explicit sync moments only.
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) refreshVisibleData();
    });

    window.addEventListener("beforeunload", function () {
      Object.keys(socketsByKey).forEach(function (key) {
        closeSocketByKey(key);
      });
      if (domObserver) {
        try {
          domObserver.disconnect();
        } catch (e) {}
      }
    });
  }
  initProjectDashboardRealtimeSync();

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
