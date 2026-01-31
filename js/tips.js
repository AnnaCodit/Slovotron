// uniqUsers
let tip_requests = 0;
let best_found_distance = 999; // апи не реагирует на число больше 300, но на всякий случай

async function check_for_tip(word = '') {
    word = word.toLowerCase();
    if (word == '!подсказка') {
        tip_requests++;
        let tip_required = Math.floor(uniqUsers.size / 2);
        console.log('tip_requests:', tip_requests, 'tip_required:', tip_required);
        if (tip_requests >= tip_required) {
            const tip_word = await kontekstno_query({
                method: 'tip',
                challenge_id: secret_word_id,
                last_word_rank: best_found_distance
            });
            console.log('tip_word:', tip_word);
            tip_requests = 0;
        }
        return true;
    }
    return false;
}
