

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
    tmi_client.on('message', (channel, user, message, self) => {

        // console.log(channel, user, message);

        const color = user['color'] || '#00FF00';
        // const name = user['display-name'];
        // console.log(user['display-name']);

        // проверка на подсказку, дальше не идем
        if (message.toLowerCase().startsWith('!подска') || message.toLowerCase().startsWith('! подска')) {
            use_tip(user['username']);
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
    await process_message(wordQueue[0].user, wordQueue[0].color, wordQueue[0].msg)
    wordQueue.shift()
    if (wordQueue.length > 0) {
        runQueue()
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
            console.log('ID секретного слова: ', secret_word_id);

            // подключение к чату твича и начало получения сообщений
            create_chat_connection(channel_name);

            // отправка данных об использовании игры в аналитику
            analytics_set_visit_params({ 'channel_name': channel_name });
            analytics_reach_goal('game_start', { 'channel_name': channel_name });

        } else {
            document.getElementById('settings').style.display = 'block';
        }

    } catch (error) {
        console.error(error);
    }
}

app();
