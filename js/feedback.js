(() => {
    const endpoint = 'https://slovotron-backend.fra3a.ru/api/v1/feedback';
    const button = document.getElementById('feedback-button');
    const dialog = document.getElementById('feedback-dialog');
    const form = document.getElementById('feedback-form');
    const message = document.getElementById('feedback-message');
    const submit = document.getElementById('feedback-submit');
    const status = document.getElementById('feedback-status');
    const counter = document.getElementById('feedback-counter');
    let sending = false;
    let nextAllowedAt = 0;
    let cooldownTimer;

    function setStatus(text, state = '') {
        status.textContent = text;
        status.dataset.state = state;
    }

    function updateForm() {
        const seconds = Math.max(0, Math.ceil((nextAllowedAt - Date.now()) / 1000));
        counter.textContent = `${message.value.length} / 3000`;
        submit.disabled = sending || seconds > 0 || !message.value.trim() || message.value.length > 3000;
        submit.textContent = sending ? 'Отправляю…' : seconds > 0 ? `Отправить через ${seconds} с` : 'Отправить';
        message.readOnly = sending;
        form.setAttribute('aria-busy', String(sending));
        if (!seconds) clearInterval(cooldownTimer);
    }

    function startCooldown(seconds) {
        nextAllowedAt = Date.now() + seconds * 1000;
        clearInterval(cooldownTimer);
        cooldownTimer = setInterval(updateForm, 250);
        updateForm();
    }

    button.addEventListener('click', () => {
        if (!dialog.open) {
            if (!sending) setStatus('');
            dialog.showModal();
            message.focus();
            updateForm();
        }
    });
    document.getElementById('feedback-close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => button.focus());

    // Close only when both ends of the click are on the backdrop, not while selecting text.
    let backdropPressed = false;
    function isBackdrop(event) {
        const rect = dialog.getBoundingClientRect();
        return event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right
            || event.clientY < rect.top || event.clientY > rect.bottom);
    }
    dialog.addEventListener('pointerdown', event => { backdropPressed = isBackdrop(event); });
    dialog.addEventListener('click', event => {
        if (backdropPressed && isBackdrop(event)) dialog.close();
        backdropPressed = false;
    });

    message.addEventListener('input', () => {
        message.setCustomValidity('');
        setStatus('');
        updateForm();
    });

    form.addEventListener('submit', async event => {
        event.preventDefault();
        if (sending || Date.now() < nextAllowedAt) return;
        const text = message.value.trim();
        if (!text || message.value.length > 3000) {
            message.setCustomValidity('Напишите сообщение от 1 до 3000 символов.');
            message.reportValidity();
            return;
        }

        sending = true;
        setStatus('');
        updateForm();
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 20000);
        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ message: text }),
                signal: controller.signal
            });
            let data = null;
            try { data = await response.json(); } catch { }

            if (response.status === 429) {
                const retryAfter = Number(data?.retry_after || response.headers.get('Retry-After'));
                const seconds = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.ceil(retryAfter) : 10;
                startCooldown(seconds);
                setStatus('Сообщения отправляются слишком часто. Подождите немного и попробуйте ещё раз.', 'error');
            } else if (!response.ok || data?.status !== 'sent') {
                setStatus(response.status === 422
                    ? 'Сообщение слишком длинное. Сократите его до 3000 символов.'
                    : 'Не удалось отправить сообщение. Попробуйте чуть позже.', 'error');
            } else {
                message.value = '';
                setStatus('Спасибо! Сообщение отправлено 💚', 'success');
                startCooldown(10);
            }
        } catch (error) {
            setStatus(error.name === 'AbortError'
                ? 'Не удалось дождаться подтверждения отправки. Попробуйте чуть позже.'
                : 'Не удалось отправить сообщение. Проверьте подключение и попробуйте ещё раз.', 'error');
        } finally {
            clearTimeout(timeout);
            sending = false;
            updateForm();
        }
    });
})();
