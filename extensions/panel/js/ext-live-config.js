// ext-live-config.js — логика страницы стримера (live_config.html).
// Запускает игру, подключается к чату, транслирует состояние зрителям
// через Twitch.ext.configuration.set('broadcaster', ...).

// ─── Состояние ────────────────────────────────────────────────────────────

let currentWinner = null;
let broadcastTimer = null;
const BROADCAST_DEBOUNCE_MS = 3000; // не чаще раза в 3 секунды

// ─── Резолв channelId → login ──────────────────────────────────────────────

async function resolveChannelName(channelId) {
    // Для локального теста: добавь ?channel=имя_канала в URL
    const urlChannel = new URLSearchParams(location.search).get('channel');
    if (urlChannel) {
        console.log('[live-config] Канал из URL-параметра:', urlChannel);
        return urlChannel.toLowerCase().trim();
    }

    try {
        const res = await fetch(`https://api.ivr.fi/v2/twitch/user?id=${channelId}`);
        if (!res.ok) throw new Error(`ivr.fi ${res.status}`);
        const data = await res.json();
        const login = data?.[0]?.login || '';
        if (login) {
            console.log('[live-config] Канал:', login);
            return login;
        }
    } catch (e) {
        console.warn('[live-config] resolveChannelName не удался:', e);
    }

    // Fallback: имя из конфига стримера (ext-config.js мог его сохранить)
    try {
        const raw = window.Twitch?.ext?.configuration?.broadcaster?.content;
        if (raw) {
            const cfg = JSON.parse(raw);
            if (cfg.channel_name) return cfg.channel_name;
        }
    } catch (e) { /* игнорируем */ }

    return '';
}

// ─── Чтение топ-3 из DOM ──────────────────────────────────────────────────

function getTop3FromDOM() {
    const container = document.querySelector('.guessing .best-match');
    if (!container) return [];

    return Array.from(container.children)
        .slice(0, 3)
        .map(el => ({
            word: el.querySelector('.word')?.textContent?.toLowerCase() || '',
            distance: parseFloat(el.dataset.distance || '9999')
        }))
        .filter(item => item.word && item.distance < 9999);
}

// ─── Трансляция состояния → все viewer-панели ──────────────────────────────

function broadcastGameState() {
    const state = {
        challenge_id: secret_word_id,
        top3: getTop3FromDOM(),
        status: is_game_finished ? 'won' : 'active',
        winner: currentWinner || null
    };

    try {
        window.Twitch.ext.configuration.set('broadcaster', '1', JSON.stringify(state));
        console.log('[live-config] Broadcast:', state);
    } catch (e) {
        console.error('[live-config] Ошибка broadcast:', e);
    }
}

// Debounced — вызываем после каждого слова, но не чаще 1 раза в 3 сек
function debouncedBroadcast() {
    clearTimeout(broadcastTimer);
    broadcastTimer = setTimeout(broadcastGameState, BROADCAST_DEBOUNCE_MS);
}

// Немедленная трансляция — при старте/победе/сбросе
function immediateBroadcast() {
    clearTimeout(broadcastTimer);
    broadcastGameState();
}

// ─── Подключение к чату ────────────────────────────────────────────────────
// (аналог create_chat_connection из init.js, без ссылок на #info/#settings)

function create_chat_connection(ch_name) {
    if (tmi_client) {
        tmi_client.disconnect().catch(err => console.error('TMI disconnect error:', err));
    }

    tmi_client = new tmi.Client({ channels: [ch_name] });
    tmi_client.connect();

    tmi_client.on('message', (_channel, user, message, _self) => {
        const color = user['color'] || '#00FF00';

        if (message.toLowerCase().startsWith('!подска') || message.toLowerCase().startsWith('! подска')) {
            use_tip(user['username']);
            return;
        }

        if (typeof check_easter_egg === 'function' && check_easter_egg(message)) return;

        if (message.split(' ').length > 1 || message.length > 20 || message.length <= 1 || !isNaN(message)) return;

        message = message.replace(/ё/gi, 'е').replace(/[^a-zA-Zа-яА-Я]/g, '');

        if (message.length < 2) return;

        words_count++;
        wordQueue.push({ 'user': user, 'color': color, 'msg': message });
        if (wordQueue.length === 1) runQueue();
    });
}

