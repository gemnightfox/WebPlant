(function () {
    'use strict';

    var form = document.getElementById('disable-notifications-form');
    var range = document.getElementById('hours-range');
    var label = document.getElementById('hours-label');
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

    function updateLabel() {
        var val = range.value;
        label.textContent = val;
        hidden.value = val;
    }

    function showConfirmation() {
        var hours = range.value;
        var text = hoursToDaysAndHours(hours);
        modalMessage.textContent = 'Disable notifications for ' + text + '?';
        modal.hidden = false;
    }

    function hideModal() {
        modal.hidden = true;
    }

    function confirmAndSubmit() {
        var hours = range.value;
        try {
            sessionStorage.setItem('disable_notifications_duration_hours', hours);
            sessionStorage.setItem('disable_notifications_duration_display', hoursToDaysAndHours(hours));
        } catch (e) {}
        hideModal();
        form.submit();
    }

    if (range) {
        range.addEventListener('input', updateLabel);
        updateLabel();
    }

    if (confirmBtn) confirmBtn.addEventListener('click', showConfirmation);
    if (modalCancel) modalCancel.addEventListener('click', hideModal);
    if (backdrop) backdrop.addEventListener('click', hideModal);
    if (modalSubmit) modalSubmit.addEventListener('click', confirmAndSubmit);
})();
