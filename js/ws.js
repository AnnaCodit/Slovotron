// Настройки клиента

let is_game_finished = false;
const DISTANCE_LEVELS = [
    1,
    150,
    550,
    1400,
    2800
];
const checked_words = new Set();

function getDistanceLevel(distance) {
    for (let i = DISTANCE_LEVELS.length - 1; i >= 0; i--) {
        if (distance >= DISTANCE_LEVELS[i]) {
            return i + 1;
        }
    }
    return 0;
}


async function process_message(name, nickname_color, word, force_win = false) {

    if (is_game_finished) return;

    // перевод слова в нижний регистр
    word = word.toLowerCase();
    // сделать первую букву большой
    // word = word.charAt(0).toUpperCase() + word.slice(1);

    // Проверяем, есть ли слово в списке
    if (checked_words.has(word)) {
        console.log(`Слово "${word}" уже было проверено.`);
        // добавить слово в колонку .guessing .last-words в верх списка
        const last_words_container = document.querySelector('.guessing .last-words');

        const founded_message = message_template(word, 0, name, nickname_color);


        const html = `<div class="msg">${word} уже было использовано</div>`;
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

    if (!word_check.distance) {
        console.log(`Слово "${word}" не имеет дистанци.`);
        return
    }

    if (word_check.distance == 1) {
        handle_win(name);
    }

    // добавить слово в колонку .guessing .best-match в верх списка
    const best_match_container = document.querySelector('.guessing .best-match');

    const new_message = message_template(word, word_check.distance, name, nickname_color);

    console.log(word_check);

    // И добавляем в список
    checked_words.add(word);

    // добавить слово в колонку .guessing .last-words в верх списка
    const last_words_container = document.querySelector('.guessing .last-words');
    last_words_container.insertAdjacentHTML('afterbegin', new_message);

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

}

function message_template(word, distance, name, nickname_color) {

    const width = Math.max(0, 100 - (distance / 2800) * 100);
    const distance_level = getDistanceLevel(distance);

    return `
        <div class="msg distance-level-${distance_level}" data-distance="${distance}">
            <div class="bg" style="width: ${width}%"></div>
            <div class="word-and-distance">
                <div class="word">${word}</div>
                <div class="distance">${distance}</div>
            </div>
            <div class="name" style="color: ${nickname_color}">${name}</div>
        </div>
    `;
}

function handle_win(winner_name) {
    is_game_finished = true;
    const winnerBlock = document.querySelector('.winner');
    winnerBlock.innerText = `Победитель: ${winner_name}`;
    winnerBlock.style.display = 'block';

    const timeout = (typeof restart_time !== 'undefined' ? restart_time : 20) * 1000;

    setTimeout(async () => {
        try {
            secret_word_id = await generate_secret_word();
        } catch (e) {
            console.error(e);
        }

        document.querySelector('.guessing .last-words').innerHTML = '';
        document.querySelector('.guessing .best-match').innerHTML = '';
        checked_words.clear();
        winnerBlock.style.display = 'none';
        is_game_finished = false;
    }, timeout);
}

document.getElementById('test-win-btn').addEventListener('click', () => {
    const randomSuffix = Math.floor(Math.random() * 10000);
    process_message('TestUser', '#0000FF', 'WinWord' + randomSuffix, true);
});