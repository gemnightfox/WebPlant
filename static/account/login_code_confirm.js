(function () {
    var form = document.querySelector('.Account-form');
    if (!form) return;

    var mobileMediaQuery = window.matchMedia('(max-width: 600px)');
    var hiddenCodeInput = form.querySelector('#id_code');
    var segmentInputs = Array.prototype.slice.call(form.querySelectorAll('[data-code-segment]'));
    var singleInput = form.querySelector('[data-code-single]');
    if (!hiddenCodeInput || segmentInputs.length !== 4 || !singleInput) return;

    function normalize(value) {
        return (value || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    }

    function syncHiddenCode() {
        hiddenCodeInput.value = segmentInputs.map(function (input) {
            return normalize(input.value).slice(0, 4);
        }).join('');
    }

    function setSegmentsFromString(raw) {
        var normalized = normalize(raw).slice(0, 16);
        for (var i = 0; i < segmentInputs.length; i += 1) {
            segmentInputs[i].value = normalized.slice(i * 4, (i + 1) * 4);
        }
        singleInput.value = normalized;
        syncHiddenCode();
    }

    function syncFromSingle() {
        var normalized = normalize(singleInput.value).slice(0, 16);
        singleInput.value = normalized;
        for (var i = 0; i < segmentInputs.length; i += 1) {
            segmentInputs[i].value = normalized.slice(i * 4, (i + 1) * 4);
        }
        hiddenCodeInput.value = normalized;
    }

    function applyResponsiveMode() {
        var mobile = mobileMediaQuery.matches;
        segmentInputs.forEach(function (input) {
            input.disabled = mobile;
            input.required = !mobile;
        });
        singleInput.disabled = !mobile;
        singleInput.required = mobile;

        if (mobile) {
            syncFromSingle();
        } else {
            setSegmentsFromString(hiddenCodeInput.value);
        }
    }

    segmentInputs.forEach(function (input, index) {
        input.addEventListener('input', function () {
            var cleaned = normalize(input.value).slice(0, 4);
            input.value = cleaned;
            syncHiddenCode();

            if (cleaned.length === 4 && index < segmentInputs.length - 1) {
                segmentInputs[index + 1].focus();
                segmentInputs[index + 1].select();
            }
        });

        input.addEventListener('keydown', function (event) {
            if (event.key === 'Backspace' && input.value.length === 0 && index > 0) {
                segmentInputs[index - 1].focus();
                segmentInputs[index - 1].setSelectionRange(4, 4);
            }
        });

        input.addEventListener('paste', function (event) {
            var pasted = event.clipboardData && event.clipboardData.getData('text');
            if (!pasted) return;
            event.preventDefault();

            var all = segmentInputs.map(function (node) { return node.value; }).join('');
            var before = all.slice(0, index * 4);
            setSegmentsFromString(before + pasted);

            var targetIndex = Math.min(Math.floor(normalize(before + pasted).length / 4), 3);
            segmentInputs[targetIndex].focus();
            segmentInputs[targetIndex].select();
        });
    });

    singleInput.addEventListener('input', function () {
        syncFromSingle();
    });

    mobileMediaQuery.addEventListener('change', function () {
        applyResponsiveMode();
    });

    form.addEventListener('submit', function () {
        if (mobileMediaQuery.matches) {
            syncFromSingle();
            return;
        }
        syncHiddenCode();
    });

    setSegmentsFromString(hiddenCodeInput.value);
    applyResponsiveMode();
}());
