async function kontekstno_query({
    method = '',
    word = '',
    challenge_id = '',
    last_word_rank = 0
} = {}) {

    // const BASE_DOMAIN = 'https://xn--80aqu.xn--e1ajbkccewgd.xn--p1ai/';
    const BASE_DOMAIN = 'https://api.contextno.com/';

    // 1. Создаем объект URL. Он сам склеит домен и метод правильно.
    if (!method) {
        throw new Error('kontekstno_query: method не указан');
    }

    const url = new URL(method, BASE_DOMAIN);

    // 2. Добавляем параметры в зависимости от метода
    switch (method) {

        case 'score':
            url.searchParams.set('challenge_id', challenge_id);
            url.searchParams.set('word', word);
            url.searchParams.set('challenge_type', 'random');
            break;

        case 'tip':
            url.searchParams.set('challenge_id', challenge_id);
            url.searchParams.set('last_word_rank', last_word_rank);
            url.searchParams.set('challenge_type', 'random');
            break;

        // Для 'random-challenge' параметры не нужны, url остается чистым
        case 'random-challenge':
            break;

        default:
            throw new Error(`Неизвестный method: ${method}`);
    }

    // Таймаут для запроса
    const controller = new AbortController();

    const timeout = setTimeout(() => {
        controller.abort();
    }, 10000);

    try {
        // 3. Делаем запрос
        const response = await fetch(url, {
            signal: controller.signal,
            headers: {
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            let errorText = '';
            try {
                errorText = await response.text();
                if (errorText.length > 200) {
                    errorText = errorText.substring(0, 200) + '...';
                }
            } catch { }
            throw new Error(
                `HTTP ${response.status} ${response.statusText} ${errorText}`
            );
        }

        let data;

        try {
            data = await response.json();
        } catch (jsonError) {
            throw new Error(
                `Ошибка парсинга JSON: ${jsonError.message}`
            );
        }

        // базовая валидация ответа
        if (!data || typeof data !== 'object' || Array.isArray(data)) {
            throw new Error('API вернул некорректный JSON');
        }

        return data;

    } catch (error) {
        if (error.name === 'AbortError') {
            throw new Error('Таймаут запроса к Contextno API');
        }
        throw error;
    } finally {
        clearTimeout(timeout);
    }
}

async function sendWebhookEvent(event = '', data = {}) {
    if (!webhook_url || !event) return;

    try {
        await fetch(webhook_url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                channel: channel_name,
                secret: webhook_secret,
                event: event,
                data: data
            })
        });
    } catch (error) {
        console.warn(`Не удалось отправить webhook событие "${event}"`, error);
    }
}

// --- Game backends ----------------------------------------------------------
// Slovotron can talk to two stateless word-guessing backends. Each one exposes
// the same interface so the rest of the game stays backend-agnostic:
//   createGame()          -> { gameId, secretWord }
//   score(gameId, word)   -> { distance }   (distance falsy => not in vocabulary)
//   tip(gameId, lastRank) -> { word, distance }   (optional; null if unsupported)

const WORDGUN_BASE_URL = 'https://api.wordgun.ru';

async function wordgun_request(path, { method = 'GET', body = null } = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
        const response = await fetch(`${WORDGUN_BASE_URL}${path}`, {
            method,
            signal: controller.signal,
            headers: {
                'Accept': 'application/json',
                ...(body ? { 'Content-Type': 'application/json' } : {})
            },
            body: body ? JSON.stringify(body) : undefined
        });

        if (!response.ok) {
            let errorBody = null;
            try { errorBody = await response.json(); } catch { }
            const error = new Error(`Wordgun HTTP ${response.status}: ${errorBody?.error || response.statusText}`);
            error.status = response.status;
            error.code = errorBody?.code;
            error.apiMessage = errorBody?.error;
            throw error;
        }

        return await response.json();
    } catch (error) {
        if (error.name === 'AbortError') {
            throw new Error('Таймаут запроса к Wordgun API');
        }
        throw error;
    } finally {
        clearTimeout(timeout);
    }
}

