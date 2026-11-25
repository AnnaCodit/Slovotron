let streamerUser = null;
let app_init_gen = 0;

function disconnect_chat_connection() {
    if (tmi_client) {
        const prevClient = tmi_client;
        tmi_client = null;
        prevClient.disconnect().catch((err) => console.error('Error disconnecting:', err));
    }
}

function create_chat_connection(channelName = '') {

    disconnect_chat_connection();

    const client = new tmi.Client({
        channels: [channelName]
    });
    tmi_client = client;

    // Слушаем сообщения
    // user — это объект со всей инфой (цвет ника, бейджи, id сообщения и т.д.)
    client.on('message', async (channel, user, message, self) => {
        if (client !== tmi_client) return;

        if (user.badges?.broadcaster && user.username?.toLowerCase() === channel_name.toLowerCase()) {
            streamerUser = { ...streamerUser, ...user };
        }

        // console.log(channel, user, message);

        const color = user['color'] || '#00FF00';
        // const name = user['display-name'];
        // console.log(user['display-name']);

        // проверка на подсказку, дальше не идем
        if (handle_tip_command(message, user['username'])) return;

        // Проверяем на действия модераторов
        const isModerator =
            user.mod ||
            user.badges?.broadcaster ||
            user.badges?.lead_moderator ||
            user.badges?.moderator;

        const command = message.trim().toLowerCase();
        if (['!слв-топ', '!словотрон-топ'].includes(command)) {
            showLeaderboardTemporarily();
            return;
        }

        const moderatorTipCommands = [
            '!словотрон-подсказка',
            '!слв-подсказка',
            '!slovotron-hint',
            '!slv-hint'
        ];

        if (isModerator && !is_game_finished && moderatorTipCommands.includes(command)) {
            if (backend_supports_tips()) use_tip(user['username'], true);
            return;
        }

        if (isModerator && (command.startsWith('!sres') || command.startsWith('!словотрон-рестарт') || command.startsWith('!слв-рестарт') || command.startsWith('!слв-рес'))) {
            await start_new_round();
            return;
        }

        // Проверяем пасхалки
        if (typeof check_easter_egg === 'function' && check_easter_egg(message)) {
            return;
        }

        enqueue_guess(user, color, message);
    });

    // Подключаемся
    return client.connect();
}

function handle_tip_command(message = '', username = '') {
    if (typeof message !== 'string') return false;

    const command = message.toLowerCase();
    if (!command.startsWith('!подска') && !command.startsWith('! подска')) return false;

    if (backend_supports_tips()) use_tip(username);
    return true;
}

function normalize_guess(message = '') {
    if (typeof message !== 'string') return '';
    message = message.trim();

    // если в сообщении больше двух слов, 20 символов, слишком короткое или число, то игнорируем
    if (message.split(/\s+/).length > 1 || message.length > 20 || message.length <= 1 || !isNaN(message)) return '';

    // Приводим ЛЕД и ЛЁД к одному виду
    message = message.replace(/ё/gi, 'е');

    // prevent xss attack
    // числа убираем тоже, потому что апишка контекстно зачем-то считает валидными+однинаковыми и слово СТОЛ и СТОЛ12345 (бредик да)
    message = message.replace(/[^a-zA-Zа-яА-Я\-]/g, '');

    // а можно вот так, останутся любые буквы любого языка. задел на мультиязычную версию.
    // message = message.replace(/[^\p{L}]/gu, '');

    return message.length >= 2 ? message : '';
}

function enqueue_guess(user, color, message) {
    if (is_game_finished) return false;
    const normalizedMessage = normalize_guess(message);
    if (!normalizedMessage) return false;

    words_count++;
    if (words_count === 1) {
        document.getElementById('info').style.display = 'none';
        document.getElementById('settings').style.display = 'none';
    }
    const gameId = typeof secret_word_id !== 'undefined' ? secret_word_id : '';
    const roundGen = typeof round_start_gen === 'number' ? round_start_gen : 0;
    wordQueue.push({ 'user': user, 'color': color, 'msg': normalizedMessage, 'gameId': gameId, 'roundGen': roundGen });
    if (wordQueue.length === 1) {
        runQueue();
    }
    return true;
}

async function runQueue() {
    // Always shift the processed item, even if process_message throws.
    // Otherwise the queue stalls forever and chat messages stop being handled.
    while (wordQueue.length > 0) {
        const { user, color, msg, gameId, roundGen } = wordQueue[0];
        try {
            await process_message(user, color, msg, false, gameId, roundGen);
        } catch (e) {
            console.error('process_message failed:', e);
        } finally {
            wordQueue.shift();
        }
    }
}

