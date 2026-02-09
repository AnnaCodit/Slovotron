let channel_name = '';
let restart_time = 20;
let is_game_finished = false;
let menuTimerId, resetRoundTimeoutId, resetTimerPaused, roundStartTime, uniqWords, repeatWords, winTime;
let uniqUsers = new Set();
const checked_words = new Map();
const last_words_container = document.querySelector('.guessing .last-words');
const MAX_LAST_WORDS = 20;

function addAnythingToLastWords(html) {
    last_words_container.insertAdjacentHTML('afterbegin', html);
    while (last_words_container.children.length > MAX_LAST_WORDS) {
        last_words_container.removeChild(last_words_container.lastElementChild);
    }
}
function addTextToLastWords(text = '') {
    const html = `
        <div class="msg">
            <div class="msg-content">
                <div class="word-and-distance">
                    <div class="word">${text}</div>
                </div>
            </div>
        </div>`
    addAnythingToLastWords(html);
}

const iwawwa = new Set(['ивавва', 'ивава', 'акане', 'аканэ', 'iwawwa', 'iwawa', 'akane']);
const iwawwa_img = [
    'iwawwa_2.avif',
    'iwawwa_3.avif',
    'iwawwa_4.avif',
    'iwawwa_5.avif'
];

function getDistanceColor(distance) {
    const colors = [
        'linear-gradient(90deg,rgba(128, 0, 128, 0.5) 0%, rgba(128, 0, 128, 1) 100%);',
        'linear-gradient(90deg,rgba(0, 128, 0, 0.5) 0%, rgba(0, 128, 0, 1) 100%);',
        'linear-gradient(90deg,rgba(255, 255, 0, 0.5) 0%, rgba(255, 255, 0, 0.7) 100%);',
        'linear-gradient(90deg,rgba(255, 160, 0, 0.5) 0%, rgba(255, 160, 0, 1) 100%);',
        'linear-gradient(90deg,rgba(255, 0, 0, 0.5) 0%, rgba(255, 0, 0, 1) 100%);'
    ];

    if (distance === 1) {
        return colors[0];
    } else if (distance <= 150) {
        return colors[1];
    } else if (distance <= 550) {
        return colors[2];
    } else if (distance <= 1400) {
        return colors[3];
    } else {
        return colors[4];
    }
}


async function process_message(user, nickname_color, word, force_win = false) {

    if (is_game_finished) return;

    // перевод слова в нижний регистр
    word = word.toLowerCase();
    // сделать первую букву большой
    // word = word.charAt(0).toUpperCase() + word.slice(1);

    // Проверяем, есть ли слово в списке
    if (checked_words.has(word)) {
        if (checked_words.get(word).distance) {
            if (!uniqUsers.has(user.username)) { uniqUsers.add(user.username) }
            repeatWords++
        }
        // добавить слово в колонку .guessing .last-words в верх списка
        addTextToLastWords(word + ' уже было использовано');
        // console.log(`Слово "${word}" уже было проверено.`);
        return
    } else if (iwawwa.has(word)) {
        const pig = iwawwa_img[Math.floor(Math.random() * iwawwa_img.length)];
        const html = `
        <div class="msg">
            <div class="msg-content">
                <div class="iwawwa">
                    <div class="word"><img src="img/iwawwa_1.avif"></div>
                    <div class="distance"><img src="img/${pig}"></div>
                </div>
            </div>
        </div>`
        addAnythingToLastWords(html);
        return
    }

    // Если слова нет — выполняем логику
    console.log(`Новое слово: ${word}. Обрабатываю...`);

    if (force_win) {
        word_check = { distance: 1 };
    } else {
        word_check = await kontekstno_query({
            method: 'score',
            word: word,
            challenge_id: secret_word_id
        });
    }
    // console.log(word_check);

    checked_words.set(word, { distance: word_check.distance });

    if (!word_check.distance) {
        addTextToLastWords(word + ' не найдено в словаре');
        // console.log(`Слово "${word}" не имеет дистанци.`);
        return
    }

    if (word_check.distance < best_found_distance) {
        console.log('Щас мы запишем новую дистанцию из обычного процессинга слова:', word_check.distance);
        best_found_distance = word_check.distance;
    }

    if (!uniqUsers.has(user.username)) { uniqUsers.add(user.username) }
    uniqWords++

    // готовый html шаблон слова
    const new_message = message_template(word, word_check.distance, user['display-name'], nickname_color);

    // добавить слово в колонку .guessing .last-words в верх списка
    addAnythingToLastWords(new_message);

    // добавить слово в колонку .guessing .best-match в нужное место в зависимости от дистанции
    addMatchWord(new_message, word_check.distance);

    // обработка победы (слово угадано)
    if (word_check.distance == 1) {
        handle_win(user);
    }

}

