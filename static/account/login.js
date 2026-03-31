(function () {
    var form = document.querySelector('.Account-form');
    var submitBtn = document.getElementById('login-submit');

    var dotInterval = null;

    function startLoadingBtn() {
        submitBtn.disabled = true;
        form.querySelectorAll('input:not([type="hidden"])').forEach(function (i) { i.disabled = true; });
        var dots = 0;
        submitBtn.textContent = 'Logging in';
        dotInterval = setInterval(function () {
            dots = (dots + 1) % 4;
            submitBtn.textContent = 'Logging in' + '.'.repeat(dots);
        }, 400);
    }

    function stopLoadingBtn() {
        clearInterval(dotInterval);
        dotInterval = null;
        submitBtn.disabled = false;
        form.querySelectorAll('input:not([type="hidden"])').forEach(function (i) { i.disabled = false; });
        submitBtn.textContent = 'Log in';
    }

    form.querySelectorAll('input').forEach(function (input) {
        input.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
                if (!form.reportValidity()) return;
                e.preventDefault();
                input.blur();
                form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
            }
        });
    });

    form.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!form.reportValidity()) return;
        var formData = new FormData(form);
        if (document.activeElement) document.activeElement.blur();
        startLoadingBtn();

        fetch(form.action, {
            method: 'POST',
            body: formData,
            redirect: 'follow',
        }).then(function (response) {
            // allauth returns a 3xx redirect on success; fetch follows it and sets response.redirected
            if (response.redirected) {
                window.location.href = response.url;
                return;
            }

            // 200 means the form was re-rendered with validation errors
            return response.text().then(function (html) {
                var doc = new DOMParser().parseFromString(html, 'text/html');

                // Sync non-field errors
                var newNonField = doc.querySelector('.Account-errors');
                var existingNonField = document.querySelector('.Account-errors');
                if (newNonField) {
                    if (existingNonField) {
                        existingNonField.innerHTML = newNonField.innerHTML;
                    } else {
                        form.insertAdjacentElement('beforebegin', newNonField.cloneNode(true));
                    }
                } else if (existingNonField) {
                    existingNonField.remove();
                }

                // Sync per-field errors
                ['login', 'password'].forEach(function (name) {
                    var input = form.querySelector('[name="' + name + '"]');
                    if (!input) return;
                    var newInput = doc.querySelector('[name="' + name + '"]');
                    var newErr = newInput && newInput.parentElement.querySelector('.Account-field-error');
                    var existingErr = input.parentElement.querySelector('.Account-field-error');

                    if (newErr) {
                        input.classList.add('Account-input--error');
                        if (existingErr) {
                            existingErr.textContent = newErr.textContent;
                        } else {
                            input.insertAdjacentElement('afterend', newErr.cloneNode(true));
                        }
                    } else {
                        input.classList.remove('Account-input--error');
                        if (existingErr) existingErr.remove();
                    }
                });

                stopLoadingBtn();
            });
        });
    });
}());
