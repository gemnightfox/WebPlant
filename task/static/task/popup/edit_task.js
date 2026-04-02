/**
 * Task app entrypoint for edit-task popup logic.
 * Reuses the existing dashboard implementation while relocating ownership to task app static.
 */
(function () {
  var src = "/static/project/dashboard/popup/edit_task.js";
  var existing = document.querySelector('script[data-task-edit-impl="1"]');
  if (existing) return;
  var s = document.createElement("script");
  s.src = src;
  s.defer = true;
  s.setAttribute("data-task-edit-impl", "1");
  document.head.appendChild(s);
})();
