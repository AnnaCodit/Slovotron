const BAN_WORDS = new Set([
    'нигер', 'нигеры',
    'ниггер', 'ниггеры',
    'нигга', 'нигги',
    'чурка', 'чурки',
    'чурбан', 'чурбаны',
    'хач', 'хачи',
    'хачик', 'хачики',
    'жид', 'жиды',
    'жидяра', 'жидяры',
    'хохол', 'хохлы',
    'пидор', 'пидоры',
    'пидорас', 'пидорасы',
    'пидарас', 'пидарасы',
    'педик', 'педики',
    'гомик', 'гомики',
    'даун', 'дауны',
    'аутист', 'аутисты'
]);

function is_banword(word = '') {
    if (!word || typeof word !== 'string') return false;
    return BAN_WORDS.has(word.trim().toLowerCase().replace(/ё/gi, 'е'));
}

function render_word_html(word = '') {
    if (!word || typeof word !== 'string') return '';
    const trimmed = word.trim();
    if (!is_banword(trimmed)) {
        return trimmed;
    }
    const firstChar = trimmed.charAt(0);
    const restChars = trimmed.slice(1);
    return `<span class="banword-text"><span class="banword-first">${firstChar}</span><span class="banword-blur">${restChars}</span></span>`;
}
