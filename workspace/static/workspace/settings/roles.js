(function() {
  function getCookie(name) {
    var match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? match[2] : null;
  }
  var csrfToken = getCookie('csrftoken');

  var defaultRoleForm = document.getElementById('ws-default-role-form');
  var defaultRoleSelect = document.getElementById('id_default_role');
  if (defaultRoleForm && defaultRoleSelect) {
    var prevRoleValue = defaultRoleSelect.value;
    defaultRoleSelect.addEventListener('change', function() {
      var newRoleName = defaultRoleSelect.options[defaultRoleSelect.selectedIndex].text;
      if (!window.confirm('Change default role to "' + newRoleName + '"?')) { defaultRoleSelect.value = prevRoleValue; return; }
      var url = defaultRoleForm.getAttribute('data-url');
      var errorEl = defaultRoleForm.querySelector('[data-role="default-role-error"]');
      if (errorEl) errorEl.setAttribute('hidden', '');
      fetch(url, { method: 'POST', headers: { 'X-Requested-With': 'XMLHttpRequest', 'X-CSRFToken': csrfToken }, body: new FormData(defaultRoleForm) })
        .then(function(r) {
          if (!r.ok) { defaultRoleSelect.value = prevRoleValue; if (errorEl) errorEl.removeAttribute('hidden'); return; }
          return r.json().then(function(data) {
            if (data && data.status === 'success') {
              prevRoleValue = defaultRoleSelect.value;
              var inviteRoleSelect = document.getElementById('id_add_user_role');
              if (inviteRoleSelect) inviteRoleSelect.value = defaultRoleSelect.value;
            } else { defaultRoleSelect.value = prevRoleValue; if (errorEl) errorEl.removeAttribute('hidden'); }
          }).catch(function() { defaultRoleSelect.value = prevRoleValue; if (errorEl) errorEl.removeAttribute('hidden'); });
        })
        .catch(function() { defaultRoleSelect.value = prevRoleValue; if (errorEl) errorEl.removeAttribute('hidden'); });
    });
  }

  var transferForm = document.getElementById('ws-transfer-role-form');
  var transferSelect = document.getElementById('ws-transfer-role-select');
  var transferFromName = document.getElementById('ws-transfer-role-from-name');
  window.popupPrepare = window.popupPrepare || {};
  window.popupPrepare['transfer-role-popup'] = function(trigger) {
    var oldRoleId = trigger ? trigger.getAttribute('data-role-id') : null;
    var roleName = trigger ? trigger.getAttribute('data-role-name') : '';
    if (transferForm) transferForm.setAttribute('data-old-role-id', oldRoleId || '');
    if (transferFromName) transferFromName.textContent = roleName;
    if (transferSelect) {
      for (var i = 0; i < transferSelect.options.length; i++) transferSelect.options[i].hidden = (transferSelect.options[i].value === oldRoleId);
      for (var j = 0; j < transferSelect.options.length; j++) if (!transferSelect.options[j].hidden) { transferSelect.value = transferSelect.options[j].value; break; }
    }
    var errorEl = transferForm ? transferForm.querySelector('[data-role="transfer-role-error"]') : null;
    if (errorEl) errorEl.setAttribute('hidden', '');
  };
  if (transferForm) {
    transferForm.addEventListener('submit', function(e) {
      e.preventDefault();
      var oldRoleId = transferForm.getAttribute('data-old-role-id');
      var newRoleId = transferSelect ? transferSelect.value : '';
      var urlBase = transferForm.getAttribute('data-url-base');
      if (!oldRoleId || !newRoleId || !urlBase) return;
      var fromName = transferFromName ? transferFromName.textContent : '';
      var toName = transferSelect && transferSelect.options[transferSelect.selectedIndex] ? transferSelect.options[transferSelect.selectedIndex].text : '';
      if (!window.confirm('Transfer all members from "' + fromName + '" to "' + toName + '"?\n\nThis cannot be undone.')) return;
      var url = urlBase + oldRoleId + '/' + newRoleId + '/';
      var errorEl = transferForm.querySelector('[data-role="transfer-role-error"]');
      if (errorEl) errorEl.setAttribute('hidden', '');
      fetch(url, { method: 'POST', headers: { 'X-Requested-With': 'XMLHttpRequest', 'X-CSRFToken': csrfToken }, body: new FormData(transferForm) })
        .then(function(r) { return r.json().then(function(data) { if (data && data.status === 'success') window.location.reload(); else if (errorEl) errorEl.removeAttribute('hidden'); }); })
        .catch(function() { if (errorEl) errorEl.removeAttribute('hidden'); });
    });
  }

  var editRoleNameEl = document.getElementById('ws-editing-role-name');
  var editRoleForms = document.querySelectorAll('.WsSettings-editRoleForm');
  function showFormForRole(roleId) {
    editRoleForms.forEach(function(form) { if (form.getAttribute('data-role-id') === roleId) form.removeAttribute('hidden'); else form.setAttribute('hidden', ''); });
  }
  window.popupPrepare['edit-role-popup'] = function(trigger) {
    var roleId = trigger ? trigger.getAttribute('data-role-id') : null;
    if (roleId) {
      var activeForm = document.querySelector('.WsSettings-editRoleForm[data-role-id="' + roleId + '"]');
      if (activeForm) {
        activeForm.reset();
        var nameInput = activeForm.querySelector('input[name="name"]');
        if (editRoleNameEl) editRoleNameEl.textContent = nameInput ? nameInput.value : '';
      }
      showFormForRole(roleId);
    } else {
      if (editRoleNameEl) editRoleNameEl.textContent = '';
      editRoleForms.forEach(function(f) { f.setAttribute('hidden', ''); });
    }
  };
  editRoleForms.forEach(function(form) {
    form.addEventListener('submit', function(e) {
      e.preventDefault();
      var url = form.getAttribute('data-url');
      var errorEl = form.querySelector('[data-role="edit-role-error"]');
      if (errorEl) errorEl.setAttribute('hidden', '');
      fetch(url, { method: 'POST', headers: { 'X-Requested-With': 'XMLHttpRequest', 'X-CSRFToken': csrfToken }, body: new FormData(form) })
        .then(function(r) {
          if (!r.ok) { if (errorEl) errorEl.removeAttribute('hidden'); return; }
          return r.json().then(function(data) { if (data && data.status === 'success') window.location.reload(); else if (errorEl) errorEl.removeAttribute('hidden'); })
            .catch(function() { if (errorEl) errorEl.removeAttribute('hidden'); });
        })
        .catch(function() { if (errorEl) errorEl.removeAttribute('hidden'); });
    });
  });

  var deleteRoleNameDefaultEl = document.getElementById('ws-delete-role-name-default');
  var deleteRoleNameMembersEl = document.getElementById('ws-delete-role-name-members');
  var deleteRoleMemberCountEl = document.getElementById('ws-delete-role-member-count');
  var deleteRoleMemberSuffixEl = document.getElementById('ws-delete-role-member-suffix');
  var deleteRoleBlockDefault = document.getElementById('ws-delete-role-block-default');
  var deleteRoleBlockMembers = document.getElementById('ws-delete-role-block-members');
  window.popupPrepare['delete-role-popup'] = function(trigger) {
    if (!trigger) return;
    var roleName = trigger.getAttribute('data-role-name');
    var memberCount = parseInt(trigger.getAttribute('data-member-count') || '0', 10);
    var isDefault = trigger.getAttribute('data-is-default-role') === 'true';
    if (deleteRoleNameDefaultEl) deleteRoleNameDefaultEl.textContent = roleName || '';
    if (deleteRoleNameMembersEl) deleteRoleNameMembersEl.textContent = roleName || '';
    if (deleteRoleMemberCountEl) deleteRoleMemberCountEl.textContent = memberCount;
    if (deleteRoleMemberSuffixEl) deleteRoleMemberSuffixEl.textContent = memberCount === 1 ? '' : 's';
    if (deleteRoleBlockDefault) deleteRoleBlockDefault.hidden = !isDefault;
    if (deleteRoleBlockMembers) deleteRoleBlockMembers.hidden = !(memberCount > 0);
  };
  /* Delegation: roles.js loads before popup.js (script in page body), so closePopup is not defined yet.
     Clicks happen after load, so we resolve closePopup at click time. */
  document.body.addEventListener('click', function(e) {
    if (!e.target.closest('#ws-delete-role-got-it')) return;
    var popup = document.getElementById('delete-role-popup');
    if (popup && typeof window.closePopup === 'function') window.closePopup(popup);
  });

  document.querySelectorAll('.WsSettings-deleteRoleBtn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var memberCount = parseInt(btn.getAttribute('data-member-count') || '0', 10);
      var isDefault = btn.getAttribute('data-is-default-role') === 'true';
      if (memberCount > 0 || isDefault) {
        if (typeof window.popupPrepare['delete-role-popup'] === 'function') window.popupPrepare['delete-role-popup'](btn);
        if (typeof window.openPopup === 'function') window.openPopup('delete-role-popup');
      } else {
        var roleName = btn.getAttribute('data-role-name');
        if (!window.confirm('Are you sure you want to delete the role "' + roleName + '"?')) return;
        var deleteUrl = btn.getAttribute('data-delete-url');
        fetch(deleteUrl, { method: 'POST', headers: { 'X-Requested-With': 'XMLHttpRequest', 'X-CSRFToken': csrfToken } })
          .then(function(r) { return r.json().then(function(data) { if (data && data.status === 'success') window.location.reload(); else alert('Could not delete role.'); }); })
          .catch(function() { alert('Could not delete role. Please try again.'); });
      }
    });
  });
})();
