let tip_requests_users = new Set();
let tip_last_reset_time = Date.now();
let tip_cooldown_time = 1000 * 60 * 1;
let tip_in_progress = false; // пока подсказка выдаётся — повторные вызовы игнорируем
let tip_distance_tune_multiplier = 1.5; // механика подсказок такова что апишка контекстно дает слово вдвое ближе чем last_word_rank. мультипликатор нужен чтобы это поправить как нам надо. например: лучшая дистанция 100, мультипликатор 1.5, подсказка даст дальность 75 вместо 50.
const tip_menu_button = document.getElementById('menu-button-tip');

const tip_progress_fill = document.getElementById('tip-progress-fill');
const tip_count_current = document.getElementById('tip-count-current');
const tip_count_total = document.getElementById('tip-count-total');

// let tip_requests_count = 0;

// output best_found_distance in console once per 5 seconds
// setInterval(() => {
//     console.log('best_found_distance', best_found_distance)
// }, 5000)

const tip_progress_block = document.getElementById('tip-progress');
const tip_progress_bar = document.querySelector('#tip-progress .bar');
const tip_bulb = document.querySelector('#tip-progress .bulb');

function update_tip_progress(completed = false) {
    let tip_required = Math.floor(uniqUsers.size / 2);
    let tip_requests_count = completed ? tip_required : tip_requests_users.size;

    // Вычисляем прогресс один раз как число 0-100
    let progress = 0;
    if (tip_required > 0) {
        progress = Math.min(100, (tip_requests_count / tip_required) * 100);
    } else {
        progress = tip_requests_count > 0 ? 100 : 0;
    }

    tip_progress_fill.style.width = progress + '%';
    tip_bulb.style.filter = `grayscale(${100 - progress}%)`;
    tip_progress_block.style.display = tip_requests_count > 0 ? 'flex' : 'none';

    tip_count_current.innerText = tip_requests_count;
    tip_count_total.innerText = tip_required;
}

async function use_tip(user = '', force = false) {
    // Tips are unavailable on backends without a hint endpoint.
    if (!backend_supports_tips()) return;
    // console.log('enter "use_tip"', user);
    if (user && tip_requests_users.has(user) && !force) return;
    if (!best_found_distance) best_found_distance = backend_max_distance();

    let tip_time_left = tip_cooldown_time - (Date.now() - tip_last_reset_time);
    if (tip_time_left > 0 && !force) {
        addTextToLastWords('Осталось секунд до использования подсказки: <b>' + Math.ceil(tip_time_left / 1000) + '</b>');
        // console.log('До использования подсказки осталось', tip_time_left / 1000, 'секунд');
        return;
    }
    if (user) tip_requests_users.add(user);
    let tip_requests_count = tip_requests_users.size;
    let tip_required = Math.floor(uniqUsers.size / 2); // сколько нужно людей для подсказки 
    // console.log('tip_requests:', tip_requests_count, 'tip_required:', tip_required);

    update_tip_progress(force);
    markOverlayActivity(); // высветляем оверлей при использовании подсказки тоже

    if (tip_requests_count < tip_required && !force) {
        addTextToLastWords('Нужно человек для использования подсказки: <b>' + (tip_required - tip_requests_count) + '</b>');
        return;
    }

    // гард ставим синхронно до await, иначе одновременные вызовы пройдут гейт
    if (tip_in_progress) return;
    tip_in_progress = true;

    // Play activation animation
    tip_progress_bar.classList.add('tip-activated');

    // The hint request is built per-backend: kontekstno applies its own multiplier,
    // wordgun uses best_found_distance directly as best_rank.
    let tip_word;
    try {
        tip_word = await get_tip(secret_word_id, best_found_distance);
    } catch (e) {
        console.error('tip query failed', e);
        abort_tip();
        return;
    }
    // wordgun /hint returns { word: null } when no closer word remains — not an error,
    // so give the user feedback instead of logging a misleading failure.
    if (tip_word && tip_word.word === null) {
        addTextToLastWords('Ближе слов для подсказки нет');
        abort_tip();
        return;
    }
    if (!tip_word?.distance) {
        console.error('tip_word.distance is undefined', tip_word);
        abort_tip();
        return;
    }
    console.log('tip_word:', tip_word);
    best_found_distance = tip_word.distance; // обновляем текущую лучшую дальность
    console.log('best_found_distance after tip:', best_found_distance);

    // Wait a bit for animation to show before resetting/hiding
    setTimeout(() => {
        tip_progress_bar.classList.remove('tip-activated');
        reset_tips();
    }, 800);

    checked_words.set(tip_word.word, { distance: tip_word.distance });
    const new_message = message_template(tip_word.word, tip_word.distance, '💡 Подсказка', '#DDD');
    addAnythingToLastWords(new_message);
    addMatchWord(new_message, tip_word.distance);

    sendWebhookEvent('game-tip', {
        tip_word: tip_word.word,
        tip_distance: tip_word.distance,
        challenge_id: secret_word_id
    });

    if (tip_word.distance == 1) {
        handle_win({ username: 'podskazka', 'display-name': '💡 Подсказка' }, tip_word.word);
    }

    // await process_message(wordQueue[0].user, '#DDD', tip_word)

}

function reset_tips() {
    tip_requests_users.clear(); // очищаем список пользователей которые использовали подсказку
    tip_last_reset_time = Date.now(); // обновляем время последнего использования подсказки
    tip_in_progress = false;
    update_tip_progress();
}

// откат при ошибке: снимаем guard и чистим голоса, чтобы можно было переспросить. кулдаун не трогаем
function abort_tip() {
    tip_progress_bar.classList.remove('tip-activated');
    tip_in_progress = false;
    tip_requests_users.clear();
    update_tip_progress();
}

document.addEventListener('DOMContentLoaded', function () {
    tip_menu_button.addEventListener('click', function () {
        use_tip('', true);
    });
    update_tip_progress();
});

document.addEventListener('uniqueGuessersAmountChanged', () => {
    update_tip_progress();
});
