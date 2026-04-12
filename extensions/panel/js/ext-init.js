// ext-init.js — заменяет init.js для Twitch Panel Extension.
// Получает имя канала через Twitch.ext.onAuthorized вместо формы настроек.

// ─── Переиспользуем логику подключения к чату из init.js ─────────────────────
// (скопировано из js/init.js без строк про #info и #settings, которых нет в панели)

function create_chat_connection(channel_name = '') {
    if (tmi_client) {
        tmi_client.disconnect().catch((err) => console.error('Error disconnecting:', err));
    }

    tmi_client = new tmi.Client({
        channels: [channel_name]
    });

    tmi_client.connect();

    tmi_client.on('message', (channel, user, message, self) => {
        const color = user['color'] || '#00FF00';

        // Подсказка
        if (message.toLowerCase().startsWith('!подска') || message.toLowerCase().startsWith('! подска')) {
            use_tip(user['username']);
            return;
        }

        // Пасхалки
        if (typeof check_easter_egg === 'function' && check_easter_egg(message)) {
            return;
        }

        // Фильтрация — несколько слов, числа, длинные/короткие
        if (message.split(' ').length > 1 || message.length > 20 || message.length <= 1 || !isNaN(message)) return;

        // Нормализация ё→е
        message = message.replace(/ё/gi, 'е');

        // Очистка от не-букв
        message = message.replace(/[^a-zA-Zа-яА-Я]/g, '');

        if (message.length < 2) return;

        words_count++;
        wordQueue.push({ 'user': user, 'color': color, 'msg': message });
        if (wordQueue.length === 1) {
            runQueue();
        }
    });
}

function runQueue() {
    process_message(wordQueue[0].user, wordQueue[0].color, wordQueue[0].msg).then(() => {
        wordQueue.shift();
        if (wordQueue.length > 0) {
            runQueue();
        }
    });
}

// ─── Резолв channelId → login через api.ivr.fi ───────────────────────────────

async function resolveChannelName(channelId) {
    try {
        const res = await fetch(`https://api.ivr.fi/v2/twitch/user?id=${channelId}`);
        if (!res.ok) throw new Error(`ivr.fi вернул ${res.status}`);
        const data = await res.json();
        const login = data?.[0]?.login || '';
        if (login) {
            console.log('[ext-init] Канал определён:', login);
            return login;
        }
    } catch (e) {
        console.warn('[ext-init] resolveChannelName через ivr.fi не удался:', e);
    }

    // Fallback: имя канала из конфига стримера (ext-config.js мог его сохранить)
    try {
        const raw = window.Twitch?.ext?.configuration?.broadcaster?.content;
        if (raw) {
            const cfg = JSON.parse(raw);
            if (cfg.channel_name) {
                console.log('[ext-init] Канал из конфига стримера:', cfg.channel_name);
                return cfg.channel_name;
            }
        }
    } catch (e) {
        console.warn('[ext-init] Не удалось прочитать channel_name из конфига:', e);
    }

    return '';
}

// ─── Запуск игры ──────────────────────────────────────────────────────────────

async function ext_app(resolved_channel_name) {
    try {
        loadExtSettings();

        reset_round();

        secret_word_id = await generate_secret_word();
        console.log('[ext-init] ID секретного слова:', secret_word_id);

        if (resolved_channel_name) {
            create_chat_connection(resolved_channel_name);
        } else {
            show_fullscreen_error(
                'Не удалось определить имя канала.<br>' +
                'Стример должен указать его в настройках расширения.'
            );
        }
    } catch (error) {
        console.error('[ext-init] Ошибка запуска:', error);
        show_fullscreen_error('Ошибка запуска игры.<br>Попробуйте обновить страницу.');
    }
}

// ─── Twitch.ext инициализация ─────────────────────────────────────────────────

window.Twitch.ext.onAuthorized(async (auth) => {
    console.log('[ext-init] onAuthorized. channelId:', auth.channelId);

    const resolved = await resolveChannelName(auth.channelId);
    channel_name = resolved;

    ext_app(channel_name);
});

// Если пользователь скрыл панель, а потом открыл её снова после победы — запускаем перезапуск
window.Twitch.ext.onVisibilityChanged((isVisible) => {
    if (isVisible && is_game_finished && resetTimerPaused) {
        console.log('[ext-init] Панель стала видимой после паузы — запускаю перезапуск раунда');
        resetRoundTimeout(0);
        resetTimerPaused = false;
    }
});
