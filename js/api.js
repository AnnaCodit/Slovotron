async function kontekstno_query({
    method = '',
    word = '',
    challenge_id = '',
    last_word_rank = 0
} = {}) {

    // const BASE_DOMAIN = 'https://xn--80aqu.xn--e1ajbkccewgd.xn--p1ai/';
    const BASE_DOMAIN = 'https://api.contextno.com/';

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

async function generate_secret_word() {
    let room_id;
    let is_bugged = true;
    let retry_count = 0;
    const max_retries = 5;

    while (is_bugged) {
        if (retry_count >= max_retries) {
            show_fullscreen_error('Ошибка получения секретного слова.<br>Пожалуйста, попробуйте зайти позже.');
            throw new Error('Превышено количество попыток получения секретного слова.');
        }

        const data = await kontekstno_query({ method: 'random-challenge' });
        room_id = data.id;

        // Проверка на забагованное слово.
        // Если для "банан" возвращается 0, значит игра сломана и надо перезапустить.
        try {
            const check = await kontekstno_query({
                method: 'score',
                word: 'банан',
                challenge_id: room_id
            });

            if (check.distance === 0) {
                console.warn(`Слово ID ${room_id} забаговано (дистанция для "банан" = 0). Попытка ${retry_count + 1}/${max_retries}...`);
                retry_count++;
            } else {
                is_bugged = false;
            }
        } catch (e) {
            console.error('Ошибка при проверке слова на баг:', e);
            retry_count++;
            // Небольшая пауза перед повтором при сетевой ошибке
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    return room_id;
}

function show_fullscreen_error(message) {
    // Удаляем предыдущую ошибку, если она есть
    const existing = document.querySelector('.error-overlay');
    if (existing) existing.remove();

    const error_html = `
        <div class="error-overlay">
            <div class="error-content">
                <div class="error-icon">⚠️</div>
                <div class="error-message">${message}</div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', error_html);
}

async function getTwitchUserData(username) {
    try {
        const response = await fetch(`https://api.ivr.fi/v2/twitch/user?login=${username}`);
        const data = await response.json();

        if (data && data[0]) {
            return data[0];
        } else {
            console.error("Пользователь не найден");
        }
    } catch (error) {
        console.error("Ошибка запроса:", error);
    }
    return null;
}