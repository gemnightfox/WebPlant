(function () {
    'use strict';
    var el = document.getElementById('success-duration');
    if (!el) return;
    try {
        var hours = sessionStorage.getItem('disable_notifications_duration_hours');
        var display = sessionStorage.getItem('disable_notifications_duration_display');
        if (hours && display) {
            el.textContent = 'Notifications are disabled for ' + hours + ' hour(s) (' + display + ').';
        }
    } catch (e) {}
})();
