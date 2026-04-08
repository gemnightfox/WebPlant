/**
 * Account settings: theme toggle (light/dark), timezone (IANA via Intl.supportedValuesOf), and account actions.
 * - Theme: POST set_preferences; update body class.
 * - Password button: label from server-rendered HTML; GET check_password_present keeps label + data in sync.
 * - Optional Disable password (sends confirmation link by email); hint when no local password.
 * - Email popup: AJAX submit to account_email; success message in popup.
 * - Reset password: confirm then POST reset; on success open reset-password-popup.
 * - Logout all devices: POST logout_all_devices; redirect to login (all sessions cleared).
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

  var sendFeedbackLink = document.querySelector('.AccSettings-sendFeedback');
  if (sendFeedbackLink) {
    sendFeedbackLink.addEventListener('click', function(e) {
      if (!window.confirm('Leave account settings to send feedback?')) {
        e.preventDefault();
      }
    });
  }

  var logoutAllDevicesBtn = document.getElementById('AccSettings-logoutAllDevicesBtn');
  if (logoutAllDevicesBtn) {
    logoutAllDevicesBtn.addEventListener('click', function() {
      if (
        !window.confirm(
          'Sign out on every device where you are logged in, including this one? You will need to sign in again.'
        )
      ) {
        return;
      }
      var url = logoutAllDevicesBtn.getAttribute('data-logout-all-url');
      var loginUrl = logoutAllDevicesBtn.getAttribute('data-login-url') || '/account/login/';
      if (!url) return;
      var csrfEl = document.querySelector('[name=csrfmiddlewaretoken]');
      var csrf = csrfEl ? csrfEl.value : '';
      logoutAllDevicesBtn.disabled = true;
      var origText = logoutAllDevicesBtn.textContent;
      logoutAllDevicesBtn.textContent = 'Signing out…';
      fetch(url, {
        method: 'POST',
        headers: {
          'X-CSRFToken': csrf,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({}),
        credentials: 'same-origin'
      })
        .then(function(r) {
          return r.json().then(function(data) {
            return { ok: r.ok, data: data };
          });
        })
        .then(function(result) {
          if (result.ok && result.data && result.data.status === 'success') {
            window.location.href = loginUrl;
            return;
          }
          logoutAllDevicesBtn.disabled = false;
          logoutAllDevicesBtn.textContent = origText;
          alert('Could not sign out everywhere. Please try again.');
        })
        .catch(function() {
          logoutAllDevicesBtn.disabled = false;
          logoutAllDevicesBtn.textContent = origText;
          alert('Could not sign out everywhere. Please try again.');
        });
    });
  }

  var workspaceInvitesToggle = document.querySelector('.AccSettings-workspaceInvitesToggle');
  var notificationsToggle = document.querySelector('.AccSettings-notificationsToggle');
  var editUsernameBtn = document.getElementById('AccSettings-editUsernameBtn');
  var usernamePopup = document.getElementById('username-popup');
  var usernameForm = document.getElementById('AccSettings-usernameForm');
  var usernameValue = document.getElementById('AccSettings-usernameValue');
  var usernameInput = document.getElementById('AccSettings-usernameInput');
  var saveUsernameBtn = document.getElementById('AccSettings-saveUsernameBtn');

  function getCurrentUsername() {
    if (!usernameValue) return '';
    return (usernameValue.getAttribute('data-current-username') || '').trim();
  }

  function setCurrentUsername(username) {
    if (!usernameValue) return;
    var clean = (username || '').trim();
    usernameValue.setAttribute('data-current-username', clean);
    usernameValue.textContent = clean || '(No username yet)';
    if (clean) {
      usernameValue.classList.remove('AccSettings-accountValue--muted');
    } else {
      usernameValue.classList.add('AccSettings-accountValue--muted');
    }
    if (usernameInput) {
      usernameInput.value = clean;
    }
  }

  function isValidUsername(username) {
    return /^[a-z0-9_]+$/.test(username);
  }

  if (editUsernameBtn && usernamePopup && window.popupPrepare) {
    window.popupPrepare['username-popup'] = function() {
      if (!usernameInput) return;
      var current = getCurrentUsername();
      usernameInput.defaultValue = current;
      usernameInput.value = current;
    };
  }

  if (usernameForm) {
    usernameForm.addEventListener('submit', function(e) {
      e.preventDefault();
      if (!usernameInput || !saveUsernameBtn) return;

      var rawValue = usernameInput.value || '';
      var nextUsername = rawValue.trim().toLowerCase();
      var currentUsername = getCurrentUsername();
      if (nextUsername === currentUsername) {
        if (usernamePopup && window.closePopup) {
          window.closePopup(usernamePopup);
        }
        return;
      }
      if (!nextUsername) {
        alert('Username cannot be empty.');
        usernameInput.focus();
        return;
      }
      if (!isValidUsername(nextUsername)) {
        alert('Use only lowercase letters, numbers, and underscore.');
        usernameInput.focus();
        return;
      }

      var csrfEl = document.querySelector('[name=csrfmiddlewaretoken]');
      var csrf = csrfEl ? csrfEl.value : '';
      var usernameUrl = (usernamePopup && usernamePopup.getAttribute('data-username-url')) || '/account/edit-username/';
      var formBody = new URLSearchParams();
      formBody.append('username', nextUsername);
      if (csrf) formBody.append('csrfmiddlewaretoken', csrf);

      saveUsernameBtn.disabled = true;
      var originalText = saveUsernameBtn.textContent;
      saveUsernameBtn.textContent = 'Saving...';

      fetch(usernameUrl, {
        method: 'POST',
        headers: {
          'X-CSRFToken': csrf,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json,text/html'
        },
        body: formBody.toString(),
        credentials: 'same-origin'
      })
        .then(function(r) {
          if (r.ok) {
            setCurrentUsername(nextUsername);
            if (usernamePopup && window.closePopup) {
              window.closePopup(usernamePopup);
            }
            return;
          }
          if (r.status === 404) {
            alert('Username update endpoint is unavailable right now.');
            return;
          }
          return r.text().then(function(text) {
            if (text && (text.indexOf('unique') !== -1 || text.indexOf('already') !== -1)) {
              alert('This username is already taken.');
              return;
            }
            if (text && text.indexOf('Disallowed character used') !== -1) {
              alert('Use only lowercase letters, numbers, and underscore.');
              return;
            }
            alert('Could not update username. Please try again.');
          });
        })
        .catch(function() {
          alert('Could not update username. Please try again.');
        })
        .finally(function() {
          saveUsernameBtn.disabled = false;
          saveUsernameBtn.textContent = originalText;
        });
    });
  }

  function setTheme(theme) {
    body.className = theme === 'dark' ? 'theme-dark' : 'theme-light';
  }

  function getSupportedTimezoneIds() {
    try {
      if (typeof Intl !== 'undefined' && typeof Intl.supportedValuesOf === 'function') {
        return Intl.supportedValuesOf('timeZone');
      }
    } catch (e) {
      /* ignore */
    }
    try {
      var tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      return tz ? [tz] : [];
    } catch (e2) {
      /* ignore */
    }
    return [];
  }

  function getBrowserDefaultTimezone() {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    } catch (e) {
      return '';
    }
  }

  function getBrowserDefaultTimezoneLabel() {
    var browserTz = getBrowserDefaultTimezone();
    if (browserTz) {
      return 'Use browser default (' + browserTz + ')';
    }
    return 'Use browser default';
  }

  function getTimezoneRegion(timezoneId) {
    if (!timezoneId) return '';
    var slashIdx = timezoneId.indexOf('/');
    if (slashIdx === -1) return 'Other';
    return timezoneId.slice(0, slashIdx);
  }

  function getTimezoneRegions(ids) {
    var map = {};
    var regions = [];
    var i;
    for (i = 0; i < ids.length; i++) {
      var region = getTimezoneRegion(ids[i]);
      if (!region) continue;
      if (!map[region]) {
        map[region] = true;
        regions.push(region);
      }
    }
    regions.sort(function(a, b) {
      return a.localeCompare(b);
    });
    return regions;
  }

  function populateTimezoneRegionButtons(regionButtonsEl, ids, activeRegion) {
    regionButtonsEl.innerHTML = '';
    var regions = getTimezoneRegions(ids);
    var i;
    for (i = 0; i < regions.length; i++) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'AccSettings-timezoneRegionBtn';
      btn.textContent = regions[i];
      btn.setAttribute('data-region', regions[i]);
      btn.setAttribute('aria-pressed', regions[i] === activeRegion ? 'true' : 'false');
      if (regions[i] === activeRegion) {
        btn.classList.add('is-active');
      }
      regionButtonsEl.appendChild(btn);
    }
  }

  function populateTimezoneSelect(selectEl, ids, current, selectedRegion) {
    selectEl.innerHTML = '';
    ids.sort(function(a, b) {
      return a.localeCompare(b);
    });
    var blank = document.createElement('option');
    blank.value = '';
    blank.textContent = getBrowserDefaultTimezoneLabel();
    selectEl.appendChild(blank);
    var i;
    for (i = 0; i < ids.length; i++) {
      if (selectedRegion && getTimezoneRegion(ids[i]) !== selectedRegion) {
        continue;
      }
      var opt = document.createElement('option');
      opt.value = ids[i];
      opt.textContent = ids[i];
      selectEl.appendChild(opt);
    }
    if (current) {
      var found = false;
      for (i = 0; i < ids.length; i++) {
        if (ids[i] === current) {
          found = true;
          break;
        }
      }
      if (!found) {
        var extra = document.createElement('option');
        extra.value = current;
        extra.textContent = current;
        selectEl.appendChild(extra);
      }
    }
    selectEl.value = current || '';
    if (selectEl.value !== current && current) {
      selectEl.value = '';
    }
  }

  function getCurrentTimezone() {
    var timezoneWrap = document.getElementById('AccSettings-timezoneWrap');
    if (!timezoneWrap) return '';
    return (timezoneWrap.getAttribute('data-current-timezone') || '').trim();
  }

  function setCurrentTimezone(timezone) {
    var timezoneWrap = document.getElementById('AccSettings-timezoneWrap');
    var timezoneValue = document.getElementById('AccSettings-timezoneValue');
    var clean = (timezone || '').trim();
    var bodyEl = document.body;
    var previousBodyTimezone = '';
    if (bodyEl) {
      previousBodyTimezone = (bodyEl.getAttribute('data-user-timezone') || '').trim();
      bodyEl.setAttribute('data-user-timezone', clean);
    }
    if (timezoneWrap) {
      timezoneWrap.setAttribute('data-current-timezone', clean);
    }
    if (timezoneValue) {
      timezoneValue.textContent = clean || getBrowserDefaultTimezoneLabel();
      if (clean) {
        timezoneValue.classList.remove('AccSettings-timezoneValue--muted');
      } else {
        timezoneValue.classList.add('AccSettings-timezoneValue--muted');
      }
    }
    if (previousBodyTimezone !== clean) {
      window.dispatchEvent(new CustomEvent('user-timezone-changed', { detail: { timezone: clean } }));
    }
  }

  function postPreferences(colorTheme, sendNotifications, workspaceInvites) {
    var url = settingsRoot ? settingsRoot.getAttribute('data-set-preferences-url') : '';
    if (!url) return Promise.reject('No URL');
    var csrf = document.querySelector('[name=csrfmiddlewaretoken]');
    var token = csrf ? csrf.value : '';
    var params = new URLSearchParams();
    params.append('color_theme', colorTheme);
    if (sendNotifications) params.append('can_send_notifications', 'on');
    if (workspaceInvites) params.append('allows_workspace_invites', 'on');
    params.append('timezone', getCurrentTimezone());
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

  /* Workspace invites toggle: POST all preferences with updated allows_workspace_invites */
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

  /* Email notifications toggle: POST all preferences with updated can_send_notifications */
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

  var timezonePopup = document.getElementById('timezone-popup');
  var timezoneRegionButtons = document.getElementById('AccSettings-timezoneRegionButtons');
  var timezonePopupSelect = document.getElementById('AccSettings-timezonePopupSelect');
  var saveTimezoneBtn = document.getElementById('AccSettings-saveTimezoneBtn');
  if (timezonePopup && timezoneRegionButtons && timezonePopupSelect && saveTimezoneBtn) {
    var availableTimezoneIds = [];
    var selectedTimezoneRegion = '';

    function setActiveTimezoneRegion(region) {
      selectedTimezoneRegion = region || '';
      var buttons = timezoneRegionButtons.querySelectorAll('.AccSettings-timezoneRegionBtn');
      var i;
      for (i = 0; i < buttons.length; i++) {
        var isActive = buttons[i].getAttribute('data-region') === selectedTimezoneRegion;
        buttons[i].setAttribute('aria-pressed', isActive ? 'true' : 'false');
        if (isActive) {
          buttons[i].classList.add('is-active');
        } else {
          buttons[i].classList.remove('is-active');
        }
      }
    }

    if (window.popupPrepare) {
      window.popupPrepare['timezone-popup'] = function() {
        availableTimezoneIds = getSupportedTimezoneIds();
        selectedTimezoneRegion = '';
        populateTimezoneRegionButtons(timezoneRegionButtons, availableTimezoneIds, selectedTimezoneRegion);
        populateTimezoneSelect(
          timezonePopupSelect,
          availableTimezoneIds,
          '',
          selectedTimezoneRegion
        );
      };
    }

    timezoneRegionButtons.addEventListener('click', function(e) {
      var btn = e.target.closest('.AccSettings-timezoneRegionBtn');
      if (!btn) return;
      setActiveTimezoneRegion(btn.getAttribute('data-region') || '');
      populateTimezoneSelect(
        timezonePopupSelect,
        availableTimezoneIds,
        '',
        selectedTimezoneRegion
      );
    });

    saveTimezoneBtn.addEventListener('click', function() {
      var colorTheme = themeToggle ? (themeToggle.checked ? 'dark' : 'light') : 'dark';
      var sendNotifs = notificationsToggle ? notificationsToggle.checked : notificationsAllowed;
      var wsInvites = workspaceInvitesToggle ? workspaceInvitesToggle.checked : true;
      var selectedTimezone = timezonePopupSelect.value || '';
      saveTimezoneBtn.disabled = true;
      var previousTimezone = getCurrentTimezone();
      setCurrentTimezone(selectedTimezone);
      postPreferences(colorTheme, sendNotifs, wsInvites)
        .then(function(r) {
          saveTimezoneBtn.disabled = false;
          if (r.ok) {
            if (window.closePopup) {
              window.closePopup(timezonePopup);
            }
          } else {
            setCurrentTimezone(previousTimezone);
            alert('Could not update timezone. Please try again.');
          }
        })
        .catch(function() {
          saveTimezoneBtn.disabled = false;
          setCurrentTimezone(previousTimezone);
          alert('Could not update timezone. Please try again.');
        });
    });
  }

  if (!getCurrentTimezone()) {
    setCurrentTimezone('');
  }

  /* Password button label: "Setup" vs "Change" from backend */
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
          passwordButton.textContent = 'Setup';
        } else {
          passwordButton.textContent = 'Change';
        }
        var disableBtn = document.getElementById('AccSettings-disablePasswordBtn');
        var disableDotsMsg = document.getElementById('AccSettings-disablePasswordDots');
        var disableNoPwMsg = document.getElementById('AccSettings-disablePasswordNoPassword');
        if (data.is_password_present === true) {
          if (disableBtn) disableBtn.removeAttribute('hidden');
          if (disableDotsMsg) disableDotsMsg.removeAttribute('hidden');
          if (disableNoPwMsg) disableNoPwMsg.setAttribute('hidden', '');
        } else {
          if (disableBtn) disableBtn.setAttribute('hidden', '');
          if (disableDotsMsg) disableDotsMsg.setAttribute('hidden', '');
          if (disableNoPwMsg) disableNoPwMsg.removeAttribute('hidden');
        }
      }).catch(function() {
        // If this fails, just leave the default label as-is
      });
    }
  }

  /* Send email with link to disable local password (POST send_disable_password_email) */
  var disablePasswordBtn = document.getElementById('AccSettings-disablePasswordBtn');
  if (disablePasswordBtn) {
    disablePasswordBtn.addEventListener('click', function() {
      var confirmed = window.confirm(
        'Send a link to your email to disable your local password? After you confirm via the link, you will not be able to sign in with email and password until you set a new one.'
      );
      if (!confirmed) return;
      var url = disablePasswordBtn.getAttribute('data-send-disable-password-url');
      if (!url) return;
      var csrfEl = document.querySelector('[name=csrfmiddlewaretoken]');
      var csrf = csrfEl ? csrfEl.value : '';
      disablePasswordBtn.disabled = true;
      var origText = disablePasswordBtn.textContent;
      disablePasswordBtn.textContent = 'Sending…';
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
        return r.json().then(function(data) {
          return { ok: r.ok, data: data };
        });
      }).then(function(result) {
        disablePasswordBtn.disabled = false;
        disablePasswordBtn.textContent = origText;
        if (result.ok && result.data && result.data.status === 'success') {
          alert(
            'A link to disable your password has been sent to your email. Open the link to confirm.'
          );
          return;
        }
        var msg =
          result.data && result.data.message
            ? result.data.message
            : 'Could not send the email. Please try again.';
        alert(msg);
      }).catch(function() {
        disablePasswordBtn.disabled = false;
        disablePasswordBtn.textContent = origText;
        alert('Could not send the email. Please try again.');
      });
    });
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
          tempDisabledText.textContent = 'Notifications disabled for ' + label + '.';
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
