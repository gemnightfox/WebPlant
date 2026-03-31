/**
 * Edit group popup. Opens on group header click; readonly input with inline Edit button.
 */
(function () {
  function getCsrfToken() {
    var input = document.querySelector('input[name="csrfmiddlewaretoken"]');
    if (input) return input.value;
    var match = document.cookie.match(/csrftoken=([^;]+)/);
    return match ? match[1] : "";
  }

  var currentGroupId = null;

  function resetEditState() {
    var nameInput = document.getElementById("id_edit_group_name");
    if (nameInput) {
      nameInput.setAttribute("readonly", "");
      nameInput.classList.remove("is-editing");
    }
    var editBtn = document.getElementById("edit-group-edit-btn");
    if (editBtn) editBtn.removeAttribute("hidden");
    var saveBtn = document.getElementById("edit-group-save-btn");
    if (saveBtn) saveBtn.setAttribute("hidden", "");
  }

  function prepare(header) {
    currentGroupId = header.getAttribute("data-group-id");
    var name = header.getAttribute("data-group-name") || "";
    var title = document.getElementById("edit-group-popup-title");
    if (title) title.textContent = name;

    // Use defaultValue so form.reset() (called by openPopup) restores to the correct values.
    var nameInput = document.getElementById("id_edit_group_name");
    if (nameInput) nameInput.defaultValue = header.getAttribute("data-group-name") || "";
    var posInput = document.getElementById("edit-group-position-input");
    if (posInput) posInput.defaultValue = header.getAttribute("data-group-position") || "0";

    var form = document.getElementById("edit-group-form");
    if (form) form.setAttribute("data-url", "/group/edit/" + currentGroupId + "/");

    var projectInput = document.getElementById("edit-group-project-input");
    if (projectInput) {
      var dashboard = document.querySelector(".Dashboard");
      projectInput.value = dashboard ? dashboard.dataset.dashboardPath : "";
    }

    resetEditState();
  }

  function init() {
    document.body.addEventListener("click", function (e) {
      if (e.target.closest(".Dashboard-menuWrapper")) return;
      var header = e.target.closest(".Dashboard-groupHeader");
      if (!header) return;
      prepare(header);
      window.openPopup("edit-group-popup");
    });

    var editBtn = document.getElementById("edit-group-edit-btn");
    if (editBtn) {
      editBtn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        var nameInput = document.getElementById("id_edit_group_name");
        if (nameInput) {
          nameInput.removeAttribute("readonly");
          nameInput.classList.add("is-editing");
          nameInput.focus();
        }
        editBtn.setAttribute("hidden", "");
        var saveBtn = document.getElementById("edit-group-save-btn");
        if (saveBtn) saveBtn.removeAttribute("hidden");
      });
    }

    var deleteBtn = document.getElementById("edit-group-delete-btn");
    if (deleteBtn) {
      deleteBtn.addEventListener("click", function () {
        if (!currentGroupId) return;
        if (!confirm("Delete this group and all its tasks?")) return;
        var popup = document.getElementById("edit-group-popup");
        if (popup) window.closePopup(popup);
        fetch("/group/delete/" + currentGroupId + "/", {
          method: "POST",
          headers: {
            "X-Requested-With": "XMLHttpRequest",
            "X-CSRFToken": getCsrfToken(),
          },
        })
          .then(function (r) { return r.json(); })
          .then(function (data) {
            if (data && data.status === "success") {
              window.location.reload();
            } else {
              alert("Could not delete. Please try again.");
            }
          })
          .catch(function () {
            alert("Something went wrong. Please try again.");
          });
      });
    }

    var popup = document.getElementById("edit-group-popup");
    if (popup) {
      var backdrop = popup.querySelector(".Popup-backdrop");
      if (backdrop) backdrop.addEventListener("click", function () { window.closePopup(popup); });
    }

    if (typeof window.initPopupForm === "function") {
      window.initPopupForm("edit-group-form", "edit-group-error");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
