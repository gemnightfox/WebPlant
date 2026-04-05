/**
 * Auto-resize feedback textarea (same pattern as add-task / edit-task popups).
 */
(function () {
  function autoResize(el) {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }

  function init() {
    var ta = document.getElementById('id_content');
    if (!ta) return;
    function run() {
      autoResize(ta);
    }
    ta.addEventListener('input', run);
    window.addEventListener('resize', run);
    run();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
