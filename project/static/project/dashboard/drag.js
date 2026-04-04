/**
 * Mouse-based drag-and-drop for Kanban groups and tasks.
 * Uses mousedown/mousemove/mouseup instead of the HTML5 DnD API so that
 * the cursor can be fully controlled via CSS.
 * Saves new position to the backend via the edit endpoint after each drag.
 *
 * Supports:
 *   - Repositioning tasks within/across groups
 *   - Moving tasks to sidebar projects
 *   - Reordering groups horizontally
 */
(function () {
  var dragState = null;
  // { type: 'group'|'task', el, startX, startY, started,
  //   originalGroup, originalParent, originalNextSibling }

  var workspaceProjects = [];
  try {
    var dataEl = document.getElementById('workspace-projects-data');
    if (dataEl) workspaceProjects = JSON.parse(dataEl.textContent);
  } catch (e) {}

  var DRAG_THRESHOLD = 5; // px before drag is considered started

  // ---- DOM helpers ----

  /** Find the task list whose bounding box contains (x, y). */
  function getTaskListAtPoint(x, y) {
    var lists = document.querySelectorAll('.Dashboard-tasks');
    for (var i = 0; i < lists.length; i++) {
      var r = lists[i].getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return lists[i];
    }
    return null;
  }

  /** Return the task in `container` that the cursor is directly before (vertical). */
  function insertBeforeVertical(container, y) {
    var els = Array.from(container.querySelectorAll('.Dashboard-task')).filter(function (el) {
      return el !== dragState.el;
    });
    var best = null, bestOffset = Number.NEGATIVE_INFINITY;
    els.forEach(function (el) {
      var box = el.getBoundingClientRect();
      var offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > bestOffset) { bestOffset = offset; best = el; }
    });
    return best; // null = append
  }

  /** Return the group in `container` that the cursor is directly before (horizontal). */
  function insertBeforeHorizontal(container, x) {
    var els = Array.from(container.querySelectorAll('.Dashboard-group')).filter(function (el) {
      return el !== dragState.el;
    });
    var best = null, bestOffset = Number.NEGATIVE_INFINITY;
    els.forEach(function (el) {
      var box = el.getBoundingClientRect();
      var offset = x - box.left - box.width / 2;
      if (offset < 0 && offset > bestOffset) { bestOffset = offset; best = el; }
    });
    return best;
  }

  // ---- Position calculation ----

  /**
   * Compute the new position for `el` based on its current DOM neighbours.
   * `posAttr` is the data attribute name holding each sibling's position value.
   * Skips siblings that don't have the attribute (e.g. Dashboard-newGroupPlaceholder).
   * Rules:
   *   - Only item  → 0
   *   - First item → nextPos - 1
   *   - Last item  → prevPos + 1
   *   - Middle     → (prevPos + nextPos) / 2
   */
  function computePosition(el, posAttr) {
    var prev = el.previousElementSibling;
    var next = el.nextElementSibling;

    while (prev && !prev.hasAttribute(posAttr)) prev = prev.previousElementSibling;
    while (next && !next.hasAttribute(posAttr)) next = next.nextElementSibling;

    var prevPos = prev ? parseFloat(prev.getAttribute(posAttr)) : null;
    var nextPos = next ? parseFloat(next.getAttribute(posAttr)) : null;

    if (prevPos === null && nextPos === null) return 0;
    if (prevPos === null) return nextPos - 1;
    if (nextPos === null) return prevPos + 1;
    return (prevPos + nextPos) / 2;
  }

  /** Return the sidebar project item under (x, y), or null. Includes the current project. */
  function getSidebarProjectAtPoint(x, y) {
    var items = document.querySelectorAll('.Base-project-item');
    for (var i = 0; i < items.length; i++) {
      var r = items[i].getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return items[i];
    }
    return null;
  }

  function getCurrentProjectId() {
    return (document.querySelector('.Dashboard') || {dataset: {}}).dataset.dashboardPath;
  }

  function revertElement(el, originalParent, originalNextSibling) {
    if (originalNextSibling && originalNextSibling.parentNode === originalParent) {
      originalParent.insertBefore(el, originalNextSibling);
    } else {
      originalParent.appendChild(el);
    }
  }

  function clearDropTargets() {
    document.querySelectorAll('.Base-project-item.DnD-dropTarget').forEach(function (el) {
      el.classList.remove('DnD-dropTarget');
    });
  }

  /** Collect all task positions in a group, excluding `excludeEl`. */
  function getGroupTaskPositions(groupEl, excludeEl) {
    var positions = new Set();
    var els = groupEl.querySelectorAll('[data-task-position]');
    els.forEach(function (el) {
      if (el === excludeEl) return;
      var p = parseFloat(el.getAttribute('data-task-position'));
      if (!isNaN(p)) positions.add(p);
    });
    return positions;
  }

  /**
   * If `computed` already exists in `allPositions`, return max + 1 instead.
   */
  function resolvePosition(computed, allPositions) {
    if (!allPositions.has(computed)) return computed;
    var max = computed;
    allPositions.forEach(function (p) { if (p > max) max = p; });
    return max + 1;
  }

  // ---- Backend save ----

  function getCsrfToken() {
    var input = document.querySelector('input[name="csrfmiddlewaretoken"]');
    if (input) return input.value;
    var match = document.cookie.match(/csrftoken=([^;]+)/);
    return match ? match[1] : '';
  }

  function postEdit(url, formData) {
    fetch(url, {
      method: 'POST',
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRFToken': getCsrfToken(),
      },
      body: formData,
    });
  }

  function saveTaskPosition(taskEl) {
    var groupEl = taskEl.closest('.Dashboard-group');
    var position = computePosition(taskEl, 'data-task-position');
    if (groupEl) {
      position = resolvePosition(position, getGroupTaskPositions(groupEl, taskEl));
    }
    taskEl.setAttribute('data-task-position', position);

    var checkbox = taskEl.querySelector('.Dashboard-taskCheckbox');
    var taskId = checkbox ? checkbox.getAttribute('data-task-id') : null;
    if (!taskId) return;

    var groupId = groupEl ? groupEl.id.replace('group-', '') : null;

    var formData = new FormData();
    formData.append('name', taskEl.querySelector('.Dashboard-taskName').textContent.trim());
    formData.append('is_completed', taskEl.classList.contains('Dashboard-task--completed') ? 'on' : '');
    formData.append('position', position);
    if (groupId) formData.append('group', groupId);
    postEdit('/task/edit/' + taskId + '/', formData);
  }

  function saveTaskToNewGroup(taskEl, newGroupEl) {
    var position = computePosition(taskEl, 'data-task-position');
    position = resolvePosition(position, getGroupTaskPositions(newGroupEl, taskEl));
    taskEl.setAttribute('data-task-position', position);

    var checkbox = taskEl.querySelector('.Dashboard-taskCheckbox');
    var taskId = checkbox ? checkbox.getAttribute('data-task-id') : null;
    if (!taskId) return;

    var newGroupId = newGroupEl.id.replace('group-', '');
    if (!newGroupId) return;

    var formData = new FormData();
    formData.append('name', taskEl.querySelector('.Dashboard-taskName').textContent.trim());
    formData.append('is_completed', taskEl.classList.contains('Dashboard-task--completed') ? 'on' : '');
    formData.append('group', newGroupId);
    formData.append('position', position);
    postEdit('/task/edit/' + taskId + '/', formData);
  }

  function saveGroupPosition(groupEl) {
    var position = computePosition(groupEl, 'data-group-position');
    groupEl.setAttribute('data-group-position', position);

    var groupId = groupEl.id.replace('group-', '');
    if (!groupId) return;

    var projectId = (document.querySelector('.Dashboard') || {dataset: {}}).dataset.dashboardPath;

    var formData = new FormData();
    formData.append('name', groupEl.querySelector('.Dashboard-groupName').textContent.trim());
    formData.append('position', position);
    if (projectId) formData.append('project', projectId);
    postEdit('/group/edit/' + groupId + '/', formData);
  }

  function moveGroupToProject(groupEl, targetProjectId) {
    var groupId = groupEl.id.replace('group-', '');
    if (!groupId) return;

    var formData = new FormData();
    formData.append('name', groupEl.querySelector('.Dashboard-groupName').textContent.trim());
    formData.append('project', targetProjectId);
    formData.append('position', Date.now());

    fetch('/group/edit/' + groupId + '/', {
      method: 'POST',
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRFToken': getCsrfToken(),
      },
      body: formData,
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data && data.status === 'success') window.location.reload();
      });
  }

  function handleTaskDropOnProject(taskEl, targetProjectId) {
    var taskId = taskEl.getAttribute('data-task-id');
    var taskName = taskEl.querySelector('.Dashboard-taskName').textContent.trim();
    var isCompleted = taskEl.classList.contains('Dashboard-task--completed');

    var targetProject = null;
    for (var i = 0; i < workspaceProjects.length; i++) {
      if (workspaceProjects[i].id === targetProjectId) { targetProject = workspaceProjects[i]; break; }
    }
    var groups = targetProject ? targetProject.groups : [];

    var targetGroup = null;
    for (var j = 0; j < groups.length; j++) {
      if (groups[j].name === '(No assigned group)') { targetGroup = groups[j]; break; }
    }

    // Front position = min of all other groups' positions minus 1, or 0 if no others
    var otherGroups = targetGroup ? groups.filter(function (g) { return g.id !== targetGroup.id; }) : groups;
    var frontPos = 0;
    if (otherGroups.length > 0) {
      frontPos = otherGroups.reduce(function (min, g) { return g.position < min ? g.position : min; }, otherGroups[0].position) - 1;
    }

    if (targetGroup) {
      moveTaskToGroup(taskId, taskName, isCompleted, targetGroup.id, targetGroup.name, targetProjectId, frontPos);
    } else {
      createGroupThenMoveTask(taskId, taskName, isCompleted, targetProjectId, frontPos);
    }
  }

  function moveTaskToGroup(taskId, taskName, isCompleted, groupId, groupName, projectId, frontPos) {
    var fd = new FormData();
    fd.append('name', taskName);
    fd.append('is_completed', isCompleted ? 'on' : '');
    fd.append('group', groupId);
    fd.append('position', Date.now());

    fetch('/task/edit/' + taskId + '/', {
      method: 'POST',
      headers: { 'X-Requested-With': 'XMLHttpRequest', 'X-CSRFToken': getCsrfToken() },
      body: fd,
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data && data.status !== 'success') return;
        var fd2 = new FormData();
        fd2.append('name', groupName);
        fd2.append('project', projectId);
        fd2.append('position', frontPos);
        fetch('/group/edit/' + groupId + '/', {
          method: 'POST',
          headers: { 'X-Requested-With': 'XMLHttpRequest', 'X-CSRFToken': getCsrfToken() },
          body: fd2,
        }).then(function () { window.location.reload(); });
      });
  }

  function createGroupThenMoveTask(taskId, taskName, isCompleted, projectId, frontPos) {
    var fd = new FormData();
    fd.append('name', '(No assigned group)');
    fd.append('position', frontPos);

    fetch('/group/create-new/' + projectId + '/', {
      method: 'POST',
      headers: { 'X-Requested-With': 'XMLHttpRequest', 'X-CSRFToken': getCsrfToken() },
      body: fd,
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data || data.status !== 'success' || !data.id) return;
        moveTaskToGroup(taskId, taskName, isCompleted, data.id, '(No assigned group)', projectId, frontPos);
      });
  }

  // ---- Mouse events (delegated on document) ----

  document.addEventListener('mousedown', function (e) {
    if (e.button !== 0) return;

    // Task drag — anywhere on the card except interactive elements
    var taskEl = e.target.closest('.Dashboard-task');
    if (taskEl && !e.target.closest('button, input, a')) {
      dragState = {
        type: 'task',
        el: taskEl,
        startX: e.clientX,
        startY: e.clientY,
        started: false,
        originalGroup: taskEl.closest('.Dashboard-group'),
        originalParent: taskEl.parentNode,
        originalNextSibling: taskEl.nextSibling,
      };
      return;
    }

    // Group drag — header only, not from buttons or task cards, not while editing
    var groupEl = e.target.closest('.Dashboard-group');
    if (groupEl && e.target.closest('.Dashboard-groupHeader') && !e.target.closest('button, input, a, .Dashboard-task, .Dashboard-groupName')) {
      dragState = {
        type: 'group',
        el: groupEl,
        startX: e.clientX,
        startY: e.clientY,
        started: false,
        originalParent: groupEl.parentNode,
        originalNextSibling: groupEl.nextSibling,
      };
      return;
    }
  });

  document.addEventListener('mousemove', function (e) {
    if (!dragState) return;

    // Activate drag once cursor has moved past threshold
    if (!dragState.started) {
      var dx = e.clientX - dragState.startX;
      var dy = e.clientY - dragState.startY;
      if (Math.sqrt(dx * dx + dy * dy) < DRAG_THRESHOLD) return;
      dragState.started = true;
      dragState.el.classList.add('DnD-dragging');
      document.documentElement.classList.add('DnD-isDragging');
    }

    if (dragState.type === 'task') {
      var sidebarTarget = getSidebarProjectAtPoint(e.clientX, e.clientY);
      clearDropTargets();

      if (sidebarTarget && sidebarTarget.getAttribute('data-project-id') !== getCurrentProjectId()) {
        sidebarTarget.classList.add('DnD-dropTarget');
        revertElement(dragState.el, dragState.originalParent, dragState.originalNextSibling);
        return;
      }

      if (!sidebarTarget) {
        var taskList = getTaskListAtPoint(e.clientX, e.clientY);
        if (!taskList) return;
        var beforeEl = insertBeforeVertical(taskList, e.clientY);
        if (beforeEl == null) {
          taskList.appendChild(dragState.el);
        } else {
          taskList.insertBefore(dragState.el, beforeEl);
        }
      }

    } else {
      // Group drag
      var sidebarTarget = getSidebarProjectAtPoint(e.clientX, e.clientY);
      clearDropTargets();
      if (sidebarTarget && sidebarTarget.getAttribute('data-project-id') !== getCurrentProjectId()) {
        sidebarTarget.classList.add('DnD-dropTarget');
        revertElement(dragState.el, dragState.originalParent, dragState.originalNextSibling);
      } else if (!sidebarTarget) {
        var groupsList = document.querySelector('.Dashboard-groups');
        if (!groupsList) return;
        var newGroupBtn = groupsList.querySelector('.Dashboard-newGroupPlaceholder');
        var beforeEl = insertBeforeHorizontal(groupsList, e.clientX);
        if (beforeEl == null) {
          groupsList.insertBefore(dragState.el, newGroupBtn);
        } else {
          groupsList.insertBefore(dragState.el, beforeEl);
        }
      }
    }
  });

  document.addEventListener('mouseup', function () {
    if (!dragState) return;

    if (dragState.started) {
      dragState.el.classList.remove('DnD-dragging');
      document.documentElement.classList.remove('DnD-isDragging');

      if (dragState.type === 'task') {
        var droppedOnProject = document.querySelector('.Base-project-item.DnD-dropTarget');
        clearDropTargets();

        if (droppedOnProject) {
          if (droppedOnProject.getAttribute('data-project-id') === getCurrentProjectId()) {
            revertElement(dragState.el, dragState.originalParent, dragState.originalNextSibling);
          } else {
            handleTaskDropOnProject(dragState.el, droppedOnProject.getAttribute('data-project-id'));
          }
        } else {
          var currentGroup = dragState.el.closest('.Dashboard-group');
          if (currentGroup === dragState.originalGroup) {
            saveTaskPosition(dragState.el);
          } else if (currentGroup) {
            saveTaskToNewGroup(dragState.el, currentGroup);
          }
        }

      } else {
        // Group drag
        var droppedOnProject = document.querySelector('.Base-project-item.DnD-dropTarget');
        clearDropTargets();
        if (droppedOnProject) {
          if (droppedOnProject.getAttribute('data-project-id') === getCurrentProjectId()) {
            revertElement(dragState.el, dragState.originalParent, dragState.originalNextSibling);
          } else {
            moveGroupToProject(dragState.el, droppedOnProject.getAttribute('data-project-id'));
          }
        } else {
          saveGroupPosition(dragState.el);
        }
      }
    }

    dragState = null;
  });

  // mousedown is delegated so no per-element init or MutationObserver needed.
})();