function runQueue() {
    process_message(wordQueue[0].user, wordQueue[0].color, wordQueue[0].msg).then(() => {
        wordQueue.shift();
        if (wordQueue.length > 0) runQueue();
    });
}

// ─── Перехват process_message для broadcast после каждого слова ──────────

// Ждём загрузки ws.js, затем оборачиваем process_message
document.addEventListener('DOMContentLoaded', () => {
    const _orig = window['process_message'];
    if (typeof _orig === 'function') {
        window['process_message'] = async (...args) => {
            await _orig(...args);
            debouncedBroadcast();
        };
    }

    // Перехват handle_win для немедленного broadcast с именем победителя
    const _origWin = window.handle_win;
    if (typeof _origWin === 'function') {
        window.handle_win = (winner_user) => {
            currentWinner = winner_user?.['display-name'] || winner_user?.username || null;
            _origWin(winner_user);
            immediateBroadcast();
        };
    }

    // Перехват reset_round — немедленный broadcast нового состояния
    const _origReset = window.reset_round;
    if (typeof _origReset === 'function') {
        window.reset_round = () => {
            currentWinner = null;
            _origReset();
            immediateBroadcast();
        };
    }
});

// ─── Слова из viewer panel (localStorage-мост, только локальное тестирование) ─

window.addEventListener('storage', (e) => {
    if (e.key !== 'slovotron_panel_word' || !e.newValue) return;
    try {
        const { word } = JSON.parse(e.newValue);
        if (!word) return;
        const panelUser = { username: 'зритель', color: '#9147ff', 'display-name': 'Зритель' };
        wordQueue.push({ user: panelUser, color: '#9147ff', msg: word });
        if (wordQueue.length === 1) runQueue();
    } catch (_) {}
});

// ─── Основной запуск ──────────────────────────────────────────────────────

async function liveConfigApp(resolved_channel_name) {
    try {
        loadExtSettings();

        reset_round();

        secret_word_id = await generate_secret_word();
        console.log('[live-config] ID секретного слова:', secret_word_id);

        immediateBroadcast();

        if (resolved_channel_name) {
            create_chat_connection(resolved_channel_name);
        } else {
            show_fullscreen_error(
                'Не удалось определить имя канала.<br>' +
                'Укажите его в настройках расширения.'
            );
        }
    } catch (error) {
        console.error('[live-config] Ошибка запуска:', error);
        show_fullscreen_error('Ошибка запуска игры.<br>Попробуйте обновить страницу.');
    }
}

// ─── PubSub: слова от зрителей через EBS (продакшн) ──────────────────────

window.Twitch.ext.listen('broadcast', (_target, _contentType, message) => {
    try {
        const data = JSON.parse(message);
        if (data.type !== 'word' || !data.word) return;
        const panelUser = { username: 'зритель', color: '#9147ff', 'display-name': 'Зритель' };
        wordQueue.push({ user: panelUser, color: '#9147ff', msg: data.word });
        if (wordQueue.length === 1) runQueue();
    } catch (_) {}
});

// ─── Twitch.ext инициализация ─────────────────────────────────────────────

window.Twitch.ext.onAuthorized(async (auth) => {
    console.log('[live-config] onAuthorized. channelId:', auth.channelId);
    const resolved = await resolveChannelName(auth.channelId);
    channel_name = resolved;
    liveConfigApp(channel_name);
});

window.Twitch.ext.onVisibilityChanged((isVisible) => {
    if (isVisible && is_game_finished && resetTimerPaused) {
        resetRoundTimeout(0);
        resetTimerPaused = false;
    }
});
