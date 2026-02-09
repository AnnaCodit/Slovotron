

let secret_word_id = '';
let words_count = 0;
let tmi_client = null;
let wordQueue = [];
let win_avatar_enable = false;

async function generate_secret_word() {
    const data = await kontekstno_query({ method: 'random-challenge' });
    room_id = data.id;
    return room_id;
}

async function kontekstno_query({
    method = '',
    word = '',
    challenge_id = '',
    last_word_rank = 0
} = {}) {

    const BASE_DOMAIN = 'https://xn--80aqu.xn--e1ajbkccewgd.xn--p1ai/';

    // 1. Создаем объект URL. Он сам склеит домен и метод правильно.
    // Если method пустой, просто будет запрос на корень, можно добавить проверку при желании.
    const url = new URL(method, BASE_DOMAIN);

    // 2. Добавляем параметры в зависимости от метода
    if (method === 'score') {
        url.searchParams.append('challenge_id', challenge_id);
        url.searchParams.append('word', word);
        url.searchParams.append('challenge_type', 'random');
    }
    else if (method === 'tip') {
        url.searchParams.append('challenge_id', challenge_id);
        url.searchParams.append('last_word_rank', last_word_rank);
        url.searchParams.append('challenge_type', 'random');
    }
    // Для 'random-challenge' параметры не нужны, url остается чистым

    // 3. Делаем запрос
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
        // const name = user['display-name'];
        // console.log(user['display-name']);

        // если в сообщении больше двух слов, 20 символов, слишком короткое или число, то игнорируем
        if (message.split(' ').length > 1 || message.length > 20 || message.length <= 1 || !isNaN(message)) return;

        // проверка на подсказку, дальше не идем
        if (message.toLowerCase().startsWith('!подсказка')) {
            use_tip(message, user['username']);
            return;
        }

        // prevent xss attack from message
        message = message.replace(/[^a-zA-Zа-яА-ЯёЁ0-9]/g, '');
        if (message.length < 2) return;

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
    const storedAvatarInput = localStorage.getItem('win_avatar_enable');

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

    if (storedAvatarInput) {
        win_avatar_enable = JSON.parse(storedAvatarInput);
        const avatarInput = document.getElementById('win-avatar-enable');
        if (avatarInput) avatarInput.checked = win_avatar_enable;
    }

    return !!channel_name;
}

const saveBtn = document.getElementById('save-settings-btn');
if (saveBtn) {
    saveBtn.addEventListener('click', () => {
        const channelInput = document.getElementById('channel-name');
        const restartInput = document.getElementById('restart-time');
        const avatarInput = document.getElementById('win-avatar-enable');

        if (channelInput && channelInput.value) {
            localStorage.setItem('channel_name', channelInput.value.trim());
        }

        if (restartInput && restartInput.value) {
            localStorage.setItem('restart_time', restartInput.value.trim());
        }

        if (avatarInput) {
            localStorage.setItem('win_avatar_enable', avatarInput.checked);
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

const channelInput = document.getElementById("channel-name");
const restartInput = document.getElementById("restart-time");
const avatarInput = document.getElementById('win-avatar-enable');
let validationTimeout;

function checkFormsValidity() {
    saveBtn.disabled = !channelInput.validity.valid || !restartInput.validity.valid;
}

async function validateTwitchAcc(acc) {
    channelInput.setCustomValidity("Проверяю...");
    channelInput.reportValidity();
    try {
        const user = await getTwitchUserData(acc);
        if (user) {
            document.getElementById('setting-avatar').src = user.logo;
            document.getElementById('setting-avatar').style.display = 'flex';
            channelInput.setCustomValidity("");
        } else {
            document.getElementById('setting-avatar').style.display = 'none';
            channelInput.setCustomValidity("Канал не найден, попробуйте еще раз");
        }
        channelInput.reportValidity();
    } catch (error) {
        console.error("Ошибка при проверке канала:", error);
        document.getElementById('setting-avatar').style.display = 'none';
        channelInput.setCustomValidity("Ошибка при проверке. Попробуйте позже.");
        channelInput.reportValidity();
    }
    checkFormsValidity();
}

channelInput.addEventListener("input", () => {
    document.getElementById('setting-avatar').style.display = 'none';
    checkFormsValidity();

    clearTimeout(validationTimeout);

    let channelName = channelInput.value.trim();
    if (channelName.includes('twitch.tv/')) {
        const parts = channelName.split('twitch.tv/');
        if (parts.length > 1) {
            channelName = parts[1].split('/')[0].split('?')[0];
            channelInput.value = channelName;
        }
    }

    if (channelName.length >= 3) {
        validationTimeout = setTimeout(() => validateTwitchAcc(channelName), 1000);
    } else {
        channelInput.setCustomValidity("Имя канала должно быть не менее 3 символов.");
        checkFormsValidity();
    }
});

restartInput.addEventListener("input", () => {
    restartInput.reportValidity();
    checkFormsValidity();
});

avatarInput.addEventListener("input", () => {
    checkFormsValidity();
});

app();
