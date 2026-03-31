/**
 * Account settings: theme toggle (light/dark) and account actions.
 * - Theme: POST to pick_light_mode / pick_dark_mode; update body class.
 * - Password button: label "Set up password" vs "Change password" from GET check_password_present.
 * - Email popup: AJAX submit to account_email; success message in popup.
 * - Reset password: confirm then POST reset; on success open reset-password-popup.
 */
(function() {
  var body = document.body;
  var themeToggle = document.querySelector('.AccSettings-themeToggle');
  var passwordButton = document.querySelector('[data-reset-password]');
  var settingsRoot = document.querySelector('.AccSettings');
  var notificationsAllowed = true;

  if (settingsRoot) {
    var flag = settingsRoot.getAttribute('data-notification-alert-allowed');
    if (flag === 'false') {
      notificationsAllowed = false;
    }
  }

  var workspaceInvitesToggle = document.querySelector('.AccSettings-workspaceInvitesToggle');
  var notificationsToggle = document.querySelector('.AccSettings-notificationsToggle');

  function setTheme(theme) {
    body.className = theme === 'dark' ? 'theme-dark' : 'theme-light';
  }

  function postPreferences(colorTheme, sendNotifications, workspaceInvites) {
    var url = settingsRoot ? settingsRoot.getAttribute('data-set-preferences-url') : '';
    if (!url) return Promise.reject('No URL');
    var csrf = document.querySelector('[name=csrfmiddlewaretoken]');
    var token = csrf ? csrf.value : '';
    var params = new URLSearchParams();
    params.append('color_theme', colorTheme);
    if (sendNotifications) params.append('send_notifications', 'on');
    if (workspaceInvites) params.append('workspace_invites', 'on');
    return fetch(url, {
      method: 'POST',
      headers: {
        'X-CSRFToken': token,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: params.toString(),
      credentials: 'same-origin'
    });
  }

  /* Theme toggle: POST all preferences with updated color_theme */
  if (themeToggle) {
    themeToggle.addEventListener('change', function() {
      var colorTheme = this.checked ? 'dark' : 'light';
      var sendNotifs = notificationsToggle ? notificationsToggle.checked : notificationsAllowed;
      var wsInvites = workspaceInvitesToggle ? workspaceInvitesToggle.checked : true;
      postPreferences(colorTheme, sendNotifs, wsInvites).then(function(r) {
        if (r.ok) setTheme(colorTheme);
      });
    });
  }

  /* Workspace invites toggle: POST all preferences with updated workspace_invites */
  if (workspaceInvitesToggle) {
    workspaceInvitesToggle.addEventListener('change', function() {
      var colorTheme = themeToggle ? (themeToggle.checked ? 'dark' : 'light') : 'dark';
      var sendNotifs = notificationsToggle ? notificationsToggle.checked : notificationsAllowed;
      var wsInvites = this.checked;
      var current = this;
      current.disabled = true;
      postPreferences(colorTheme, sendNotifs, wsInvites).then(function(r) {
        current.disabled = false;
        if (!r.ok) {
          current.checked = !current.checked;
          alert('Could not update workspace invites preference. Please try again.');
        }
      }).catch(function() {
        current.disabled = false;
        current.checked = !current.checked;
        alert('Could not update workspace invites preference. Please try again.');
      });
    });
  }

  /* Email notifications toggle: POST all preferences with updated send_notifications */
  if (notificationsToggle) {
    var initialAllowed = notificationsToggle.getAttribute('data-initial-allowed');
    if (initialAllowed === 'true') {
      notificationsAllowed = true;
    } else if (initialAllowed === 'false') {
      notificationsAllowed = false;
    }

    notificationsToggle.addEventListener('change', function() {
      var colorTheme = themeToggle ? (themeToggle.checked ? 'dark' : 'light') : 'dark';
      var sendNotifs = this.checked;
      var wsInvites = workspaceInvitesToggle ? workspaceInvitesToggle.checked : true;
      var current = this;
      current.disabled = true;
      postPreferences(colorTheme, sendNotifs, wsInvites).then(function(r) {
        current.disabled = false;
        if (r.ok) {
          notificationsAllowed = current.checked;
          if (settingsRoot) {
            settingsRoot.setAttribute('data-notification-alert-allowed', notificationsAllowed ? 'true' : 'false');
          }
        } else {
          current.checked = !current.checked;
          alert('Could not update notification preference. Please try again.');
        }
      }).catch(function() {
        current.disabled = false;
        current.checked = !current.checked;
        alert('Could not update notification preference. Please try again.');
      });
    });
  }

  /* Password button label: "Set up password" vs "Change password" from backend */
  if (passwordButton) {
    var checkPasswordUrl = passwordButton.getAttribute('data-check-password-url');
    if (checkPasswordUrl) {
      fetch(checkPasswordUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        },
        credentials: 'same-origin'
      }).then(function(r) {
        if (!r.ok) return null;
        return r.json();
      }).then(function(data) {
        if (!data || typeof data.is_password_present === 'undefined') return;
        // Store on the button so click handler can branch
        passwordButton.dataset.hasPassword = String(!!data.is_password_present);
        if (data.is_password_present === false) {
          passwordButton.textContent = 'Set up password';
        } else {
          passwordButton.textContent = 'Change password';
        }
      }).catch(function() {
        // If this fails, just leave the default label as-is
      });
    }
  }

  /* Email change popup: AJAX submit to account email endpoint */
  var emailPopup = document.getElementById('email-popup');
  if (emailPopup) {
    var form = emailPopup.querySelector('.Popup-form');
    var formWrap = emailPopup.querySelector('.Popup-formWrap');
    var successBlock = emailPopup.querySelector('.Popup-success');
    var accountEmailUrl = emailPopup.getAttribute('data-account-email-url') || '/account/email/';

    function showForm() {
      if (formWrap) formWrap.removeAttribute('hidden');
      if (successBlock) successBlock.setAttribute('hidden', '');
    }

    function showSuccess() {
      if (formWrap) formWrap.setAttribute('hidden', '');
      if (successBlock) successBlock.removeAttribute('hidden');
    }

    if (form) {
      form.addEventListener('submit', function(e) {
        e.preventDefault();
        if (!notificationsAllowed) {
          alert('Email notifications are turned off. Enable them in Preferences to receive email updates.');
          return;
        }
        var emailInput = form.querySelector('input[type="email"]');
        if (!emailInput) return;
        var val = (emailInput.value || '').trim();
        var emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!val) {
          emailInput.setCustomValidity('Please enter an email address.');
          form.reportValidity();
          emailInput.setCustomValidity('');
          return;
        }
        if (!emailRe.test(val)) {
          emailInput.setCustomValidity('Please enter a valid email address.');
          form.reportValidity();
          emailInput.setCustomValidity('');
          return;
        }

        var csrfEl = document.querySelector('[name=csrfmiddlewaretoken]');
        var csrf = csrfEl ? csrfEl.value : '';
        var body = new URLSearchParams();
        body.append('email', val);
        body.append('action_add', '1');
        if (csrf) body.append('csrfmiddlewaretoken', csrf);

        var submitBtn = form.querySelector('.Popup-submit');
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = 'Sending…';
        }

        fetch(accountEmailUrl, {
          method: 'POST',
          headers: {
            'X-CSRFToken': csrf,
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'text/html'
          },
          body: body.toString(),
          credentials: 'same-origin',
          redirect: 'manual'
        }).then(function(r) {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit';
          }
          if (r.type === 'opaqueredirect' || r.redirected || (r.status >= 200 && r.status < 300)) {
            showSuccess();
            return;
          }
          return r.text().then(function(html) {
            var msg = 'Something went wrong. Please try again.';
            if (html && html.indexOf('already') !== -1) msg = 'This email is already in use.';
            if (html && html.indexOf('invalid') !== -1) msg = 'Please enter a valid email address.';
            alert(msg);
          });
        }).catch(function() {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit';
          }
          alert('Something went wrong. Please try again.');
        });
      });
    }

    if (formWrap && successBlock) {
      formWrap.removeAttribute('hidden');
      successBlock.setAttribute('hidden', '');
    }
  }

  /* Reset password: confirm then POST; open success popup or redirect to set-password */
  document.body.addEventListener('click', function(e) {
    var resetBtn = e.target.closest('[data-reset-password]');
    if (resetBtn) {
      e.preventDefault();
      if (!notificationsAllowed) {
        alert('Email notifications are turned off. Enable them in Preferences to receive password reset emails.');
        return;
      }
      var hasPassword = resetBtn.dataset.hasPassword;
      if (hasPassword === 'false') {
        window.location.href = '/account/password/set/';
        return;
      }

      // Otherwise, keep existing reset-email behavior
      var email = (resetBtn.getAttribute('data-email') || '').trim();
      var url = resetBtn.getAttribute('data-reset-password-url') || '/account/password/reset/';
      if (!email) {
        alert('No email address available.');
        return;
      }
      var safeForConfirm = String(email).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/'/g, "\\'");
      var confirmed = window.confirm('Send a password reset link to ' + safeForConfirm + '?');
      if (!confirmed) {
        return;
      }
      var csrfEl = document.querySelector('[name=csrfmiddlewaretoken]');
      var csrf = csrfEl ? csrfEl.value : '';
      var body = new URLSearchParams();
      body.append('email', email);
      if (csrf) body.append('csrfmiddlewaretoken', csrf);
      var origText = resetBtn.textContent;
      resetBtn.disabled = true;
      resetBtn.textContent = 'Sending…';
      fetch(url, {
        method: 'POST',
        headers: {
          'X-CSRFToken': csrf,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'text/html'
        },
        body: body.toString(),
        credentials: 'same-origin',
        redirect: 'manual'
      }).then(function(r) {
        resetBtn.disabled = false;
        resetBtn.textContent = origText;
        if (r.type === 'opaqueredirect' || r.redirected || (r.status >= 200 && r.status < 300)) {
          window.openPopup('reset-password-popup');
          return;
        }
        return r.text().then(function(html) {
          var msg = 'Something went wrong. Please try again.';
          if (html && html.indexOf('invalid') !== -1) msg = 'Please use a valid email address.';
          alert(msg);
        });
      }).catch(function() {
        resetBtn.disabled = false;
        resetBtn.textContent = origText;
        alert('Something went wrong. Please try again.');
      });
      return;
    }
  });

  // Ensure only one of "disable" or "remove" rows is visible at any time
  var tempDisabledRow = document.getElementById('AccSettings-tempDisabledRow');
  var tempDisableRow = document.getElementById('AccSettings-tempDisableRow');
  if (tempDisabledRow && tempDisableRow) {
    // Hide the "Temporarily disable notifications" row while a timer is active
    tempDisableRow.setAttribute('hidden', '');
  }

  /* Remove temporarily disabled notifications: confirm then POST to remove-temp-disabled-notifications */
  var removeTempDisabledBtn = document.getElementById('AccSettings-removeTempDisabledBtn');
  if (removeTempDisabledBtn) {
    removeTempDisabledBtn.addEventListener('click', function() {
      if (!window.confirm('Remove temporary notification disable? Notifications will be enabled again.')) {
        return;
      }
      var url = removeTempDisabledBtn.getAttribute('data-remove-url');
      if (!url) return;
      var csrfEl = document.querySelector('[name=csrfmiddlewaretoken]');
      var csrf = csrfEl ? csrfEl.value : '';
      removeTempDisabledBtn.disabled = true;
      fetch(url, {
        method: 'POST',
        headers: {
          'X-CSRFToken': csrf,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({}),
        credentials: 'same-origin'
      }).then(function(r) {
        removeTempDisabledBtn.disabled = false;
        if (r.ok) {
          var row = document.getElementById('AccSettings-tempDisabledRow');
          if (row) row.remove();
          var setupRow = document.getElementById('AccSettings-tempDisableRow');
          if (setupRow) {
            setupRow.removeAttribute('hidden');
          }
        } else {
          alert('Could not remove. Please try again.');
        }
      }).catch(function() {
        removeTempDisabledBtn.disabled = false;
        alert('Could not remove. Please try again.');
      });
    });
  }

  // Show remaining disabled time (in hours) in the dashboard text
  var tempDisabledText = document.getElementById('AccSettings-tempDisabledText');
  if (tempDisabledText) {
    var endsAtStr = tempDisabledText.getAttribute('data-ends-at');
    if (endsAtStr) {
      var endsAt = new Date(endsAtStr);
      if (!isNaN(endsAt.getTime())) {
        var now = new Date();
        var msRemaining = endsAt.getTime() - now.getTime();
        if (msRemaining > 0) {
          var hoursRemaining = Math.ceil(msRemaining / (1000 * 60 * 60));
          var label = hoursRemaining === 1 ? '1 more hour' : hoursRemaining + ' more hours';
          tempDisabledText.textContent = 'Notifications are temporarily disabled for ' + label + '.';
        }
      }
    }
  }

  /* Temporarily disable notifications: POST duration (hours) to login_temp_disable */
  var tempDisableBtn = document.getElementById('AccSettings-tempDisableBtn');
  if (tempDisableBtn) {
    tempDisableBtn.addEventListener('click', function() {
      var durationSelect = document.getElementById('AccSettings-tempDisableDuration');
      if (!durationSelect || !durationSelect.value) return;
      var duration = durationSelect.value;
      if (!window.confirm('Temporarily disable notifications for ' + durationSelect.options[durationSelect.selectedIndex].text + '?')) {
        return;
      }
      var url = tempDisableBtn.getAttribute('data-temp-disable-url');
      if (!url) return;
      var csrfEl = document.querySelector('[name=csrfmiddlewaretoken]');
      var csrf = csrfEl ? csrfEl.value : '';
      tempDisableBtn.disabled = true;
      var formData = new FormData();
      formData.append('disable_notifications_duration', duration);
      fetch(url, {
        method: 'POST',
        headers: {
          'X-CSRFToken': csrf,
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: formData,
        credentials: 'same-origin'
      }).then(function(r) {
        tempDisableBtn.disabled = false;
        if (r.ok) {
          window.location.reload();
        } else {
          alert('Could not disable notifications. Please try again.');
        }
      }).catch(function() {
        tempDisableBtn.disabled = false;
        alert('Could not disable notifications. Please try again.');
      });
    });
  }

  /* Delete account: confirm then AJAX POST to send account deletion email */
  var deleteAccountBtn = document.getElementById('AccSettings-deleteAccountBtn');
  if (deleteAccountBtn) {
    deleteAccountBtn.addEventListener('click', function(e) {
      e.preventDefault();
      var confirmed = window.confirm('Send an account deletion link to your notifications? You will need to open the link to confirm deletion. This cannot be undone.');
      if (!confirmed) return;
      var url = deleteAccountBtn.getAttribute('data-send-deletion-url');
      if (!url) return;
      var csrfEl = document.querySelector('[name=csrfmiddlewaretoken]');
      var csrf = csrfEl ? csrfEl.value : '';
      deleteAccountBtn.disabled = true;
      var origText = deleteAccountBtn.textContent;
      deleteAccountBtn.textContent = 'Sending…';
      fetch(url, {
        method: 'POST',
        headers: {
          'X-CSRFToken': csrf,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({}),
        credentials: 'same-origin'
      }).then(function(r) {
        deleteAccountBtn.disabled = false;
        deleteAccountBtn.textContent = origText;
        if (r.ok) {
          alert('Account deletion link has been sent. Check your notifications to confirm deletion.');
        } else {
          alert('Could not send account deletion link. Please try again.');
        }
      }).catch(function() {
        deleteAccountBtn.disabled = false;
        deleteAccountBtn.textContent = origText;
        alert('Could not send account deletion link. Please try again.');
      });
    });
  }
})();
