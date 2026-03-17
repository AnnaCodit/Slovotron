// Настройки игры
let channel_name = '';
let restart_time = 20;
let win_avatar_enable = false;
let sound_enable = true;

// Состояние игры
let secret_word_id = '';
let words_count = 0;
let is_game_finished = false;
const MAX_LAST_WORDS = 20;
const kontekstno_api_tips_max_distance = 300; // апи подсказок не реагирует на число больше 300
let best_found_distance = kontekstno_api_tips_max_distance; // контекстно API max distance

// Таймеры и статистика
let menuTimerId;
let resetRoundTimeoutId;
let resetTimerPaused;
let roundStartTime;
let uniqWords;
let repeatWords;
let winTime;
let uniqUsers = new Set();
const checked_words = new Map();
let wordQueue = [];
let tmi_client = null;

// DOM элементы (кешируются тут или в месте использования)
// Эти переменные лучше не объявлять тут, так как DOM еще не загружен на 100% при старте config.js