// basic app init
async function app() {
    const currentAppGen = ++app_init_gen;
    try {
        disconnect_chat_connection();
        setManualGuessReady(false);
        streamerUser = null;
        const ready = loadSettings();

        if (ready) {
            // получение секретного слова и данных стримера параллельно
            const roundPromise = start_new_round({ openRound: false });
            const expectedRoundGen = typeof round_start_gen === 'number' ? round_start_gen : 0;
            const [roundStarted, twitchUser] = await Promise.all([
                roundPromise,
                getTwitchUserData(channel_name).catch(e => {
                    console.warn('Не удалось получить данные стримера для аналитики:', e);
                    return null;
                })
            ]);

            if (currentAppGen !== app_init_gen) return;

            if (twitchUser) {
                streamerUser = {
                    username: twitchUser.login || channel_name,
                    'display-name': twitchUser.displayName || channel_name,
                    'user-id': twitchUser.id
                };
            }

            if (roundStarted) {
                open_prepared_round(expectedRoundGen);
            }

            // подключение к чату твича и начало получения сообщений
            await create_chat_connection(channel_name).catch(e => {
                console.warn('Не удалось дождаться подключения к чату Twitch:', e);
            });

            if (currentAppGen !== app_init_gen || !roundStarted) return;

            try {
                // TwitchTracker считает средний онлайн за последние 30 дней.
                // Получаем его один раз за игровую сессию, после подключения к чату.
                const twitchTrackerSummary = await getTwitchTrackerChannelSummary(channel_name);

                if (currentAppGen !== app_init_gen) return;

                // отправка данных об использовании игры в аналитику
                const is_obs = document.body.classList.contains('obs-overlay') ? 1 : 0;
                const startParams = {
                    channel_name: channel_name,
                    followers: typeof twitchUser?.followers === 'number' ? twitchUser.followers : 0,
                    chatterCount: typeof twitchUser?.chatterCount === 'number' ? twitchUser.chatterCount : 0,
                    is_obs: is_obs,
                    game_backend: game_backend
                };

                if (typeof twitchTrackerSummary?.avg_viewers === 'number') {
                    startParams.avg_viewers = twitchTrackerSummary.avg_viewers;
                }

                if (typeof analytics_set_visit_params === 'function') {
                    analytics_set_visit_params(startParams);
                }
                if (typeof analytics_reach_goal === 'function') {
                    analytics_reach_goal('game_start', startParams);
                }
            } catch (analyticsError) {
                console.warn('Не удалось отправить события аналитики:', analyticsError);
            }

        } else {
            if (typeof cancel_round_restart_timers === 'function') cancel_round_restart_timers();
            if (typeof round_start_gen === 'number') round_start_gen++;
            is_game_finished = true;
            setManualGuessReady(false);
            document.getElementById('settings').style.display = 'block';
            if (game_backend === 'wordgun') loadWordgunOptions();
        }

    } catch (error) {
        setManualGuessReady(false);
        console.error(error);
    }
}

const manualGuessForm = document.getElementById('manual-guess-form');
const manualGuessInput = document.getElementById('manual-guess-input');

if (manualGuessForm && manualGuessInput) {
    manualGuessForm.addEventListener('submit', (event) => {
        event.preventDefault();
        manualGuessInput.setCustomValidity('');

        if (!manual_guess_ready || is_game_finished) {
            manualGuessInput.setCustomValidity('Дождитесь начала следующего раунда.');
            manualGuessInput.reportValidity();
            return;
        }

        const streamer = streamerUser
            ? { ...streamerUser }
            : { username: channel_name, 'display-name': channel_name };
        const message = manualGuessInput.value;

        if (handle_tip_command(message, streamer.username)) {
            manualGuessInput.value = '';
            manualGuessInput.focus();
            return;
        }

        if (!enqueue_guess(streamer, '#00FF00', message)) {
            manualGuessInput.setCustomValidity('Введите одно слово от 2 до 20 букв.');
            manualGuessInput.reportValidity();
            return;
        }

        manualGuessInput.value = '';
        manualGuessInput.focus();
    });

    manualGuessInput.addEventListener('input', () => {
        manualGuessInput.setCustomValidity('');
    });
}

app();
