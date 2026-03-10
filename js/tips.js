let best_found_distance = kontekstno_api_tips_max_distance;
let tip_requests_users = new Set();
let tip_last_reset_time = Date.now();
let tip_cooldown_time = 1000 * 60 * 1;
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

function update_tip_progress() {
    let tip_required = Math.floor(uniqUsers.size / 2);
    let tip_requests_count = tip_requests_users.size;

    if (tip_progress_fill) {
        let progress = tip_required > 0 ? (tip_requests_count / tip_required) * 100 : 100;
        tip_progress_fill.style.width = Math.min(100, progress) + '%';
    }
    if (tip_count_current) tip_count_current.innerText = tip_requests_count;
    if (tip_count_total) tip_count_total.innerText = tip_required;
}

async function use_tip(user = '', force = false) {
    // console.log('enter "use_tip"', user);
    if (tip_requests_users.has(user) && !force) return;
    if (!best_found_distance) best_found_distance = kontekstno_api_tips_max_distance;

    let tip_time_left = tip_cooldown_time - (Date.now() - tip_last_reset_time);
    if (tip_time_left > 0 && !force) {
        addTextToLastWords('Осталось секунд до использования подсказки: <b>' + Math.ceil(tip_time_left / 1000) + '</b>');
        // console.log('До использования подсказки осталось', tip_time_left / 1000, 'секунд');
        return;
    }
    tip_requests_users.add(user);
    let tip_requests_count = tip_requests_users.size;
    let tip_required = Math.floor(uniqUsers.size / 2); // сколько нужно людей для подсказки 
    // console.log('tip_requests:', tip_requests_count, 'tip_required:', tip_required);

    update_tip_progress();

    if (tip_requests_count < tip_required && !force) {
        addTextToLastWords('Нужно человек для использования подсказки: <b>' + (tip_required - tip_requests_count) + '</b>');
        return;
    }

    // надо фейкануть дальность лучшего слова чтобы он не уполовинивал близость, а чуть подальше. Например мальтипликатор 1.5 даст 25% приближения вместо 50%
    let fine_tuned_distance = Math.floor(best_found_distance * 1.5);

    // иначе она всегда будет kontekstno_api_max_distance, это магическое число апишки, большую дальность она сбрасывает к kontekstno_api_max_distance
    if (fine_tuned_distance > kontekstno_api_tips_max_distance) fine_tuned_distance = kontekstno_api_tips_max_distance;

    // edge case. Если логика апишки (Math.ceil(fine_tuned_distance / 2)) даст такое же значение, как и текущий best_found_distance, то не фейкаем его, чтобы всё не циклилось
    if (Math.ceil(fine_tuned_distance / 2) == best_found_distance) fine_tuned_distance = best_found_distance;

    // запрос подсказки
    const tip_word = await kontekstno_query({
        method: 'tip',
        challenge_id: secret_word_id,
        last_word_rank: fine_tuned_distance
    });
    if (!tip_word.distance) {
        console.error('tip_word.distance is undefined', tip_word);
        return;
    }
    console.log('tip_word:', tip_word);
    best_found_distance = tip_word.distance; // обновляем текущую лучшую дальность
    console.log('best_found_distance after tip:', best_found_distance);
    reset_tips();

    checked_words.set(tip_word.word, { distance: tip_word.distance });
    const new_message = message_template(tip_word.word, tip_word.distance, '💡 Подсказка', '#DDD');
    addAnythingToLastWords(new_message);
    addMatchWord(new_message, tip_word.distance);
    if (tip_word.distance == 1) {
        handle_win({ username: 'podskazka', 'display-name': '💡 Подсказка' });
    }

    // await process_message(wordQueue[0].user, '#DDD', tip_word)

}

function reset_tips() {
    tip_requests_users.clear(); // очищаем список пользователей которые использовали подсказку
    tip_last_reset_time = Date.now(); // обновляем время последнего использования подсказки
    update_tip_progress();
}

document.addEventListener('DOMContentLoaded', function () {
    tip_menu_button.addEventListener('click', function () {
        use_tip('', true);
    });
    // Обновляем прогресс при загрузке и периодически (так как uniqUsers меняется в другом файле)
    update_tip_progress();
    setInterval(update_tip_progress, 2000);
});