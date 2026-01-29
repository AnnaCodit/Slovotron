

let secret_word_id = '';
let words_count = 0;
let tmi_client = null;
let wordQueue = [];

async function generate_secret_word() {
    const data = await kontekstno_query('random-challenge');
    room_id = data.id;
    return room_id;
}

async function kontekstno_query(method = '', word = '', challenge_id = '') {

    let url = '';
    // console.log(method);

    if (method == 'random-challenge') {
        url = "https://xn--80aqu.xn--e1ajbkccewgd.xn--p1ai/" + method;
    }

    if (method == 'score') {
        url = "https://апи.контекстно.рф/score?challenge_id=" + challenge_id + "&word=" + word + "&challenge_type=random";
    }

    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Response status: ${response.status}`);
    }

    return await response.json();
}

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
        // const name = tags['display-name'];

        // если в сообщении больше двух слов, 20 символов
        // слишком короткое или число, то игнорируем
        if (message.split(' ').length > 1 || message.length > 20 || message.length === 1 || !isNaN(message)) return;

        // prevent xss attack from message
        message = message.replace(/[^a-zA-Zа-яА-ЯёЁ0-9]/g, '');
        message = message.replace(/ё/g, 'е');

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

function loadSettings() {
    const storedChannel = localStorage.getItem('channel_name');
    const storedRestartTime = localStorage.getItem('restart_time');

    if (storedChannel) {
        channel_name = storedChannel;
        const channelInput = document.getElementById('channel-name');
        if (channelInput) channelInput.value = channel_name;
    }

    if (storedRestartTime) {
        restart_time = parseInt(storedRestartTime, 10);
        const restartInput = document.getElementById('restart-time');
        if (restartInput) restartInput.value = restart_time;
    }

    return !!channel_name;
}

const saveBtn = document.getElementById('save-settings-btn');
if (saveBtn) {
    saveBtn.addEventListener('click', () => {
        const channelInput = document.getElementById('channel-name');
        const restartInput = document.getElementById('restart-time');

        if (channelInput && channelInput.value) {
            let channelName = channelInput.value.trim();
            if (channelName.includes('twitch.tv/')) {
                const parts = channelName.split('twitch.tv/');
                if (parts.length > 1) {
                    channelName = parts[1].split('/')[0].split('?')[0];
                    channelInput.value = channelName;
                }
            }
            localStorage.setItem('channel_name', channelName);
        }

        if (restartInput && restartInput.value) {
            localStorage.setItem('restart_time', restartInput.value.trim());
        }

        // скрываем блок настроек после сохранения для визуальной индикации успешного сохранения. возможно добавить тост всплавающий? возможно галочку рядом на секунду показывать?
        document.getElementById('settings').style.display = 'none';

        app();
    });
}

async function getTwitchUserData(username) {
    try {
        const response = await fetch(`https://api.ivr.fi/v2/twitch/user?login=${username}`);
        const data = await response.json();

        if (data && data[0]) {
            return data[0];
        } else {
            console.error("Пользователь не найден");
            return null;
        }
    } catch (error) {
        console.error("Ошибка запроса:", error);
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