const GAME_BACKENDS = {
    // контекстно.рф — original backend. Opaque challenge_id, "distance" score,
    // supports hint words via the tip endpoint and discloses the secret word.
    kontekstno: {
        id: 'kontekstno',
        label: 'контекстно.рф',
        supportsTips: true,
        maxDistance: kontekstno_api_tips_max_distance,

        async createGame() {
            const data = await kontekstno_query({ method: 'random-challenge' });
            const room_id = data.id;

            // Проверка на забагованное слово.
            // Если для "банан" возвращается 0, значит игра сломана и надо перезапустить.
            const check = await kontekstno_query({
                method: 'score',
                word: 'банан',
                challenge_id: room_id
            });

            if (check.distance === 0) {
                throw new Error(`Слово ID ${room_id} забаговано (дистанция для "банан" = 0).`);
            }

            let secret_word = null;
            try {
                const secretWordResponse = await kontekstno_query({
                    method: 'tip',
                    challenge_id: room_id,
                    last_word_rank: 1
                });
                secret_word = secretWordResponse?.word || null;
            } catch (secretWordError) {
                console.warn('Не удалось получить секретное слово через tip(last_word_rank=1):', secretWordError);
            }

            return { gameId: room_id, secretWord: secret_word };
        },

        async score(gameId, word) {
            const result = await kontekstno_query({
                method: 'score',
                word: word,
                challenge_id: gameId
            });
            return { distance: result.distance };
        },

        async tip(gameId, bestRank) {
            // надо фейкануть дальность лучшего слова чтобы он не уполовинивал близость, а чуть подальше. Например мальтипликатор 1.5 даст 25% приближения вместо 50%
            let fine_tuned_distance = Math.floor(bestRank * 1.5);
            // иначе она всегда будет kontekstno_api_max_distance, это магическое число апишки, большую дальность она сбрасывает к kontekstno_api_max_distance
            if (fine_tuned_distance > kontekstno_api_tips_max_distance) fine_tuned_distance = kontekstno_api_tips_max_distance;
            // edge case. Если логика апишки (Math.ceil(fine_tuned_distance / 2)) даст такое же значение, как и текущий best_found_distance, то не фейкаем его, чтобы всё не циклилось
            if (Math.ceil(fine_tuned_distance / 2) == bestRank) fine_tuned_distance = bestRank;

            const result = await kontekstno_query({
                method: 'tip',
                challenge_id: gameId,
                last_word_rank: fine_tuned_distance
            });
            return { word: result?.word, distance: result?.distance };
        }
    },

    // wordgun.ru — stateless API (see public-api-v2.md). The game lives inside an
    // opaque token; a guess returns { in_vocab, rank }. The secret word is never
    // disclosed, but a hint endpoint reveals a word closer than your best rank.
    // The game is created on v2 to pick a model and difficulty; guesses go to the
    // v1 endpoint, which accepts v2 tokens unchanged.
    wordgun: {
        id: 'wordgun',
        label: 'wordgun.ru',
        supportsTips: true,
        maxDistance: Infinity,

        async createGame() {
            // Both fields are optional: an empty model means the server default,
            // an empty difficulty means the secret is drawn from the whole vocabulary.
            const body = {};
            if (wordgun_model) body.model = wordgun_model;
            if (wordgun_difficulty) body.difficulty = wordgun_difficulty;

            let data;

            try {
                data = await wordgun_request('/v2/create_game', { method: 'POST', body });
            } catch (error) {
                const isUnknownDifficulty = error.status === 400
                    && typeof error.apiMessage === 'string'
                    && error.apiMessage.startsWith('unknown difficulty');

                if (body.difficulty && isUnknownDifficulty) {
                    error.userMessage = 'Выбранная сложность Wordgun больше не поддерживается. '
                        + 'Откройте настройки и выберите новую сложность. '
                        + 'Если используете OBS, замените ссылку браузерного источника.';
                }

                throw error;
            }

            if (!data?.token) {
                throw new Error('Wordgun API не вернул токен игры');
            }

            // Wordgun never reveals the secret word, so it stays null.
            return { gameId: data.token, secretWord: null };
        },

        async score(gameId, word) {
            const result = await wordgun_request('/v1/guess', {
                method: 'POST',
                body: { token: gameId, word: word }
            });
            // Normalize to the shared { distance } shape: rank is the distance,
            // an out-of-vocabulary guess has no distance.
            return { distance: result.in_vocab ? result.rank : undefined };
        },

        async tip(gameId, bestRank) {
            // /hint returns a word strictly closer to the secret than best_rank
            // (clamped to [2, vocab_size] server-side). best_rank is left out until
            // we have a finite best, so the server returns a far first hint.
            const body = { token: gameId };
            if (Number.isFinite(bestRank)) body.best_rank = bestRank;
            const result = await wordgun_request('/v2/hint', { method: 'POST', body });
            // { word: null } means no closer word remains.
            return { word: result?.word ?? null, distance: result?.rank };
        }
    }
};

