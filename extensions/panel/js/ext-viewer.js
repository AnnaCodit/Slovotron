// ext-viewer.js — логика viewer panel (заменяет ext-init.js).
// Читает состояние игры из Twitch.ext.configuration (обновляется стримером через live_config.html).
// Зритель может вводить слова прямо в панели — результат видит только он.

let currentChallengeId = null;
let inputDisabled = false;

// ─── Цвет по дистанции (тот же алгоритм, что в ws.js) ─────────────────────

function getDistanceColor(distance) {
    if (distance === 1)    return '#800080';  // фиолетовый — победа
    if (distance <= 150)   return '#008000';  // зелёный
    if (distance <= 550)   return '#cccc00';  // жёлтый
    if (distance <= 1400)  return '#ffa000';  // оранжевый
    return '#cc0000';                          // красный
}

// ─── Рендер глобального топ-3 ──────────────────────────────────────────────

function renderTop3(top3) {
    const list = document.getElementById('top3-list');
    list.innerHTML = '';

    if (!top3 || top3.length === 0) {
        list.innerHTML = '<div class="top3-empty">Слов пока нет</div>';
        return;
    }

    top3.forEach((item, i) => {
        const color = getDistanceColor(item.distance);
        const div = document.createElement('div');
        div.className = 'top3-item';
        div.innerHTML =
            `<span class="rank">#${i + 1}</span>` +
            `<span class="word">${item.word.toUpperCase()}</span>` +
            `<span class="dist" style="color:${color}">${item.distance}</span>`;
        list.appendChild(div);
    });
}

// ─── Статус игры ───────────────────────────────────────────────────────────

function showStatus(text, type = 'normal') {
    const el = document.getElementById('game-status');
    el.textContent = text;
    el.className = 'game-status-' + type;
}

function showWinner(winnerName) {
    const winnerSection = document.getElementById('winner-panel');
    if (winnerSection) {
        winnerSection.style.display = 'block';
        const nameEl = winnerSection.querySelector('.winner-name');
        if (nameEl) nameEl.textContent = winnerName || '???';
    }
    showStatus('🏆 Победитель: ' + (winnerName || '???'), 'won');
}

function hideWinner() {
    const winnerSection = document.getElementById('winner-panel');
    if (winnerSection) winnerSection.style.display = 'none';
}

// ─── Управление инпутом ────────────────────────────────────────────────────

function enableInput() {
    inputDisabled = false;
    const input = document.getElementById('word-input');
    const btn = document.getElementById('word-submit');
    if (input) input.disabled = false;
    if (btn) btn.disabled = false;
}

function disableInput() {
    inputDisabled = true;
    const input = document.getElementById('word-input');
    const btn = document.getElementById('word-submit');
    if (input) input.disabled = true;
    if (btn) btn.disabled = true;
}

function setInputLoading(loading) {
    const btn = document.getElementById('word-submit');
    if (!btn) return;
    btn.textContent = loading ? '...' : '→';
    btn.disabled = loading || inputDisabled;
}

// ─── Личный результат зрителя ──────────────────────────────────────────────

function showViewerResult(word, distance) {
    const resultEl = document.getElementById('viewer-result');
    const wordEl = document.getElementById('viewer-last-word');
    const distEl = document.getElementById('viewer-last-distance');
    if (!resultEl || !wordEl || !distEl) return;

    const color = getDistanceColor(distance);

    resultEl.style.display = 'flex';
    wordEl.textContent = word.toUpperCase();
    distEl.textContent = distance;
    distEl.style.color = color;

    if (distance === 1) {
        resultEl.classList.add('viewer-result-win');
        showStatus('🎉 Ты угадал!', 'win');
    } else {
        resultEl.classList.remove('viewer-result-win');
    }
}

// ─── Применение состояния из broadcaster config ────────────────────────────

function applyGameState(state) {
    if (!state || !state.challenge_id) {
        showStatus('⏳ Ожидание стримера...');
        renderTop3([]);
        hideWinner();
        enableInput();
        return;
    }

    currentChallengeId = state.challenge_id;

    renderTop3(state.top3 || []);

    if (state.status === 'won') {
        if (state.winner && typeof window.panelLeaderboardAddWin === 'function') {
            window.panelLeaderboardAddWin(state.winner);
        }
        showWinner(state.winner);
        disableInput();
    } else {
        hideWinner();
        // Сбрасываем личный результат при новом раунде
        const resultEl = document.getElementById('viewer-result');
        if (resultEl) {
            resultEl.style.display = 'none';
            resultEl.classList.remove('viewer-result-win');
        }
        showStatus('🟢 Игра идёт — угадай слово!');
        enableInput();
    }
}

function readBroadcasterConfig() {
    try {
        const raw = window.Twitch?.ext?.configuration?.broadcaster?.content;
        return raw ? JSON.parse(raw) : null;
    } catch (e) {
        console.warn('[ext-viewer] Не удалось разобрать broadcaster config:', e);
        return null;
    }
}

// ─── Отправка слова зрителем ───────────────────────────────────────────────

async function submitWord() {
    if (inputDisabled) return;

    const input = document.getElementById('word-input');
    if (!input) return;

    let word = input.value.trim();
    if (!word || word.length < 2) return;
    if (!currentChallengeId) {
        showStatus('⏳ Игра ещё не началась', 'warn');
        return;
    }

    // Нормализация (аналогично ws.js)
    word = word.replace(/ё/gi, 'е').replace(/[^a-zA-Zа-яА-Я]/g, '').toLowerCase();
    if (word.length < 2) return;

    setInputLoading(true);

    try {
        const result = await kontekstno_query({
            method: 'score',
            word,
            challenge_id: currentChallengeId
        });

        if (!result.distance) {
            showStatus('❓ Слово не найдено в словаре');
        } else {
            showViewerResult(word, result.distance);
            input.value = '';
        }
    } catch (e) {
        console.error('[ext-viewer] Ошибка запроса:', e);
        showStatus('⚠️ Ошибка соединения');
    } finally {
        setInputLoading(false);
    }
}

// ─── Инициализация через Twitch.ext ───────────────────────────────────────

window.Twitch.ext.onAuthorized(() => {
    console.log('[ext-viewer] Авторизован');
    applyGameState(readBroadcasterConfig());
});

window.Twitch.ext.configuration.onChanged(() => {
    console.log('[ext-viewer] Конфиг стримера обновился');
    applyGameState(readBroadcasterConfig());
});

// ─── Обработчики UI ────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('word-submit');
    const input = document.getElementById('word-input');

    if (btn) btn.addEventListener('click', submitWord);

    if (input) {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') submitWord();
        });
    }
});
