// Настройки клиента

let is_game_finished = false;

function create_chat_connection(channel_name = '') {

    const client = new tmi.Client({
        channels: [channel_name]
    });

    // Подключаемся
    client.connect();

    // Слушаем сообщения
    // tags — это объект со всей инфой (цвет ника, бейджи, id сообщения и т.д.)
    client.on('message', (channel, tags, message, self) => {

        // console.log(channel, tags, message);

        // Достаем данные. tmi.js сам обрабатывает, есть ли у юзера цвет
        // Если цвета нет, ставим дефолтный неоновый
        const color = tags['color'] || '#00FF00';
        const name = tags['display-name'];

        // console.log(message);


        // если в сообщении больше двух слов то игнорируем
        if (message.split(' ').length > 2) return;

        // prevent xss attack from message
        message = message.replace(/[^a-zA-Zа-яА-ЯёЁ0-9]/g, '');

        process_message(name, color, message);

        // Выводим на экран
        // addMessage(name, color, message);
    });

}

// function addMessage(name, color, text) {
//     const container = document.getElementById('chat-container');
//     const div = document.createElement('div');
//     div.className = 'msg-row';

//     // Формируем HTML с цветом ника
//     div.innerHTML = `<span class="username" style="color: ${color}">${name}:</span> ${text}`;

//     container.appendChild(div);
//     container.scrollTop = container.scrollHeight; // Скролл вниз
// }


const checked_words = new Set();

async function process_message(name, nickname_color, word, force_win = false) {

    if (is_game_finished) return;

    // перевод слова в нижний регистр
    word = word.toLowerCase();
    // сделать первую букву большой
    word = word.charAt(0).toUpperCase() + word.slice(1);

    // Проверяем, есть ли слово в списке
    if (checked_words.has(word)) {
        console.log(`Слово "${word}" уже было проверено.`);
        // добавить слово в колонку .guessing .last-words в верх списка
        const last_words_container = document.querySelector('.guessing .last-words');
        const html = `<div class="msg">${word} уже было использовано</div>`;
        last_words_container.insertAdjacentHTML('afterbegin', html);
        return
    }

    // Если слова нет — выполняем логик0у
    console.log(`Новое слово: ${word}. Обрабатываю...`);

    if (force_win) {
        $word_check = { distance: 1 };
    } else {
        $word_check = await kontekstno_query('score', word, secret_word_id);
    }

    if (!$word_check.distance) {
        console.log(`Слово "${word}" не имеет дистанци.`);
        return
    }

    if ($word_check.distance == 1) {
        handle_win(name);
    }

    // добавить слово в колонку .guessing .best-match в верх списка
    const best_match_container = document.querySelector('.guessing .best-match');

    // calculate color by distance
    const distance = $word_check.distance;
    let color_class = '#00ff00'; // defaulWt green
    if (distance >= 2800) {
        color_class = '#ff0000'; // red
    } else if (distance >= 1400) {
        color_class = '#ffa500'; // orange
    } else if (distance >= 550) {
        color_class = '#ffff00'; // yellow
    } else if (distance >= 150) {
        color_class = '#00ff00'; // green
    }

    // нам нужно расчитать ширину полоски в процентах в зависимости от переменной distance. чем меньше distance, тем больше ширина полоски. 2800 distance это 0% ширины, а 1 distance это 100% ширины
    // const width = calculateWidth(distance);

    const new_message = message_template(word, $word_check.distance, name, nickname_color);

    console.log($word_check);

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
    const newDistance = parseFloat($word_check.distance);

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
    // const width = calculateWidth(distance);
    const width = Math.max(0, 100 - (distance / 2800) * 100);

    return `
        <div class="msg" data-distance="${distance}">

            <div class="bg" style="width: ${width}%"></div>

            <div class="word-and-distance">
                <div class="word">${word}</div>
                <div class="distance">${distance}</div>
            </div>

            <div class="name" style="color: ${nickname_color}">${name}</div>

        </div>
    `;
}

// function calculateWidth(distance, maxDistance = 2800) {
//     const normalized = distance / maxDistance; // 0-1
//     const progress = Math.pow(normalized, 1.8); // 1.8 = сжатие
//     return Math.max(0, progress * 100);
// }

// function calculateWidth(distance, maxDistance = 2800) {
//     const normalized = distance / maxDistance;
//     if (normalized <= 0.8) {
//         return normalized * 40;
//     } else {
//         return 40 + (normalized - 0.8) * 60 * 3;
//     }
// }

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