// The models and difficulties available on the server, fetched once and cached.
let wordgun_models_cache = null;

async function wordgun_list_models() {
    if (wordgun_models_cache) return wordgun_models_cache;

    const data = await wordgun_request('/v2/list_model');
    wordgun_models_cache = {
        models: Array.isArray(data?.models) ? data.models : [],
        defaultModel: data?.default || '',
        difficulties: Array.isArray(data?.difficulties) ? data.difficulties : []
    };
    return wordgun_models_cache;
}

function getActiveBackend() {
    return GAME_BACKENDS[game_backend] || GAME_BACKENDS.kontekstno;
}

function backend_supports_tips() {
    return !!getActiveBackend().supportsTips;
}

// The worst/initial rank for the active backend — used to seed best_found_distance
// so the first real guess always improves on it.
function backend_max_distance() {
    return getActiveBackend().maxDistance;
}

// Score a guess with the active backend. Returns { distance }: a positive number
// when the word is in vocabulary, undefined otherwise.
async function score_word(word, gameId) {
    return getActiveBackend().score(gameId, word);
}

// Request a hint word from the active backend, or null if it has no tip support.
async function get_tip(gameId, lastRank) {
    const backend = getActiveBackend();
    if (typeof backend.tip !== 'function') return null;
    return backend.tip(gameId, lastRank);
}

async function generate_secret_word() {
    const backend = getActiveBackend();
    let retry_count = 0;
    const max_retries = 5;

    while (retry_count < max_retries) {
        try {
            const game = await backend.createGame();
            current_secret_word_data = {
                challenge_id: game.gameId,
                secret_word: game.secretWord ?? null
            };
            return game.gameId;
        } catch (e) {
            console.warn(`Не удалось создать игру (${backend.id}). Попытка ${retry_count + 1}/${max_retries}:`, e);

            // Ошибки настроек не исправятся повторным запросом.
            if (e.userMessage) {
                show_fullscreen_error(e.userMessage);
                throw e;
            }

            retry_count++;
            // Небольшая пауза перед повтором при сетевой ошибке
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    show_fullscreen_error('Ошибка получения секретного слова.<br>Пожалуйста, попробуйте зайти позже.');
    throw new Error('Превышено количество попыток получения секретного слова.');
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
                <button type="button" class="error-close-btn">Закрыть</button>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', error_html);

    const errorOverlay = document.querySelector('.error-overlay');
    errorOverlay?.querySelector('.error-close-btn')?.addEventListener('click', () => {
        errorOverlay.remove();
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
        }
    } catch (error) {
        console.error("Ошибка запроса:", error);
    }
    return null;
}
