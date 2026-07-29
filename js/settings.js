const channelInput = document.getElementById("channel-name");
const restartInput = document.getElementById("restart-time");
const avatarInput = document.getElementById('win-avatar-enable');
const soundInput = document.getElementById('sound-enable');
const saveBtn = document.getElementById('save-settings-btn');
const obsLinkInput = document.getElementById('obs-link');
const gameBackendInput = document.getElementById('game-backend');
const backendWarning = document.getElementById('backend-warning');
const wordgunDifficultyInput = document.getElementById('wordgun-difficulty');
const wordgunSettingBlocks = document.querySelectorAll('.wordgun-setting');
let validationTimeout;
let wordgunOptionsLoaded = false;

function parseBooleanSetting(value) {
    return String(value).toLowerCase() === 'true' || String(value) === '1';
}

function getSettingValue(urlParams, paramName, storageName) {
    return urlParams.has(paramName) ? urlParams.get(paramName) : localStorage.getItem(storageName);
}

function generateObsLink() {
    if (!channelInput || !channelInput.value.trim()) {
        if (obsLinkInput) {
            obsLinkInput.value = '';
            obsLinkInput.disabled = true;
            obsLinkInput.placeholder = 'Заполните название канала';
        }
        return;
    }

    const baseUrl = window.location.origin + window.location.pathname;
    const params = new URLSearchParams();

    params.set('channel', channelInput.value.trim());
    params.set('obs-overlay', '1');

    if (restartInput && restartInput.value) {
        params.set('restart_time', restartInput.value.trim());
    }

    if (avatarInput) {
        params.set('win_avatar_enable', avatarInput.checked ? '1' : '0');
    }

    if (soundInput) {
        params.set('sound_enable', soundInput.checked ? '1' : '0');
    }

    if (gameBackendInput) {
        params.set('backend', gameBackendInput.value);

        // wordgun v2 difficulty: only meaningful for that backend, and an empty
        // value already means "the whole vocabulary".
        if (gameBackendInput.value === 'wordgun' && wordgunDifficultyInput && wordgunDifficultyInput.value) {
            params.set('wg_difficulty', wordgunDifficultyInput.value);
        }
    }

    if (webhook_url) {
        params.set('webhook_url', webhook_url);
    }

    if (overlay_idle_timeout > 0) {
        params.set('inactive_timeout', overlay_idle_timeout);
    }

    if (overlay_idle_opacity >= 0 && overlay_idle_opacity < 1) {
        params.set('inactive_opacity', overlay_idle_opacity);
    }

    if (obsLinkInput) {
        obsLinkInput.value = baseUrl + '?' + params.toString();
        obsLinkInput.disabled = false;
    }
}

