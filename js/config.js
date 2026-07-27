// Настройки игры
let channel_name = '';
let restart_time = 20;
let win_avatar_enable = false;
let sound_enable = true;
let webhook_url = '';
let webhook_secret = '';
let game_backend = 'kontekstno'; // active word-guessing backend: 'kontekstno' | 'wordgun'
const wordgun_model = 'ru-context-v1'; // wordgun v2 model; not user-configurable
let wordgun_difficulty = ''; // wordgun v2 difficulty; empty = whole vocabulary
let current_secret_word_data = null;

// Состояние игры
let secret_word_id = '';
let words_count = 0;
let is_game_finished = false;
const MAX_LAST_WORDS = 20;
const MAX_CONFETTI_MS = 30 * 1000; // cap confetti/fireworks at 30 seconds
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
let overlay_idle_timeout = 6;
let overlay_idle_opacity = 0.75;
let overlay_idle_timeout_id = null;
let is_overlay_idle = false;

// DOM элементы (кешируются тут или в месте использования)
// Эти переменные лучше не объявлять тут, так как DOM еще не загружен на 100% при старте config.js
