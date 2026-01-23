let channel_name = '';
let restart_time = 20;
let is_game_finished = false;
const checked_words = new Set();
const last_words_container = document.querySelector('.guessing .last-words');

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
        console.log(`Слово "${word}" уже было проверено.`);
        // добавить слово в колонку .guessing .last-words в верх списка
        const html = `
            <div class="msg">
                <div class="bg"></div>
                <div class="word-and-distance">
                        <div class="word">${word} уже было использовано</div>
                </div>
            </div>`
        last_words_container.insertAdjacentHTML('afterbegin', html);
        return
    } else if (iwawwa.has(word)) {
        const pig = iwawwa_img[Math.floor(Math.random() * iwawwa_img.length)];
        const html = `
        <div class="msg">
            <div class="bg"></div>
            <div class="iwawwa">
                    <div class="word"><img src="img/iwawwa_1.avif"></div>
                    <div class="distance"><img src="img/${pig}"></div>
            </div>
        </div>`
        last_words_container.insertAdjacentHTML('afterbegin', html);
        return
    }

    // Если слова нет — выполняем логику
    console.log(`Новое слово: ${word}. Обрабатываю...`);

    if (force_win) {
        word_check = { distance: 1 };
    } else {
        word_check = await kontekstno_query('score', word, secret_word_id);
    }

    checked_words.add(word);

    if (!word_check.distance) {
        const html = `
            <div class="msg">
                <div class="bg"></div>
                <div class="word-and-distance">
                        <div class="word">Слово ${word} не найдено в словаре</div>
                </div>
            </div>`
        last_words_container.insertAdjacentHTML('afterbegin', html);
        console.log(`Слово "${word}" не имеет дистанци.`);
        return
    }

    const new_message = message_template(word, word_check.distance, user['display-name'], nickname_color);

    console.log(word_check);

    // добавить слово в колонку .guessing .last-words в верх списка
    last_words_container.insertAdjacentHTML('afterbegin', new_message);

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
    const newDistance = parseFloat(word_check.distance);

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

    // обработка победы (слово угадано)
    if (word_check.distance == 1) {
        handle_win(user);
    }

}

function message_template(word, distance, name, nickname_color) {

    const width = Math.max(0, 100 - (distance / 2800) * 100);
    const distance_color = getDistanceColor(distance);

    return `
        <div class="msg" data-distance="${distance}">
            <div class="bg" style="width: ${width}%; background: ${distance_color}"></div>
            <div class="word-and-distance">
                <div class="word">${word}</div>
                <div class="distance">${distance}</div>
            </div>
            <div class="name" style="color: ${nickname_color}; white-space: nowrap;">
                <span>${name}</span>
            </div>
        </div>
    `;
}

function handle_win(winner_user) {
    is_game_finished = true;

    if (typeof updateLeaderboard === 'function') {
        updateLeaderboard(winner_user['display-name']);
        const leaderboardSection = document.getElementById('leaderboard');
        if (leaderboardSection) leaderboardSection.style.display = 'flex';
    }

    document.getElementById('winner-avatar').src = '';
    getTwitchUserData(winner_user.username).then((user) => {
        console.log(user);
        document.getElementById('winner-avatar').src = user.logo;
    });

    const winnerBlock = document.getElementById('winner');
    winnerBlock.querySelector('.winner-name').innerText = winner_user['display-name'];
    winnerBlock.style.display = 'block';

    const timeout = (typeof restart_time !== 'undefined' ? restart_time : 20) * 1000;
    const end = Date.now() + (restart_time - 5) * 1000;
    confetti_stars(confetti_win(end));
    if (window.innerWidth > 1200) {
        confetti_fireworks(end);
    }

    setTimeout(async () => {
        try {
            secret_word_id = await generate_secret_word();
        } catch (e) {
            console.error(e);
        }

        reset_round();
        winnerBlock.style.display = 'none';

        const leaderboardSection = document.getElementById('leaderboard');
        if (leaderboardSection) leaderboardSection.style.display = 'none';

        is_game_finished = false;
    }, timeout);
}

function reset_round() {
    document.querySelector('.guessing .last-words').innerHTML = '';
    document.querySelector('.guessing .best-match').innerHTML = '';
    checked_words.clear();
}

document.getElementById('test-win-btn').addEventListener('click', () => {
    const randomSuffix = Math.floor(Math.random() * 10000);
    process_message({ username: 'bronyatenei', 'display-name': '万尸口卄牙丅仨卄仨认' }, '#8A2BE2', 'WinWord' + randomSuffix, true);
});

document.getElementById('menu-button-settings').addEventListener('click', () => {
    const settingsSection = document.getElementById('settings');
    settingsSection.style.display = settingsSection.style.display === 'none' ? 'block' : 'none';
});
document.getElementById('menu-button-info').addEventListener('click', () => {
    const infoSection = document.getElementById('info');
    infoSection.style.display = infoSection.style.display === 'none' ? 'block' : 'none';
});
