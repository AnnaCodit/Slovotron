// ext-config.js — логика страницы config.html (настройки стримера).
// Сохраняет настройки через Twitch.ext.configuration.set('broadcaster', ...)

window.Twitch.ext.onAuthorized(() => {
    // Загружаем текущие сохранённые настройки в форму
    try {
        const raw = window.Twitch.ext.configuration.broadcaster?.content;
        if (raw) {
            const cfg = JSON.parse(raw);
            if (cfg.restart_time !== undefined) {
                document.getElementById('restart-time').value = cfg.restart_time;
            }
            if (cfg.win_avatar_enable !== undefined) {
                document.getElementById('win-avatar-enable').checked = cfg.win_avatar_enable;
            }
            if (cfg.sound_enable !== undefined) {
                document.getElementById('sound-enable').checked = cfg.sound_enable;
            }
            if (cfg.channel_name) {
                document.getElementById('channel-name').value = cfg.channel_name;
            }
        }
    } catch (e) {
        console.warn('[ext-config] Не удалось загрузить конфиг:', e);
    }
});

document.getElementById('save-btn').addEventListener('click', () => {
    const cfg = {
        restart_time: parseInt(document.getElementById('restart-time').value, 10) || 20,
        win_avatar_enable: document.getElementById('win-avatar-enable').checked,
        sound_enable: document.getElementById('sound-enable').checked,
        channel_name: document.getElementById('channel-name').value.trim().toLowerCase(),
    };

    window.Twitch.ext.configuration.set('broadcaster', '1', JSON.stringify(cfg));

    const btn = document.getElementById('save-btn');
    btn.textContent = 'Сохранено ✓';
    btn.disabled = true;
    setTimeout(() => {
        btn.textContent = 'Сохранить';
        btn.disabled = false;
    }, 2000);
});

// Разблокируем кнопку при любом изменении
document.querySelectorAll('input').forEach(el => {
    el.addEventListener('input', () => {
        document.getElementById('save-btn').disabled = false;
    });
});
