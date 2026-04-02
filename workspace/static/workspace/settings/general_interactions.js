(function() {
  function getCookie(name) {
    var match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? match[2] : null;
  }
  var csrfToken = getCookie('csrftoken');
  var transferHeaderBtn = document.getElementById('ws-transfer-header-btn');
  var transferDropdown = document.getElementById('ws-transfer-dropdown');
  var transferForm;

  var renameInput = document.getElementById('id_ws_rename');
  var renameEditBtn = document.getElementById('ws-rename-edit-btn');
  var renameSaveBtn = document.getElementById('ws-rename-save-btn');
  if (renameEditBtn && renameInput && renameSaveBtn) {
    renameEditBtn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      renameInput.readOnly = false;
      renameInput.removeAttribute('readonly');
      renameInput.classList.add('is-editing');
      renameInput.focus();
      renameSaveBtn.removeAttribute('hidden');
      renameEditBtn.setAttribute('hidden', '');
    });
  }

  var renameForm = document.getElementById('ws-rename-form');
  if (renameForm) {
    renameForm.addEventListener('submit', function(e) {
      e.preventDefault();
      var url = renameForm.getAttribute('data-url');
      var errorEl = renameForm.querySelector('[data-role="rename-error"]');
      if (errorEl) errorEl.setAttribute('hidden', '');
      fetch(url, {
        method: 'POST',
        headers: { 'X-Requested-With': 'XMLHttpRequest', 'X-CSRFToken': csrfToken },
        body: new FormData(renameForm)
      }).then(function(r) {
        if (!r.ok) { if (errorEl) errorEl.removeAttribute('hidden'); return; }
        return r.json().then(function(data) {
          if (data && data.status === 'success') window.location.reload();
          else if (errorEl) errorEl.removeAttribute('hidden');
        }).catch(function() { window.location.reload(); });
      }).catch(function() { if (errorEl) errorEl.removeAttribute('hidden'); });
    });
  }

  document.querySelectorAll('.WsSettings-slider').forEach(function(slider) {
    var options = slider.querySelectorAll('.WsSettings-sliderOption');
    var thumb = slider.querySelector('.WsSettings-sliderThumb');
    var url = slider.getAttribute('data-url');
    function positionThumb(activeBtn) { thumb.style.left = activeBtn.offsetLeft + 'px'; thumb.style.width = activeBtn.offsetWidth + 'px'; }
    function normalizeValue(raw) { return (raw === true || raw === 'true' || raw === 'True' || raw === '1') ? 'true' : 'false'; }
    function setSliderValue(rawValue, save) {
      var prevValue = slider.getAttribute('data-value') || 'false';
      var value = normalizeValue(rawValue);
      slider.setAttribute('data-value', value);
      options.forEach(function(opt) {
        var isActive = opt.getAttribute('data-value') === value;
        opt.classList.toggle('is-active', isActive);
        if (isActive) positionThumb(opt);
      });
      slider.dispatchEvent(new CustomEvent('slider-change', { detail: { value: value } }));
      if (save && url) {
        var csrfInput = document.querySelector('[name="csrfmiddlewaretoken"]');
        var csrf = csrfInput ? csrfInput.value : csrfToken;
        var fd = new FormData();
        fd.append('csrfmiddlewaretoken', csrf);
        fd.append('custom_roles', value);
        fetch(url, { method: 'POST', headers: { 'X-CSRFToken': csrf }, body: fd })
          .then(function(r) { return r.json().then(function(data) { if (!data || data.status !== 'success') setSliderValue(prevValue, false); }); })
          .catch(function() { setSliderValue(prevValue, false); });
      }
    }
    setSliderValue(slider.getAttribute('data-value'), false);
    window.addEventListener('resize', function() {
      var active = slider.querySelector('.WsSettings-sliderOption.is-active');
      if (active) positionThumb(active);
    });
    options.forEach(function(opt) { opt.addEventListener('click', function() { setSliderValue(opt.getAttribute('data-value'), true); }); });
  });

  var mobileRoleToggle = document.getElementById('ws-custom-roles-mobile-toggle');
  var customRolesSlider = document.getElementById('ws-slider-custom-roles');
  if (mobileRoleToggle && customRolesSlider) {
    mobileRoleToggle.addEventListener('change', function() {
      var targetValue = mobileRoleToggle.checked ? 'true' : 'false';
      var targetOption = customRolesSlider.querySelector('.WsSettings-sliderOption[data-value="' + targetValue + '"]');
      if (targetOption) targetOption.click();
    });
    customRolesSlider.addEventListener('slider-change', function(e) { mobileRoleToggle.checked = e.detail.value === 'true'; });
  }

  function postAndRedirect(url, errorEl) {
    fetch(url, { method: 'POST', headers: { 'X-Requested-With': 'XMLHttpRequest', 'X-CSRFToken': csrfToken } })
      .then(function(r) {
        return r.json().then(function(data) {
          if (data && data.status === 'success') window.location.href = '/';
          else if (errorEl) errorEl.removeAttribute('hidden');
        });
      }).catch(function() { if (errorEl) errorEl.removeAttribute('hidden'); });
  }

  var leaveBtn = document.getElementById('ws-leave-btn');
  if (leaveBtn) {
    leaveBtn.addEventListener('click', function() {
      if (!window.confirm('Are you sure you want to leave this workspace? You will lose access immediately.')) return;
      var url = leaveBtn.getAttribute('data-leave-url');
      var errorEl = document.querySelector('[data-role="leave-error"]');
      if (errorEl) errorEl.setAttribute('hidden', '');
      postAndRedirect(url, errorEl);
    });
  }

  var deleteWorkspaceBtn = document.getElementById('ws-delete-workspace-btn');
  if (deleteWorkspaceBtn) {
    deleteWorkspaceBtn.addEventListener('click', function() {
      if (!window.confirm('Are you sure you want to leave this workspace? This cannot be undone.')) return;
      var url = deleteWorkspaceBtn.getAttribute('data-delete-url');
      var errorEl = document.querySelector('[data-role="leave-error"]');
      if (errorEl) errorEl.setAttribute('hidden', '');
      postAndRedirect(url, errorEl);
    });
  }

  if (transferHeaderBtn && transferDropdown) {
    transferHeaderBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      if (transferDropdown.hasAttribute('hidden')) transferDropdown.removeAttribute('hidden');
      else transferDropdown.setAttribute('hidden', '');
    });
    document.addEventListener('click', function() { transferDropdown.setAttribute('hidden', ''); });
    transferDropdown.addEventListener('click', function(e) { e.stopPropagation(); });
    transferDropdown.querySelectorAll('.WsSettings-transferDropdownItem').forEach(function(item) {
      item.addEventListener('click', function() {
        var wuId = item.getAttribute('data-wu-id');
        var email = item.getAttribute('data-email');
        if (!window.confirm('Transfer ownership to ' + email + '? This cannot be undone.')) return;
        transferDropdown.setAttribute('hidden', '');
        transferForm = document.getElementById('ws-transfer-form');
        var select = transferForm && transferForm.querySelector('select[name="owner"]');
        var errorEl = transferForm && transferForm.querySelector('[data-role="transfer-error"]');
        if (!transferForm || !select) return;
        if (errorEl) errorEl.setAttribute('hidden', '');
        select.value = wuId;
        var url = transferForm.getAttribute('data-url-base');
        var formData = new FormData();
        formData.append('owner', wuId);
        fetch(url, { method: 'POST', headers: { 'X-Requested-With': 'XMLHttpRequest', 'X-CSRFToken': csrfToken }, body: formData })
          .then(function(r) {
            if (!r.ok) { if (errorEl) errorEl.removeAttribute('hidden'); return; }
            return r.json().then(function(data) {
              if (data && data.status === 'success') window.location.reload();
              else if (errorEl) errorEl.removeAttribute('hidden');
            }).catch(function() { window.location.reload(); });
          })
          .catch(function() { if (errorEl) errorEl.removeAttribute('hidden'); });
      });
    });
  }

  transferForm = document.getElementById('ws-transfer-form');
  if (transferForm) {
    transferForm.addEventListener('submit', function(e) {
      e.preventDefault();
      var select = transferForm.querySelector('select[name="owner"]');
      if (!select || !select.value) return;
      var userName = select.options[select.selectedIndex].text;
      if (!window.confirm('Transfer ownership of this workspace to ' + userName + '? This action cannot be undone.')) return;
      var url = transferForm.getAttribute('data-url-base');
      var errorEl = transferForm.querySelector('[data-role="transfer-error"]');
      if (errorEl) errorEl.setAttribute('hidden', '');
      fetch(url, { method: 'POST', headers: { 'X-Requested-With': 'XMLHttpRequest', 'X-CSRFToken': csrfToken }, body: new FormData(transferForm) })
        .then(function(r) {
          if (!r.ok) { if (errorEl) errorEl.removeAttribute('hidden'); return; }
          return r.json().then(function(data) {
            if (data && data.status === 'success') window.location.reload();
            else if (errorEl) errorEl.removeAttribute('hidden');
          }).catch(function() { window.location.reload(); });
        })
        .catch(function() { if (errorEl) errorEl.removeAttribute('hidden'); });
    });
  }

  (function() {
    document.querySelectorAll('.ws-copy-invite-code').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var code = btn.getAttribute('data-code');
        var checkSvg = '<svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>';
        var origHtml = btn.innerHTML;
        navigator.clipboard.writeText(code).then(function() { btn.innerHTML = checkSvg; setTimeout(function() { btn.innerHTML = origHtml; }, 1500); });
      });
    });

    document.querySelectorAll('.WsSettings-showPwBtn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var card = btn.closest('.WsSettings-inviteCodeCard');
        if (!card) return;
        var inlineWrap = card.querySelector('.WsSettings-pwRevealInline');
        if (!inlineWrap) return;
        document.querySelectorAll('.WsSettings-pwRevealInline').forEach(function(wrap) {
          if (wrap !== inlineWrap) { wrap.setAttribute('hidden', ''); wrap.setAttribute('aria-hidden', 'true'); }
        });
        var valueEl = inlineWrap.querySelector('.WsSettings-pwRevealValue');
        if (valueEl) valueEl.textContent = btn.getAttribute('data-password') || '';
        var isHidden = inlineWrap.hasAttribute('hidden');
        var textEl = btn.querySelector('.WsSettings-showPwText');
        if (isHidden) {
          inlineWrap.removeAttribute('hidden');
          inlineWrap.setAttribute('aria-hidden', 'false');
          if (textEl) textEl.textContent = 'Hide password';
          btn.classList.add('is-showing');
        } else {
          inlineWrap.setAttribute('hidden', '');
          inlineWrap.setAttribute('aria-hidden', 'true');
          if (textEl) textEl.textContent = 'Show password';
          btn.classList.remove('is-showing');
        }
      });
    });

    var addBtn = document.getElementById('ws-add-invite-code-btn');
    var modal = document.getElementById('ws-add-invite-modal');
    var step1 = document.getElementById('ws-modal-step1');
    var addForm = document.getElementById('ws-add-invite-code-form');
    function openAddModal() {
      if (!modal) return;
      step1.removeAttribute('hidden');
      addForm.setAttribute('hidden', '');
      addForm.reset();
      var errEl = addForm.querySelector('[data-role="add-invite-error"]');
      if (errEl) errEl.setAttribute('hidden', '');
      modal.removeAttribute('hidden');
      modal.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    }
    function closeAddModal() {
      if (!modal) return;
      modal.setAttribute('hidden', '');
      modal.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    }
    function submitCode(password) {
      var url = addForm.getAttribute('data-url');
      var errEl = addForm.querySelector('[data-role="add-invite-error"]');
      if (errEl) errEl.setAttribute('hidden', '');
      var fd = new FormData(addForm);
      if (password !== undefined) fd.set('password', password);
      fetch(url, { method: 'POST', headers: { 'X-Requested-With': 'XMLHttpRequest', 'X-CSRFToken': csrfToken }, body: fd })
        .then(function(r) {
          return r.json().then(function(data) {
            if (data && data.status === 'success') window.location.reload();
            else if (errEl) errEl.removeAttribute('hidden');
          });
        }).catch(function() { if (errEl) errEl.removeAttribute('hidden'); });
    }
    if (addBtn && modal) {
      addBtn.addEventListener('click', openAddModal);
      var modalClose = modal.querySelector('.Popup-close');
      var modalBackdrop = modal.querySelector('.Popup-backdrop');
      if (modalClose) modalClose.addEventListener('click', closeAddModal);
      if (modalBackdrop) modalBackdrop.addEventListener('click', closeAddModal);
      document.addEventListener('keydown', function(e) { if (e.key === 'Escape' && !modal.hasAttribute('hidden')) closeAddModal(); });
      var choiceNo = document.getElementById('ws-choice-no-password');
      if (choiceNo) choiceNo.addEventListener('click', function() { submitCode(''); });
      var choiceYes = document.getElementById('ws-choice-with-password');
      if (choiceYes) {
        choiceYes.addEventListener('click', function() {
          step1.setAttribute('hidden', '');
          addForm.removeAttribute('hidden');
          var pwInput = addForm.querySelector('input[name="password"]');
          if (pwInput) {
            pwInput.focus();
            pwInput.setCustomValidity('');
          }
        });
      }
      var pwField = addForm.querySelector('input[name="password"]');
      if (pwField) {
        pwField.addEventListener('input', function() { this.setCustomValidity(''); });
      }
      addForm.addEventListener('submit', function(e) {
        e.preventDefault();
        var pwInput = addForm.querySelector('input[name="password"]');
        if (pwInput) {
          var t = pwInput.value.trim();
          if (!t) {
            pwInput.setCustomValidity('Please enter a password.');
            pwInput.reportValidity();
            return;
          }
          pwInput.setCustomValidity('');
          pwInput.value = t;
        }
        submitCode();
      });
    }

    document.querySelectorAll('.ws-delete-invite-code-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        if (!window.confirm('Delete this invite code? People using it will no longer be able to join.')) return;
        var url = btn.getAttribute('data-delete-url');
        var card = btn.closest('.WsSettings-inviteCodeCard');
        fetch(url, { method: 'POST', headers: { 'X-Requested-With': 'XMLHttpRequest', 'X-CSRFToken': csrfToken } })
          .then(function(r) {
            return r.json().then(function(data) {
              if (data && data.status === 'success') {
                if (card) card.remove();
                var list = document.getElementById('ws-invite-codes-list');
                if (list && !list.querySelector('.WsSettings-inviteCodeCard')) {
                  var empty = document.createElement('li');
                  empty.className = 'WsSettings-roleCard WsSettings-roleCard--empty';
                  empty.textContent = 'No invite codes yet.';
                  list.appendChild(empty);
                }
              } else window.alert('Could not delete invite code. Please try again.');
            });
          }).catch(function() { window.alert('Could not delete invite code. Please try again.'); });
      });
    });
  })();

  function selectHasActiveOptions(select) {
    if (!select) return false;
    for (var i = 0; i < select.options.length; i++) if (select.options[i].value !== '') return true;
    return false;
  }
  var transferSection = document.querySelector('.WsSettings-transfer');
  var transferSelect = document.getElementById('id_transfer_user');
  if (transferSection && transferSelect && !selectHasActiveOptions(transferSelect)) transferSection.hidden = true;
  var transferWrapper = transferHeaderBtn && transferHeaderBtn.closest('.WsSettings-transferWrapper');
  var dropdownItems = transferDropdown && transferDropdown.querySelectorAll('.WsSettings-transferDropdownItem');
  if (transferWrapper && (!dropdownItems || dropdownItems.length === 0)) {
    transferWrapper.setAttribute('hidden', '');
    var headerDeleteBtn = document.getElementById('ws-delete-workspace-btn');
    if (headerDeleteBtn) headerDeleteBtn.removeAttribute('hidden');
  }
})();
