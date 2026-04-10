// ext-panel-leaderboard.js — простая таблица лидеров для viewer panel.
// Хранит победителей в localStorage (per-browser). Управляется через leaderboard-panel.

const PANEL_LB_KEY = 'slovotron_panel_leaderboard';

function getPanelLeaderboard() {
    try {
        return JSON.parse(localStorage.getItem(PANEL_LB_KEY) || '{}');
    } catch (e) { return {}; }
}

function addPanelWin(name) {
    if (!name) return;
    const data = getPanelLeaderboard();
    data[name] = (data[name] || 0) + 1;
    localStorage.setItem(PANEL_LB_KEY, JSON.stringify(data));
    renderPanelLeaderboard();
}

function renderPanelLeaderboard() {
    const list = document.getElementById('leaderboard-list');
    if (!list) return;

    const data = getPanelLeaderboard();
    const sorted = Object.entries(data).sort((a, b) => b[1] - a[1]).slice(0, 5);

    if (sorted.length === 0) {
        list.innerHTML = '<div class="top3-empty">Пока нет победителей</div>';
        return;
    }

    list.innerHTML = sorted.map(([name, wins], i) =>
        `<div class="lb-item">
            <span class="rank">#${i + 1}</span>
            <span class="name">${name}</span>
            <span class="wins">${wins} 🏆</span>
        </div>`
    ).join('');
}

document.addEventListener('DOMContentLoaded', () => {
    // Кнопка переключения лидерборда
    const lbBtn = document.getElementById('menu-button-leaderboard');
    const lbPanel = document.getElementById('leaderboard-panel');
    if (lbBtn && lbPanel) {
        lbBtn.addEventListener('click', () => {
            const visible = lbPanel.style.display !== 'none';
            lbPanel.style.display = visible ? 'none' : 'block';
            if (!visible) renderPanelLeaderboard();
        });
    }

    // Кнопка сброса
    const resetBtn = document.getElementById('reset-leaderboard-btn');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            if (confirm('Сбросить таблицу лидеров?')) {
                localStorage.removeItem(PANEL_LB_KEY);
                renderPanelLeaderboard();
            }
        });
    }
});

// Экспорт для ext-viewer.js (вызывается при победе)
window.panelLeaderboardAddWin = addPanelWin;