function loadSettings() {
    const urlParams = new URLSearchParams(window.location.search);

    // Подключение внешнего CSS-файла
    let cssFile = urlParams.get('cssFile');
    if (cssFile) {
        try {
            let urlString = cssFile;
            // Если ссылка не начинается с http://, https:// или //
            if (!urlString.startsWith('http://') && !urlString.startsWith('https://') && !urlString.startsWith('//')) {
                urlString = 'https://' + urlString;
            }

            const cssUrl = new URL(urlString, window.location.href);
            cssUrl.searchParams.set('slv_timestamp', Date.now());

            const linkElement = document.createElement('link');
            linkElement.rel = 'stylesheet';
            linkElement.href = cssUrl.href;
            document.head.appendChild(linkElement);
        } catch (e) {
            console.error(`Некорректный URL в параметре cssFile: "${cssFile}"`, e);
        }
    }

    // Обработка темы приложения
    let app_theme = urlParams.get('theme');
    if (app_theme) {
        // Оставляем только латинские буквы, дефис и подчеркивание
        app_theme = app_theme.replace(/[^a-zA-Z\-_]/g, '');
        if (app_theme.length > 0) {
            document.body.classList.add(`theme-${app_theme}`);
        }
    }

    // Обработка отдельно режима для OBS
    if (urlParams.has('obs-overlay')) {
        document.body.classList.add('obs-overlay');
    }

    webhook_url = (urlParams.get('webhook_url') || '').trim();
    webhook_secret = (urlParams.get('webhook_secret') || '').trim();

    const idleTimeoutParam = urlParams.get('inactive_timeout') || urlParams.get('inactivity_timeout');
    if (idleTimeoutParam !== null) {
        const parsedTimeout = Number.parseFloat(idleTimeoutParam);
        overlay_idle_timeout = Number.isFinite(parsedTimeout) && parsedTimeout > 0 ? parsedTimeout : 0;
    }

    const idleOpacityParam = urlParams.get('inactive_opacity');
    if (idleOpacityParam !== null) {
        const parsedOpacity = Number.parseFloat(idleOpacityParam);
        if (Number.isFinite(parsedOpacity)) {
            overlay_idle_opacity = Math.min(1, Math.max(0, parsedOpacity));
        }
    }
    document.body.style.setProperty('--overlay-idle-opacity', overlay_idle_opacity);

    const urlChannel = urlParams.get('channel_name') || urlParams.get('channel');
    if (urlChannel) {
        localStorage.setItem('channel_name', urlChannel);
    }
    const storedChannel = urlChannel || localStorage.getItem('channel_name');
    const storedRestartTime = urlParams.get('restart_time') || localStorage.getItem('restart_time');
    const storedAvatarInput = getSettingValue(urlParams, 'win_avatar_enable', 'win_avatar_enable');
    const storedSoundInput = getSettingValue(urlParams, 'sound_enable', 'sound_enable');

    if (storedChannel) {
        channel_name = storedChannel;
        if (channelInput) channelInput.value = channel_name;
    }

    if (storedRestartTime) {
        const parsed = parseInt(storedRestartTime, 10);
        if (Number.isFinite(parsed) && parsed >= 0) {
            restart_time = parsed;
            if (restartInput) restartInput.value = restart_time;
        }
    }

    if (storedAvatarInput !== null) {
        win_avatar_enable = parseBooleanSetting(storedAvatarInput);
        if (avatarInput) avatarInput.checked = win_avatar_enable;
    }

    if (storedSoundInput !== null) {
        sound_enable = parseBooleanSetting(storedSoundInput);
        if (soundInput) soundInput.checked = sound_enable;
    }

    const storedBackend = urlParams.get('backend') || localStorage.getItem('game_backend');
    if (storedBackend && GAME_BACKENDS[storedBackend]) {
        game_backend = storedBackend;
    }
    if (gameBackendInput) gameBackendInput.value = game_backend;

    // если ранее в obs был сохранен wg_difficulty, а затем ссылка была обновлена так, что этот параметр отсутствует, то ставим дефолтное значение, а не используем сохраненное
    let storedWordgunDifficulty = localStorage.getItem('wordgun_difficulty') || '';
    if (urlParams.get('backend') === 'wordgun') {
        storedWordgunDifficulty = urlParams.get('wg_difficulty') || '';
    }
    wordgun_difficulty = storedWordgunDifficulty.trim();

    // Show the stored value right away; the real option list arrives from GET /v2/list_model only once the settings panel is actually opened.
    ensureSelectOption(wordgunDifficultyInput, wordgun_difficulty);

    updateBackendSettings();

    // Генерируем ссылку OBS при загрузке страницы
    generateObsLink();

    return !!channel_name;
}

if (saveBtn) {
    saveBtn.addEventListener('click', () => {
        if (channelInput && channelInput.value) {
            localStorage.setItem('channel_name', channelInput.value.trim());
        }

        if (restartInput && restartInput.value) {
            localStorage.setItem('restart_time', restartInput.value.trim());
        }

        if (avatarInput) {
            localStorage.setItem('win_avatar_enable', avatarInput.checked);
        }

        if (soundInput) {
            localStorage.setItem('sound_enable', soundInput.checked);
        }

        if (gameBackendInput && GAME_BACKENDS[gameBackendInput.value]) {
            game_backend = gameBackendInput.value;
            localStorage.setItem('game_backend', game_backend);
        }

        if (wordgunDifficultyInput) {
            wordgun_difficulty = wordgunDifficultyInput.value;
            localStorage.setItem('wordgun_difficulty', wordgun_difficulty);
        }

        // Генерируем ссылку для OBS
        generateObsLink();

        // скрываем блок настроек после сохранения для визуальной индикации успешного сохранения.
        document.getElementById('settings').style.display = 'none';

        app();
    });
}

function checkFormsValidity() {
    if (saveBtn) {
        saveBtn.disabled = !channelInput.validity.valid || !restartInput.validity.valid;
    }
}

async function validateTwitchAcc(acc) {
    if (!channelInput) return;
    channelInput.setCustomValidity("Проверяю...");
    channelInput.reportValidity();
    try {
        const user = await getTwitchUserData(acc);
        const avatarImg = document.getElementById('setting-avatar');
        if (user) {
            if (avatarImg) {
                avatarImg.src = user.logo;
                avatarImg.style.display = 'flex';
            }
            channelInput.setCustomValidity("");
        } else {
            if (avatarImg) {
                avatarImg.style.display = 'none';
            }
            channelInput.setCustomValidity("Канал не найден, попробуйте еще раз");
        }
        channelInput.reportValidity();
    } catch (error) {
        console.error("Ошибка при проверке канала:", error);
        const avatarImg = document.getElementById('setting-avatar');
        if (avatarImg) {
            avatarImg.style.display = 'none';
        }
        channelInput.setCustomValidity("Ошибка при проверке. Попробуйте позже.");
        channelInput.reportValidity();
    }
    checkFormsValidity();
}

