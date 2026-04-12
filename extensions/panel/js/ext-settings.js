// ext-settings.js — заменяет settings.js для Twitch Panel Extension.
// Читает настройки из Twitch.ext.configuration (конфиг стримера),
// а при их отсутствии использует localStorage как fallback.

function loadExtSettings() {
    let cfg = {};

    try {
        const raw = window.Twitch?.ext?.configuration?.broadcaster?.content;
        if (raw) cfg = JSON.parse(raw);
    } catch (e) {
        console.warn('[ext-settings] Не удалось разобрать конфиг из Twitch.ext.configuration:', e);
    }

    // Применяем настройки: приоритет — Twitch config, fallback — localStorage
    restart_time = cfg.restart_time !== undefined
        ? parseInt(cfg.restart_time, 10)
        : parseInt(localStorage.getItem('restart_time') ?? '20', 10);

    win_avatar_enable = cfg.win_avatar_enable !== undefined
        ? Boolean(cfg.win_avatar_enable)
        : (localStorage.getItem('win_avatar_enable') === 'true');

    sound_enable = cfg.sound_enable !== undefined
        ? Boolean(cfg.sound_enable)
        : (localStorage.getItem('sound_enable') !== 'false');

    console.log('[ext-settings] Настройки загружены:', { restart_time, win_avatar_enable, sound_enable });
}

// Реагируем на изменения конфига стримера в реальном времени
if (window.Twitch?.ext?.configuration) {
    window.Twitch.ext.configuration.onChanged(() => {
        console.log('[ext-settings] Конфиг стримера обновился, перезагружаю настройки...');
        loadExtSettings();
    });
}
