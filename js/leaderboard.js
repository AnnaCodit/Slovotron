// Leaderboard Logic
const LEADERBOARD_KEY = 'word_game_leaderboard';

function getLeaderboardData() {
    const data = localStorage.getItem(LEADERBOARD_KEY);
    return data ? JSON.parse(data) : {};
}

function saveLeaderboardData(data) {
    localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(data));
}

function updateLeaderboard(winnerName) {
    let data = getLeaderboardData();
    if (data[winnerName]) {
        data = Object.assign({ [winnerName]: data[winnerName]++ }, data);
    } else {
        data = Object.assign({ [winnerName]: 1 }, data);
    }
    saveLeaderboardData(data);
    renderLeaderboard();
    renderStatistic();
}

function renderLeaderboard() {
    const data = getLeaderboardData();
    const listContainer = document.querySelector('#leaderboard .list');
    if (!listContainer) return;

    listContainer.innerHTML = '';

    // Convert to array and sort
    const sortedWinners = Object.entries(data)
        .sort((a, b) => b[1] - a[1]) // Sort by count descending
        .slice(0, 5); // Take top 5

    if (sortedWinners.length === 0) {
        listContainer.innerHTML =
            '<div style="text-align:center;color:#777;">Пока нет победителей</div>';
        return;
    }

    const medals = ['🥇', '🥈', '🥉'];

    let medalLevel = 0;
    let previousWins = null;

    sortedWinners.forEach(([name, wins]) => {
        if (previousWins !== null && wins !== previousWins) {
            medalLevel++;
        }

        previousWins = wins;

        const itemDiv = document.createElement('div');
        itemDiv.className = 'leaderboard-item';

        const nameDiv = document.createElement('div');
        nameDiv.className = 'name';
        nameDiv.textContent = name;

        const scoreDiv = document.createElement('div');
        scoreDiv.className = 'score';

        const medal = medals[medalLevel] || '';

        scoreDiv.textContent = medal
            ? `${wins} ${medal}`
            : `${wins}`;

        itemDiv.appendChild(nameDiv);
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

// Event Listeners for Leaderboard
const leaderboardBtn = document.getElementById('menu-button-leaderboard');
if (leaderboardBtn) {
    leaderboardBtn.addEventListener('click', () => {
        const leaderboardSection = document.getElementById('leaderboard-statistic');
        // Toggle display
        const isVisible = leaderboardSection.style.display !== 'none';
        leaderboardSection.style.display = isVisible ? 'none' : 'flex';

        if (!isVisible) {
            renderLeaderboard();
            renderStatistic();
            lbStatRender = setInterval(function () {
                if (is_game_finished) { clearInterval(lbStatRender) }
                renderStatistic();
            }, 1000)
        } else {
            clearInterval(lbStatRender);
        }
    });
}

const resetLeaderboardBtns = document.querySelectorAll('.reset-leaderboard-btn');
for (const btn of resetLeaderboardBtns) {
    btn.addEventListener('click', resetLeaderboard);
}

function pad(val) { return val > 9 ? val : "0" + val; }

function renderStatistic() {
    if (!is_game_finished) { winTime = Date.now() }
    let roundTime = Math.floor((winTime - roundStartTime) / 1000);
    if (!roundTime) { roundTime = 0 }
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