if (channelInput) {
    channelInput.addEventListener("input", () => {
        const avatarImg = document.getElementById('setting-avatar');
        if (avatarImg) avatarImg.style.display = 'none';
        checkFormsValidity();

        clearTimeout(validationTimeout);

        let channelName = channelInput.value.trim();
        if (channelName.includes('twitch.tv/')) {
            const parts = channelName.split('twitch.tv/');
            if (parts.length > 1) {
                channelName = parts[1].split('/')[0].split('?')[0];
                channelInput.value = channelName;
            }
        }

        if (channelName.length >= 3) {
            validationTimeout = setTimeout(() => validateTwitchAcc(channelName), 1000);
        } else {
            channelInput.setCustomValidity("Имя канала должно быть не менее 3 символов.");
            checkFormsValidity();
        }
    });
}

if (restartInput) {
    restartInput.addEventListener("input", () => {
        restartInput.reportValidity();
        checkFormsValidity();
    });
}

document.getElementById('menu-button-settings').addEventListener('click', () => {
    const settingsSection = document.getElementById('settings');
    const willOpen = settingsSection.style.display === 'none';
    settingsSection.style.display = willOpen ? 'block' : 'none';

    if (willOpen && (gameBackendInput ? gameBackendInput.value : game_backend) === 'wordgun') {
        loadWordgunOptions();
    }
});

if (avatarInput) {
    avatarInput.addEventListener("input", () => {
        checkFormsValidity();
    });
}

if (soundInput) {
    soundInput.addEventListener("input", () => {
        checkFormsValidity();
    });
}

// Show the wordgun-only settings and its warning (the API can be region-blocked
// from some RU IPs) only while that backend is selected.
function updateBackendSettings() {
    const selected = gameBackendInput ? gameBackendInput.value : game_backend;
    const isWordgun = selected === 'wordgun';

    if (backendWarning) {
        backendWarning.style.display = isWordgun ? 'block' : 'none';
    }

    wordgunSettingBlocks.forEach((block) => {
        block.style.display = isWordgun ? 'block' : 'none';
    });
}

// Keep a stored value selectable even before (or without) the option list —
// otherwise a saved model would silently reset to the default.
function ensureSelectOption(select, value) {
    if (!select || !value) return;
    const exists = Array.from(select.options).some((option) => option.value === value);
    if (!exists) select.add(new Option(value, value));
    select.value = value;
}

function fillSelectOptions(select, values, current, emptyLabel) {
    if (!select) return;
    select.innerHTML = '';
    select.add(new Option(emptyLabel, ''));
    values.forEach((value) => select.add(new Option(value, value)));
    if (current && !values.includes(current)) {
        select.add(new Option(`${current} (недоступно)`, current));
    }
    select.value = current || '';
}

// Pull the difficulties from GET /v2/list_model. Called lazily so the OBS overlay
// — which reads everything from the URL — never hits the endpoint.
async function loadWordgunOptions() {
    if (wordgunOptionsLoaded || !wordgunDifficultyInput) return;

    try {
        const info = await wordgun_list_models();
        wordgunOptionsLoaded = true;
        fillSelectOptions(wordgunDifficultyInput, info.difficulties, wordgun_difficulty, 'Без ограничения');
    } catch (error) {
        // A failed lookup must not wipe the saved setting, so keep what we have.
        console.warn('Не удалось загрузить список сложностей wordgun:', error);
        ensureSelectOption(wordgunDifficultyInput, wordgun_difficulty);
    }
}

if (gameBackendInput) {
    gameBackendInput.addEventListener("change", () => {
        updateBackendSettings();
        if (gameBackendInput.value === 'wordgun') loadWordgunOptions();
        generateObsLink();
        checkFormsValidity();
    });
}

if (wordgunDifficultyInput) {
    wordgunDifficultyInput.addEventListener("change", generateObsLink);
}

// Копирование ссылки для OBS при клике на иконку
const copyIcon = document.querySelector('.copy-icon');
if (copyIcon) {
    copyIcon.closest('.title')?.addEventListener('click', () => {
        if (obsLinkInput && obsLinkInput.value && !obsLinkInput.disabled) {
            navigator.clipboard.writeText(obsLinkInput.value).then(() => {
                showCopiedFeedback();
            });
        }
    });
}

// Клик по полю obs-link — выделение текста и копирование
if (obsLinkInput) {
    obsLinkInput.addEventListener('click', () => {
        if (obsLinkInput.value && !obsLinkInput.disabled) {
            obsLinkInput.select();
            navigator.clipboard.writeText(obsLinkInput.value).then(() => {
                showCopiedFeedback();
            });
        }
    });
}

function showCopiedFeedback() {
    const titleEl = copyIcon?.closest('.title');
    if (titleEl) {
        const spanEl = titleEl.querySelector('span');
        if (spanEl) {
            const originalText = spanEl.dataset.originalText || spanEl.textContent;
            spanEl.dataset.originalText = originalText;
            spanEl.textContent = 'Скопировано!';
            setTimeout(() => {
                spanEl.textContent = originalText;
            }, 1500);
        }
    }
}
