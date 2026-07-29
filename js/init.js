

function create_chat_connection(channel_name = '') {

    if (tmi_client) {
        tmi_client.disconnect().catch((err) => console.error('Error disconnecting:', err));
    }

    tmi_client = new tmi.Client({
        channels: [channel_name]
    });

    // Подключаемся
    tmi_client.connect();

    // Слушаем сообщения
    // user — это объект со всей инфой (цвет ника, бейджи, id сообщения и т.д.)
    tmi_client.on('message', async (channel, user, message, self) => {

        // console.log(channel, user, message);

        const color = user['color'] || '#00FF00';
        // const name = user['display-name'];
        // console.log(user['display-name']);

        // проверка на подсказку, дальше не идем
        if (message.toLowerCase().startsWith('!подска') || message.toLowerCase().startsWith('! подска')) {
            if (backend_supports_tips()) use_tip(user['username']);
            return;
        }

        // Проверяем на действия модераторов
        const isModerator =
            user.mod ||
            user.badges?.broadcaster ||
            user.badges?.lead_moderator ||
            user.badges?.moderator;

        const command = message.toLowerCase();

        if (isModerator && !is_game_finished && (command.startsWith('!sres') || command.startsWith('!словотрон-рес'))) {
            is_game_finished = true;
            secret_word_id = await generate_secret_word();
            reset_round();
            sendWebhookEvent('game-new', {
                challenge_id: secret_word_id,
                secret_word: current_secret_word_data?.secret_word || null
            });
            is_game_finished = false;
            return;
        }

        // Проверяем пасхалки
        if (typeof check_easter_egg === 'function' && check_easter_egg(message)) {
            return;
        }

        // если в сообщении больше двух слов, 20 символов, слишком короткое или число, то игнорируем
        if (message.split(' ').length > 1 || message.length > 20 || message.length <= 1 || !isNaN(message)) return;

        // Приводим ЛЕД и ЛЁД к одному виду
        message = message.replace(/ё/gi, 'е');

        // prevent xss attack 
        // числа убираем тоже, потому что апишка контекстно зачем-то считает валидными+однинаковыми и слово СТОЛ и СТОЛ12345 (бредик да)
        message = message.replace(/[^a-zA-Zа-яА-Я]/g, '');

        // а можно вот так, останутся любые буквы любого языка. задел на мультиязычную версию.
        // message = message.replace(/[^\p{L}]/gu, ''); 

        if (message.length < 2) return;

        words_count++;
        if (words_count === 1) {
            document.getElementById('info').style.display = 'none';
            document.getElementById('settings').style.display = 'none';
        }
        wordQueue.push({ 'user': user, 'color': color, 'msg': message })
        if (wordQueue.length === 1) {
            runQueue()
        }
    });

}

async function runQueue() {
    // Always shift the processed item, even if process_message throws.
    // Otherwise the queue stalls forever and chat messages stop being handled.
    while (wordQueue.length > 0) {
        const { user, color, msg } = wordQueue[0];
        try {
            await process_message(user, color, msg);
        } catch (e) {
            console.error('process_message failed:', e);
        } finally {
            wordQueue.shift();
        }
    }
}

// basic app init
async function app() {
    try {
        const ready = loadSettings();

        if (ready) {

            reset_round();

            // получение секретного слова для отгадывания
            secret_word_id = await generate_secret_word();
            console.log('Ключ игры: ', secret_word_id);
            sendWebhookEvent('game-new', {
                challenge_id: secret_word_id,
                secret_word: current_secret_word_data?.secret_word || null
            });

            // подключение к чату твича и начало получения сообщений
            create_chat_connection(channel_name);

            // отправка данных об использовании игры в аналитику
            analytics_set_visit_params({ 'channel_name': channel_name });
            analytics_reach_goal('game_start', { 'channel_name': channel_name });

        } else {
            document.getElementById('settings').style.display = 'block';
            if (game_backend === 'wordgun') loadWordgunOptions();
        }

    } catch (error) {
        console.error(error);
    }
}

app();
