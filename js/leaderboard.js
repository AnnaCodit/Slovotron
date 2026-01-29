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
    const data = getLeaderboardData();
    if (data[winnerName]) {
        data[winnerName]++;
    } else {
        data[winnerName] = 1;
    }
    saveLeaderboardData(data);
    renderLeaderboard();
}

let cachedLeaderboardList = null;

function renderLeaderboard() {
    const data = getLeaderboardData();
    if (!cachedLeaderboardList) {
        cachedLeaderboardList = document.querySelector('#leaderboard .list');
    }
    if (!cachedLeaderboardList) return;

    cachedLeaderboardList.innerHTML = '';

    // Convert to array and sort
    const sortedWinners = Object.entries(data)
        .sort((a, b) => b[1] - a[1]) // Sort by count descending
        .slice(0, 5); // Take top 5

    if (sortedWinners.length === 0) {
        cachedLeaderboardList.innerHTML = '<div style="text-align: center; color: #777;">Пока нет победителей</div>';
        return;
    }

    sortedWinners.forEach((item, index) => {
        const name = item[0];
        const wins = item[1];

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

        cachedLeaderboardList.appendChild(itemDiv);
    });
}

function resetLeaderboard() {
    if (confirm('Вы уверены, что хотите сбросить таблицу лидеров?')) {
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
            lbStatRender = setInterval(function() {
                if (is_game_finished) {clearInterval(lbStatRender)}
                renderStatistic();
            }, 1000)
        } else {
            clearInterval(lbStatRender);
        }
    });
}

const resetLeaderboardBtn = document.getElementById('reset-leaderboard-btn');
if (resetLeaderboardBtn) {
    resetLeaderboardBtn.addEventListener('click', resetLeaderboard);
}

function pad ( val ) { return val > 9 ? val : "0" + val; }

let cachedUniqUsersEl = null;
let cachedUniqWordsEl = null;
let cachedRepeatedWordsEl = null;
let cachedRoundTimeEl = null;

function renderStatistic() {
    if (!is_game_finished) {winTime = Date.now()}
    let roundTime = Math.floor((winTime - roundStartTime) / 1000);
    if (!roundTime) { roundTime = 0}
    const roundTimeSec = pad(roundTime%60);
    const roundTimeMin = pad(parseInt(roundTime/60,10));
    const roundTimeQt = roundTimeMin + ':' + roundTimeSec;

    if (!cachedUniqUsersEl) cachedUniqUsersEl = document.getElementById('uniq-users');
    if (!cachedUniqWordsEl) cachedUniqWordsEl = document.getElementById('uniq-words');
    if (!cachedRepeatedWordsEl) cachedRepeatedWordsEl = document.getElementById('repeated-words');
    if (!cachedRoundTimeEl) cachedRoundTimeEl = document.getElementById('round-time');

    if (cachedUniqUsersEl) cachedUniqUsersEl.innerText = (typeof uniqUsers.size !== 'undefined' ? uniqUsers.size : 0);
    if (cachedUniqWordsEl) cachedUniqWordsEl.innerText = (typeof uniqWords !== 'undefined' ? uniqWords : 0);
    if (cachedRepeatedWordsEl) cachedRepeatedWordsEl.innerText = (typeof repeatWords !== 'undefined' ? repeatWords : 0);
    if (cachedRoundTimeEl) cachedRoundTimeEl.innerText = (typeof roundTimeQt !== 'undefined' ? roundTimeQt : 0);
}
