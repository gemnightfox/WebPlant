(function() {
  function getCookie(name) {
    var match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? match[2] : null;
  }

  var csrfToken = getCookie('csrftoken');

  // ── Add user form + invite row ──
  function isEmailInMemberList(email) {
    var normalized = email.trim().toLowerCase();

    // Preferred markup: dedicated element for email text (owner badge is separate).
    var members = document.querySelectorAll(
      '.WsSettings-memberList .WsSettings-member:not(.WsSettings-member--invite) .WsSettings-memberEmailValue'
    );
    if (members && members.length) {
      for (var i = 0; i < members.length; i++) {
        var text = (members[i].textContent || '').trim();
        if (text && text.toLowerCase() === normalized) return true;
      }
      return false;
    }

    // Fallback for older markup without the email-value span.
    members = document.querySelectorAll(
      '.WsSettings-memberList .WsSettings-member:not(.WsSettings-member--invite) .WsSettings-memberEmail'
    );
    for (var j = 0; j < members.length; j++) {
      // Read only direct text nodes to exclude child elements like the owner badge
      var directText = '';
      members[j].childNodes.forEach(function(node) {
        if (node.nodeType === Node.TEXT_NODE) directText += node.textContent;
      });
      if (directText.trim().toLowerCase() === normalized) return true;
    }
    return false;
  }

  function showAddUserError(errorEl, email) {
    if (!errorEl) return;
    errorEl.textContent = isEmailInMemberList(email)
      ? 'User has already been invited to the workspace.'
      : 'Given email is not registered to an account, or does not accept workspace invites.';
    errorEl.removeAttribute('hidden');
  }

  var form = document.getElementById('ws-add-user-form');
  if (form) {
    var inviteRow = document.getElementById('ws-invite-row');
    var inviteToggleBtn = document.getElementById('ws-show-invite-row');
    var emailInput = document.getElementById('id_add_user_email');

    if (inviteToggleBtn && inviteRow) {
      inviteToggleBtn.addEventListener('click', function() {
        var isHidden = inviteRow.hasAttribute('hidden');
        if (isHidden) {
          inviteRow.removeAttribute('hidden');
          if (emailInput) {
            emailInput.focus();
            if (typeof emailInput.select === 'function') {
              emailInput.select();
            }
          }
        } else {
          inviteRow.setAttribute('hidden', '');
        }
      });
    }

    if (emailInput) {
      emailInput.addEventListener('input', function() {
        var errorEl = form.querySelector('[data-role="add-user-error"]');
        if (errorEl) errorEl.setAttribute('hidden', '');
      });
    }

    form.addEventListener('submit', function(e) {
      e.preventDefault();
      var url = form.getAttribute('data-url-base');
      var errorEl = form.querySelector('[data-role="add-user-error"]');
      var email = emailInput ? emailInput.value : '';
      if (errorEl) errorEl.setAttribute('hidden', '');
      fetch(url, {
        method: 'POST',
        headers: { 'X-Requested-With': 'XMLHttpRequest', 'X-CSRFToken': csrfToken },
        body: new FormData(form)
      }).then(function(r) {
        if (!r.ok) {
          showAddUserError(errorEl, email);
          return;
        }
        return r.json().then(function(data) {
          if (data && data.status === 'success') {
            window.location.reload();
          } else {
            showAddUserError(errorEl, email);
          }
        }).catch(function() {
          showAddUserError(errorEl, email);
        });
      }).catch(function() {
        showAddUserError(errorEl, email);
      });
    });
  }

  // ── Admin-only: inline role changes for workspace members ──
  var wsRoot = document.querySelector('.WsSettings');
  var currentUserId = wsRoot ? wsRoot.getAttribute('data-current-user-id') : null;

  var memberList = document.querySelector('.WsSettings-memberList');
  var roleUpdateUrlBase = memberList ? memberList.getAttribute('data-role-update-url-base') : null;

  if (memberList && roleUpdateUrlBase) {
    var roleErrorEl = document.querySelector('[data-role="role-error"]');

    memberList.addEventListener('change', function(e) {
      var select = e.target;
      if (!(select && select.classList.contains('WsSettings-roleSelect'))) {
        return;
      }
      // Skip the invite form's role select (it has no data-prev-role-id)
      if (!select.hasAttribute('data-prev-role-id')) {
        return;
      }

      var previousRoleId = select.getAttribute('data-prev-role-id') || select.value;
      var previousRoleName = select.getAttribute('data-prev-role-name') || select.value;
      var newRoleId = select.value;
      var newOpt = select.options[select.selectedIndex];
      var newRoleName = newOpt
        ? newOpt.getAttribute('data-full-name') || newOpt.textContent || newOpt.text || newRoleId
        : newRoleId;
      var userLabel = select.getAttribute('data-user-label') || 'this member';

      var confirmed = window.confirm(
        'Change ' + userLabel + ' role from ' + previousRoleName + ' to ' + newRoleName + '?'
      );
      if (!confirmed) {
        select.value = previousRoleId;
        return;
      }

      var row = select.closest('.WsSettings-member');
      if (!row) return;

      var userId = row.getAttribute('data-user-id');
      if (!userId) return;

      if (roleErrorEl) {
        roleErrorEl.setAttribute('hidden', '');
      }

      var formData = new FormData();
      formData.append('role', select.value);

      fetch(roleUpdateUrlBase + userId + '/', {
        method: 'POST',
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
          'X-CSRFToken': csrfToken
        },
        body: formData
      }).then(function(r) {
        if (!r.ok) {
          select.value = previousRoleId;
          if (roleErrorEl) roleErrorEl.removeAttribute('hidden');
          return;
        }
        return r.json().then(function(data) {
          if (!data || data.status !== 'success') {
            select.value = previousRoleId;
            if (roleErrorEl) roleErrorEl.removeAttribute('hidden');
          } else {
            select.setAttribute('data-prev-role-id', newRoleId);
            select.setAttribute('data-prev-role-name', newRoleName);

            if (currentUserId && userId === currentUserId) {
              window.location.reload();
            }
          }
        }).catch(function() {
          select.value = previousRoleId;
          if (roleErrorEl) roleErrorEl.removeAttribute('hidden');
        });
      }).catch(function() {
        select.value = previousRoleId;
        if (roleErrorEl) roleErrorEl.removeAttribute('hidden');
      });
    });
  }

  // ... more menu: toggle dropdown + remove user
  document.addEventListener('click', function(e) {
    var moreBtn = e.target.closest('.WsSettings-moreBtn');
    if (moreBtn) {
      var dropdown = moreBtn.nextElementSibling;
      var isHidden = dropdown.hasAttribute('hidden');
      document.querySelectorAll('.WsSettings-moreDropdown:not([hidden])').forEach(function(d) {
        d.setAttribute('hidden', '');
      });
      if (isHidden) dropdown.removeAttribute('hidden');
      return;
    }

    var removeBtn = e.target.closest('.WsSettings-removeUserBtn');
    if (removeBtn) {
      var userLabel = removeBtn.getAttribute('data-user-label');
      if (!window.confirm('Are you sure you want to remove ' + userLabel + ' from this workspace?')) return;
      var url = removeBtn.getAttribute('data-remove-url');
      fetch(url, {
        method: 'POST',
        headers: { 'X-Requested-With': 'XMLHttpRequest', 'X-CSRFToken': csrfToken }
      }).then(function(r) {
        if (!r.ok) {
          alert('Could not remove user. Please try again.');
          return;
        }
        return r.json().then(function(data) {
          if (data && data.status === 'success') {
            window.location.reload();
          } else {
            alert('Could not remove user.');
          }
        });
      }).catch(function() {
        alert('Could not remove user. Please try again.');
      });
      return;
    }

    if (!e.target.closest('.WsSettings-moreMenu')) {
      document.querySelectorAll('.WsSettings-moreDropdown:not([hidden])').forEach(function(d) {
        d.setAttribute('hidden', '');
      });
    }
  });
})();