function addMatchWord(new_message, distance) {
    // добавить слово в колонку .guessing .best-match в верх списка
    const best_match_container = document.querySelector('.guessing .best-match');

    // Создаем элемент из HTML строки
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = new_message.trim();
    const newMsgElement = tempDiv.firstElementChild;

    // Определяем позицию вставки на основе дистанции
    const container = best_match_container;
    const children = Array.from(container.children);
    let insertIndex = children.length;
    const newDistance = parseFloat(distance);

    for (let i = 0; i < children.length; i++) {
        const childDistance = parseFloat(children[i].dataset.distance);
        if (childDistance > newDistance) {
            insertIndex = i;
            break;
        }
    }

    // Вставляем элемент в правильную позицию
    if (insertIndex === children.length) {
        container.appendChild(newMsgElement);
    } else {
        container.insertBefore(newMsgElement, children[insertIndex]);
    }
}

function message_template(word, distance, name, nickname_color) {

    const width = Math.max(0, 100 - (distance / 2800) * 100);
    const distance_color = getDistanceColor(distance);

    return `
        <div class="msg" data-distance="${distance}">
            <div class="msg-content">
                <div class="bg" style="width: ${width}%; background: ${distance_color}"></div>
                <div class="word-and-distance">
                    <div class="word">${word}</div>
                    <div class="distance">${distance}</div>
                </div>
                <div class="name" style="color: ${nickname_color}; white-space: nowrap;">
                    <span>${name}</span>
                </div>
            </div>
        </div>
    `;
}

function handle_win(winner_user) {
    is_game_finished = true;
    winTime = Date.now();

    if (typeof updateLeaderboard === 'function') {
        updateLeaderboard(winner_user['display-name']);
        const leaderboardSection = document.getElementById('leaderboard-statistic');
        if (leaderboardSection) leaderboardSection.style.display = 'flex';
    }

    const winnerAvatar = document.getElementById('winner-avatar');
    winnerAvatar.src = '';
    getTwitchUserData(winner_user.username).then((user) => {
        console.log(user);
        winnerAvatar.classList.toggle('blurred', !win_avatar_enable);
        winnerAvatar.src = user.logo;
    });

    const winnerBlock = document.getElementById('winner');
    winnerBlock.querySelector('.winner-name').innerText = winner_user['display-name'];
    winnerBlock.style.display = 'block';

    const resetTimeout = (typeof restart_time !== 'undefined' ? restart_time : 20) * 1000;
    let confettiTimeout = Date.now() + (restart_time - 5) * 1000;
    if (restart_time <= 10) { confettiTimeout = Date.now() + 5 * 1000 };
    confetti_stars(confetti_win(confettiTimeout));
    if (window.innerWidth > 1200) {
        confetti_fireworks(confettiTimeout);
    }

    if (restart_time > 0) {
        const menuTimer = document.getElementById('menu-timer');
        menuTimer.innerHTML = pad(restart_time);
        menuTimer.style.display = 'block'

        resetRoundTimeout(resetTimeout);

        const restartTime = Date.now() + (restart_time * 1000);

        menuTimerId = setInterval(async () => {
            let sec = Math.floor((restartTime - Date.now()) / 1000);
            if (Date.now() > restartTime) {
                clearInterval(menuTimerId);
                menuTimer.style.display = 'none';
            } else {
                menuTimer.innerHTML = pad(sec);
            }
        }, 333)
    } else {
        document.getElementById('menu-button-restart').style.display = 'block';
    }

}

async function resetRoundTimeout(time) {
    resetRoundTimeoutId = setTimeout(async () => {
        try {
            secret_word_id = await generate_secret_word();
        } catch (e) {
            console.error(e);
        }

        reset_round();
        document.getElementById('winner').style.display = 'none';

        const leaderboardSection = document.getElementById('leaderboard-statistic');
        if (leaderboardSection) leaderboardSection.style.display = 'none';

        is_game_finished = false;
    }, time);
}

function reset_round() {
    document.querySelector('.guessing .last-words').innerHTML = '';
    document.querySelector('.guessing .best-match').innerHTML = '';
    checked_words.clear();
    roundStartTime = Date.now();
    uniqUsers.clear();
    uniqWords = repeatWords = 0;
    reset_tips();
    best_found_distance = 99999;
}

document.getElementById('test-win-btn').addEventListener('click', () => {
    const randomSuffix = Math.floor(Math.random() * 10000);
    process_message({ username: 'TestUser', 'display-name': 'TestUser' }, '#8A2BE2', 'WinWord' + randomSuffix, true);
});

document.getElementById('menu-button-settings').addEventListener('click', () => {
    const settingsSection = document.getElementById('settings');
    settingsSection.style.display = settingsSection.style.display === 'none' ? 'block' : 'none';
});
document.getElementById('menu-button-info').addEventListener('click', () => {
    const infoSection = document.getElementById('info');
    infoSection.style.display = infoSection.style.display === 'none' ? 'block' : 'none';
});

document.getElementById('menu-button-restart').addEventListener('click', () => {
    resetRoundTimeout(0);
    document.getElementById('menu-button-restart').style.display = 'none';
    resetTimerPaused = false;
});

document.getElementById('menu-timer').addEventListener('click', () => {
    const menuTimer = document.getElementById('menu-timer');
    const menuRestartButton = document.getElementById('menu-button-restart');
    if (is_game_finished) {
        menuTimer.style.display = 'none';
        menuRestartButton.style.display = 'block';
        clearTimeout(resetRoundTimeoutId);
        clearInterval(menuTimerId);
        resetTimerPaused = true;
    }
});
