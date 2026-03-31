(function() {
  function initWsSettingsTabs() {
    var container = document.querySelector('.WsSettings');
    var tabs = document.querySelectorAll('.WsSettings-tab');
    var panels = document.querySelectorAll('.WsSettings-tabPanel');
    if (!tabs.length || !panels.length) return;

    var hashToIndex = { '': 0, 'general': 0, 'users': 1, 'roles': 2 };
    var indexToHash = ['general', 'users', 'roles'];

    var rolesTabBtn = document.getElementById('ws-tab-btn-roles');
    var rolesTabPanel = document.getElementById('ws-tab-roles');
    var headerActions = document.getElementById('ws-header-actions');

    function setActive(index) {
      index = Math.max(0, Math.min(index, panels.length - 1));
      tabs.forEach(function(t, i) {
        t.classList.toggle('is-active', i === index);
        t.setAttribute('aria-selected', i === index ? 'true' : 'false');
      });
      panels.forEach(function(p, i) {
        var isActive = i === index;
        p.classList.toggle('is-active', isActive);
        p.hidden = !isActive;
      });
      var onGeneral = index === 0;
      if (container) {
        container.classList.toggle('WsSettings--generalActive', onGeneral);
      }
      if (headerActions) {
        headerActions.hidden = !onGeneral;
        if (onGeneral) {
          headerActions.removeAttribute('aria-hidden');
        } else {
          headerActions.setAttribute('aria-hidden', 'true');
        }
        var dd = document.getElementById('ws-transfer-dropdown');
        if (dd && !onGeneral) dd.setAttribute('hidden', '');
      }
      var hash = indexToHash[index];
      var newHash = hash === 'general' ? '' : hash;
      if (location.hash.slice(1) !== newHash) {
        location.replace(location.pathname + location.search + (newHash ? '#' + newHash : ''));
      }
    }

    function toggleRolesTab(customRolesValue) {
      var v = (customRolesValue + '').toLowerCase();
      var show = v === 'true' || v === '1';
      if (rolesTabBtn) rolesTabBtn.style.display = show ? '' : 'none';
      if (rolesTabPanel) rolesTabPanel.style.display = show ? '' : 'none';
      if (!show && rolesTabBtn && rolesTabBtn.classList.contains('is-active')) {
        setActive(0);
      }
    }

    if (container) {
      toggleRolesTab(container.getAttribute('data-custom-roles') || 'disabled');
    }

    var slider = document.getElementById('ws-slider-custom-roles');
    if (slider) {
      slider.addEventListener('slider-change', function(e) {
        toggleRolesTab(e.detail.value);
      });
    }

    function indexFromHash() {
      var key = (location.hash || '').slice(1).toLowerCase();
      return key in hashToIndex ? hashToIndex[key] : 0;
    }

    setActive(indexFromHash());

    tabs.forEach(function(tab, index) {
      tab.addEventListener('click', function() {
        setActive(index);
      });
    });

    window.addEventListener('hashchange', function() {
      setActive(indexFromHash());
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWsSettingsTabs);
  } else {
    initWsSettingsTabs();
  }
})();
