(function () {
    'use strict';

    var form = document.getElementById('disable-notifications-form');
    var durationSelect = document.getElementById('hours-select');
    var hidden = document.getElementById('disable_notifications_duration');
    var confirmBtn = document.getElementById('confirm-btn');
    var modal = document.getElementById('confirm-modal');
    var modalMessage = document.getElementById('confirm-modal-message');
    var modalCancel = document.getElementById('confirm-modal-cancel');
    var modalSubmit = document.getElementById('confirm-modal-submit');
    var backdrop = modal && modal.querySelector('.DisableNotifications-modal-backdrop');

    function hoursToDaysAndHours(hours) {
        hours = parseInt(hours, 10) || 0;
        var d = Math.floor(hours / 24);
        var h = hours % 24;
        if (d === 0) return h + ' hours';
        if (h === 0) return d + ' days';
        return d + ' days, ' + h + ' hours';
    }

    function syncDurationValue() {
        if (!durationSelect || !hidden) return;
        hidden.value = durationSelect.value;
    }

    function showConfirmation() {
        if (!durationSelect) return;
        var hours = durationSelect.value;
        var text = hoursToDaysAndHours(hours);
        modalMessage.textContent = 'Disable notifications for ' + text + '?';
        modal.hidden = false;
    }

    function hideModal() {
        modal.hidden = true;
    }

    function confirmAndSubmit() {
        if (!durationSelect) return;
        var hours = durationSelect.value;
        try {
            sessionStorage.setItem('disable_notifications_duration_hours', hours);
            sessionStorage.setItem('disable_notifications_duration_display', hoursToDaysAndHours(hours));
        } catch (e) {}
        hideModal();
        form.submit();
    }

    if (durationSelect) {
        durationSelect.addEventListener('change', syncDurationValue);
        syncDurationValue();
    }

    if (confirmBtn) confirmBtn.addEventListener('click', showConfirmation);
    if (modalCancel) modalCancel.addEventListener('click', hideModal);
    if (backdrop) backdrop.addEventListener('click', hideModal);
    if (modalSubmit) modalSubmit.addEventListener('click', confirmAndSubmit);
})();
