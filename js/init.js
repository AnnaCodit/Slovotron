

let secret_word_id = '';
let words_count = 0;
let tmi_client = null;

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

        // если в сообщении больше двух слов то игнорируем
        if (message.split(' ').length > 2) return;

        // prevent xss attack from message
        message = message.replace(/[^a-zA-Zа-яА-ЯёЁ0-9]/g, '');
        message = message.replace(/ё/g, 'е');

        words_count++;
        if (words_count === 1) {
            document.getElementById('info').style.display = 'none';
        }
        process_message(user, color, message);
    });

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
            localStorage.setItem('channel_name', channelInput.value.trim());
        }

        if (restartInput && restartInput.value) {
            localStorage.setItem('restart_time', restartInput.value.trim());
        }

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


// Event Listeners for Leaderboard
const leaderboardBtn = document.getElementById('menu-button-leaderboard');
if (leaderboardBtn) {
    leaderboardBtn.addEventListener('click', () => {
        const leaderboardSection = document.getElementById('leaderboard');
        // Toggle display
        const isVisible = leaderboardSection.style.display !== 'none';
        leaderboardSection.style.display = isVisible ? 'none' : 'flex';

        if (!isVisible) {
            renderLeaderboard();
        }
    });
}

const resetLeaderboardBtn = document.getElementById('reset-leaderboard-btn');
if (resetLeaderboardBtn) {
    resetLeaderboardBtn.addEventListener('click', resetLeaderboard);
}

// basic app init
async function app() {
    try {
        const ready = loadSettings();

        if (ready) {
            document.getElementById('settings').style.display = 'none';
            reset_round();
            secret_word_id = await generate_secret_word();
            console.log('ID секрутного слова: ', secret_word_id);
            create_chat_connection(channel_name);
        } else {
            document.getElementById('settings').style.display = 'block';
        }

        // initMenu();
        // const data = await getData();
        // renderChallenge(data);
    } catch (error) {
        console.error(error);
    }
}

app();
