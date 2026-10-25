// Leaderboard Logic
const LEADERBOARD_KEY = 'word_game_leaderboard';
let lbStatRender;
let leaderboardHideTimeoutId;

function getLeaderboardData() {
    const data = localStorage.getItem(LEADERBOARD_KEY);
    if (!data) return {};
    try {
        const parsed = JSON.parse(data);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
        // Corrupted or legacy non-object value: drop it so we don't re-parse garbage every call.
        localStorage.removeItem(LEADERBOARD_KEY);
        return {};
    } catch (e) {
        console.error('Failed to parse leaderboard data, resetting:', e);
        localStorage.removeItem(LEADERBOARD_KEY);
        return {};
    }
}

function saveLeaderboardData(data) {
    localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(data));
}

function updateLeaderboard(winnerId, winnerName, winnerLogin = '') {
    const winnerKey = winnerId || winnerName;
    if (!winnerKey) return;
    const data = getLeaderboardData();
    const keysToMerge = new Set([String(winnerKey)]);

    if (winnerId) {
        const aliases = new Set([winnerName, winnerLogin].filter(Boolean).map(name => name.toLowerCase()));
        for (const [key, entry] of Object.entries(data)) {
            // Merge name-keyed records only; another player's ID must remain separate.
            const isNameKey = typeof entry === 'number' || (entry && key === entry.name);
            if (isNameKey && aliases.has(key.toLowerCase())) keysToMerge.add(key);
        }
    }

    let wins = 1;
    for (const key of keysToMerge) {
        const entry = data[key];
        const count = entry && typeof entry === 'object' ? entry.value : entry;
        if (Number.isFinite(count)) wins += count;
        delete data[key];
    }
    saveLeaderboardData({ ...data, [winnerKey]: { value: wins, name: winnerName } });
    renderLeaderboard();
    renderStatistic();
}

function renderLeaderboard() {
    const data = getLeaderboardData();
    listContainer = document.querySelector('#leaderboard .list');
    if (!listContainer) return;

    listContainer.innerHTML = '';

    // Convert to array and sort
    const sortedWinners = Object.entries(data)
        .sort((a, b) => {
            const aValue = a[1] && typeof a[1] === 'object' ? a[1].value : a[1]
            const bValue = b[1] && typeof b[1] === 'object' ? b[1].value : b[1]

            return bValue - aValue
        }) // Sort by count descending
        .slice(0, 5); // Take top 5

    if (sortedWinners.length === 0) {
        listContainer.innerHTML = '<div style="text-align: center; color: #777;">Пока нет победителей</div>';
        return;
    }

    sortedWinners.forEach((item, index) => {
        const isObject = item[1] && typeof item[1] === 'object' && 'name' in item[1]
        const name = isObject ? item[1].name : item[0];
        const wins = isObject ? item[1].value : item[1];

        const itemDiv = document.createElement('div');
        itemDiv.className = 'leaderboard-item';

        const rankDiv = document.createElement('div');
        rankDiv.className = 'rank';
        rankDiv.textContent = `#${index + 1}`;
        itemDiv.appendChild(rankDiv);

        const nameDiv = document.createElement('div');
        nameDiv.className = 'name';
        nameDiv.textContent = name; // Safe assignment
        itemDiv.appendChild(nameDiv);

        const scoreDiv = document.createElement('div');
        scoreDiv.className = 'score';
        scoreDiv.textContent = `${wins} 🏆`;
        itemDiv.appendChild(scoreDiv);

        listContainer.appendChild(itemDiv);
    });
}

function resetLeaderboard() {
    let doReset = false;
    if (document.body.classList.contains('obs-overlay')) {
        doReset = true;
    } else {
        if (confirm('Вы уверены, что хотите сбросить таблицу лидеров?')) {
            doReset = true;
        }
    }
    if (doReset) {
        localStorage.removeItem(LEADERBOARD_KEY);
        renderLeaderboard();
    }
}

function setLeaderboardVisible(isVisible) {
    const leaderboardSection = document.getElementById('leaderboard-statistic');
    clearTimeout(leaderboardHideTimeoutId);
    clearInterval(lbStatRender);
    leaderboardSection.style.display = isVisible ? 'flex' : 'none';

    if (isVisible) {
        renderLeaderboard();
        renderStatistic();
        lbStatRender = setInterval(function () {
            if (is_game_finished) {
                clearInterval(lbStatRender)
            }
            renderStatistic();
        }, 1000)
    }
}

function showLeaderboardTemporarily() {
    const leaderboardSection = document.getElementById('leaderboard-statistic');
    if (leaderboardSection.style.display !== 'none') return;

    setLeaderboardVisible(true);
    leaderboardHideTimeoutId = setTimeout(() => {
        leaderboardHideTimeoutId = null;
        // На экране победы статистика должна оставаться видимой.
        if (!is_game_finished) setLeaderboardVisible(false);
    }, 5000);
}

// Event Listeners for Leaderboard
const leaderboardBtn = document.getElementById('menu-button-leaderboard');
if (leaderboardBtn) {
    leaderboardBtn.addEventListener('click', () => {
        const leaderboardSection = document.getElementById('leaderboard-statistic');
        // Toggle display
        const isVisible = leaderboardSection.style.display !== 'none';
        setLeaderboardVisible(!isVisible);
    });
}

const resetLeaderboardBtns = document.querySelectorAll('.reset-leaderboard-btn');
for (const btn of resetLeaderboardBtns) {
    btn.addEventListener('click', resetLeaderboard);
}

function pad(val) {
    return val > 9 ? val : "0" + val;
}

function renderStatistic() {
    if (!is_game_finished) {
        winTime = Date.now()
    }
    let roundTime = Math.floor((winTime - roundStartTime) / 1000);
    if (!roundTime) {
        roundTime = 0
    }
    const roundTimeSec = pad(roundTime % 60);
    const roundTimeMin = pad(parseInt(roundTime / 60, 10));
    const roundTimeQt = roundTimeMin + ':' + roundTimeSec;
    document.getElementById('uniq-users').innerText = uniqUsers?.size ?? 0;
    document.getElementById('uniq-words').innerText = uniqWords ?? 0;
    document.getElementById('repeated-words').innerText = repeatWords ?? 0;
    document.getElementById('round-time').innerText = roundTimeQt ?? '00:00';
}

// function to remove testuser from leaderboard
function removeTestUserFromLeaderboard() {
    const leaderboard = getLeaderboardData();
    if (leaderboard['TestUser']) {
        delete leaderboard['TestUser'];
        saveLeaderboardData(leaderboard);
    }
}

document.getElementById('remove-test-user-from-leaderboard').addEventListener('click', removeTestUserFromLeaderboard);
