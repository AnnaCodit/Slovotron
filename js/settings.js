const channelInput = document.getElementById("channel-name");
const restartInput = document.getElementById("restart-time");
const avatarInput = document.getElementById('win-avatar-enable');
const soundInput = document.getElementById('sound-enable');
const saveBtn = document.getElementById('save-settings-btn');
let validationTimeout;

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

    const urlChannel = urlParams.get('channel_name');
    if (urlChannel) {
        localStorage.setItem('channel_name', urlChannel);
    }
    const storedChannel = urlChannel || localStorage.getItem('channel_name');
    const storedRestartTime = urlParams.get('restart_time') || localStorage.getItem('restart_time');
    const storedAvatarInput = urlParams.get('win_avatar_enable') || localStorage.getItem('win_avatar_enable');
    const storedSoundInput = urlParams.get('sound_enable') || localStorage.getItem('sound_enable');

    if (storedChannel) {
        channel_name = storedChannel;
        if (channelInput) channelInput.value = channel_name;
    }

    if (storedRestartTime) {
        restart_time = parseInt(storedRestartTime, 10);
        if (restartInput) restartInput.value = restart_time;
    }

    if (storedAvatarInput) {
        win_avatar_enable = storedAvatarInput === 'true';
        if (avatarInput) avatarInput.checked = win_avatar_enable;
    }

    if (storedSoundInput) {
        sound_enable = storedSoundInput === 'true';
        if (soundInput) soundInput.checked = sound_enable;
    }

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
    settingsSection.style.display = settingsSection.style.display === 'none' ? 'block' : 'none';
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
