// Соло-режим: игра без Twitch. Открывайте solo.html.
// Вместо init.js: сам инициализирует игру и принимает слова из поля ввода.

const SOLO_USER = { username: 'solo', 'display-name': 'Я' };
const SOLO_COLOR = '#00FF00';

const soloInput = document.getElementById('solo-input');
const soloSubmit = document.getElementById('solo-submit');

async function runQueue() {
    // Always shift the processed item, even if process_message throws.
    // Otherwise the queue stalls forever and guesses stop being handled.
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

// Своя версия app(): те же шаги, что в init.js, но без подключения к Twitch
// и без аналитики. init.js на этой странице не подключён, поэтому его задачу
// выполняет этот файл.
async function app() {
    try {
        loadSettings(); // канал Twitch для соло не обязателен, возвращаемое значение игнорируем

        reset_round();

        // получение секретного слова для отгадывания
        secret_word_id = await generate_secret_word();
        console.log('Ключ игры: ', secret_word_id);
        addTextToLastWords('🎯 Слово загадано! Введите свой вариант ниже');
    } catch (error) {
        console.error(error);
    }
}

function solo_guess() {
    if (is_game_finished) return;

    let message = (soloInput.value || '').trim();
    soloInput.value = '';

    if (!message) return;

    // проверка на подсказку, дальше не идем
    if (message.toLowerCase().startsWith('!подска')) {
        if (backend_supports_tips()) use_tip('', true);
        return;
    }

    // Проверяем пасхалки
    if (typeof check_easter_egg === 'function' && check_easter_egg(message)) {
        return;
    }

    // если больше одного слова, слишком короткое или длинное, или число — игнорируем
    if (message.split(' ').length > 1 || message.length > 20 || message.length <= 1 || !isNaN(message)) {
        addTextToLastWords('Введите одно слово (2–20 букв)');
        return;
    }

    // Приводим ЛЕД и ЛЁД к одному виду
    message = message.replace(/ё/gi, 'е');

    // числа и прочие символы убираем тоже (как в init.js)
    message = message.replace(/[^a-zA-Zа-яА-Я]/g, '');

    if (message.length < 2) {
        addTextToLastWords('Введите одно слово (2–20 букв)');
        return;
    }

    if (words_count === 0) {
        document.getElementById('info').style.display = 'none';
        document.getElementById('settings').style.display = 'none';
    }
    words_count++;
    wordQueue.push({ 'user': SOLO_USER, 'color': SOLO_COLOR, 'msg': message });
    if (wordQueue.length === 1) {
        runQueue();
    }
}

if (soloSubmit) {
    soloSubmit.addEventListener('click', solo_guess);
}

if (soloInput) {
    soloInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            solo_guess();
        }
    });
    soloInput.focus();
}

app();
