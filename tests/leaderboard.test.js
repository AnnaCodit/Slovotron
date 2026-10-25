const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const readScript = name => fs.readFileSync(path.join(__dirname, '..', 'js', name), 'utf8');

function setup(initialData = {}) {
    const storage = new Map([['word_game_leaderboard', JSON.stringify(initialData)]]);
    const elements = new Map();
    const createElement = () => ({
        style: {}, children: [], listeners: {}, value: '',
        classList: { contains: () => false, toggle() {} },
        addEventListener(name, callback) { this.listeners[name] = callback; },
        appendChild(child) { this.children.push(child); },
        set innerHTML(value) { this.children = []; },
        querySelector: () => createElement(),
        setCustomValidity() {}, reportValidity() {}, focus() {}
    });
    const getElement = id => {
        if (!elements.has(id)) elements.set(id, createElement());
        return elements.get(id);
    };
    const context = {
        localStorage: {
            getItem: key => storage.get(key) ?? null,
            setItem: (key, value) => storage.set(key, value),
            removeItem: key => storage.delete(key)
        },
        document: {
            getElementById: getElement, querySelector: getElement,
            querySelectorAll: () => [], createElement, body: createElement()
        },
        console: { log() {}, warn() {}, error(error) { throw error; } },
        setTimeout: () => 1, clearTimeout() {}, setInterval: () => 1, clearInterval() {},
        is_game_finished: false, winTime: 0, roundStartTime: 0,
        uniqUsers: new Set(), uniqWords: 0, repeatWords: 0, checked_words: new Map(),
        channel_name: 'streamer', game_backend: 'contextno', restart_time: 0,
        win_avatar_enable: false, MAX_CONFETTI_MS: 30000,
        window: { innerWidth: 800 }, tip_menu_button: createElement(),
        setManualGuessReady(ready) { context.manual_guess_ready = ready; },
        sendWebhookEvent() {}, analytics_reach_goal() {}, analytics_set_visit_params() {},
        confetti_stars() {}, confetti_win() {}, tmi_client: null,
        backend_supports_tips: () => false, words_count: 0, wordQueue: [],
        loadSettings: () => true, generate_secret_word: async () => 'test-round',
        current_secret_word_data: null, getTwitchTrackerChannelSummary: async () => null
    };
    vm.createContext(context);
    vm.runInContext(readScript('leaderboard.js'), context);
    vm.runInContext(readScript('ws.js'), context);
    context.play_win_sound = () => {};
    context.reset_round = () => {};
    return {
        context, getElement,
        data: () => JSON.parse(storage.get('word_game_leaderboard') ?? '{}')
    };
}

async function setupGame(apiUser, initialData = {}) {
    const game = setup(initialData);
    const guesses = [];
    game.context.getTwitchUserData = async () => apiUser;
    game.context.tmi = { Client: class {
        on(event, callback) { game.chatMessage = callback; }
        connect() { return Promise.resolve(); }
        disconnect() { return Promise.resolve(); }
    } };
    game.context.process_message = async user => { guesses.push(user); };
    await vm.runInContext(readScript('init.js'), game.context);
    game.manualWin = async () => {
        game.context.is_game_finished = false;
        game.context.setManualGuessReady(true);
        game.getElement('manual-guess-input').value = 'слово';
        game.getElement('manual-guess-form').listeners.submit({ preventDefault() {} });
        await new Promise(resolve => setImmediate(resolve));
        const winner = guesses.at(-1);
        assert.ok(winner, 'manual submission must reach the guess queue');
        game.context.handle_win(winner, 'слово');
        return winner;
    };
    return game;
}

const apiUser = { id: '42', login: 'streamer', displayName: 'Стример' };
const chatUser = {
    'user-id': '42', username: 'streamer', 'display-name': 'Стример',
    badges: { broadcaster: '1' }
};

test('chat, manual input, then chat retain all three wins under one ID', async () => {
    const game = await setupGame(apiUser);
    game.context.handle_win(chatUser);
    const manualUser = await game.manualWin();
    assert.equal(manualUser['user-id'], '42');
    assert.equal(manualUser['display-name'], 'Стример');
    game.context.handle_win(chatUser);
    assert.deepEqual(game.data(), { '42': { value: 3, name: 'Стример' } });
});

test('manual input before any chat message uses the API user ID', async () => {
    const game = await setupGame(apiUser);
    await game.manualWin();
    await game.manualWin();
    assert.deepEqual(game.data(), { '42': { value: 2, name: 'Стример' } });
});

test('ID wins absorb legacy display names, login aliases and name-keyed objects', () => {
    const game = setup({
        '42': { value: 8, name: 'Стример' },
        'СТРИМЕР': 2, streamer: { value: 3, name: 'streamer' }, StReAmEr: 4,
        Other: 6
    });
    game.context.handle_win(chatUser);
    assert.deepEqual(game.data(), { '42': { value: 18, name: 'Стример' }, Other: 6 });
});

test('the same key matching both ID and name is counted once', () => {
    const game = setup({ '42': 7 });
    game.context.updateLeaderboard('42', '42', '42');
    assert.deepEqual(game.data(), { '42': { value: 8, name: '42' } });
});

test('another ID entry is kept separate even when its key matches an alias', () => {
    const game = setup({ '99': { value: 10, name: 'Other' } });
    game.context.updateLeaderboard('42', '99');
    assert.deepEqual(game.data(), {
        '42': { value: 1, name: '99' }, '99': { value: 10, name: 'Other' }
    });
});

test('renaming a player keeps the ID count and updates the displayed name', () => {
    const game = setup({ '42': { value: 8, name: 'OldName' } });
    game.context.updateLeaderboard('42', 'NewName');
    assert.deepEqual(game.data(), { '42': { value: 9, name: 'NewName' } });
});

test('an API failure keeps manual input working and chat later merges its wins', async () => {
    const game = await setupGame(null);
    await game.manualWin();
    assert.deepEqual(game.data(), { streamer: { value: 1, name: 'streamer' } });
    await game.chatMessage('#streamer', chatUser, '!слв-топ');
    await game.manualWin();
    game.context.handle_win(chatUser);
    assert.deepEqual(game.data(), { '42': { value: 3, name: 'Стример' } });
});

test('old broadcaster messages cannot replace manual identity when switching channels', async () => {
    const game = await setupGame(apiUser);
    const oldChatMessage = game.chatMessage;
    game.context.channel_name = 'newstreamer';
    let finishLookup;
    game.context.getTwitchUserData = () => new Promise(resolve => { finishLookup = resolve; });
    const restarting = game.context.app();

    await oldChatMessage('#streamer', chatUser, '!слв-топ');
    finishLookup(null);
    await restarting;
    const winner = await game.manualWin();

    assert.equal(winner.username, 'newstreamer');
    assert.equal(winner['user-id'], undefined);
    assert.deepEqual(game.data(), { newstreamer: { value: 1, name: 'newstreamer' } });
});

test('viewer messages cannot replace the manual player identity', async () => {
    const game = await setupGame(apiUser);
    await game.chatMessage('#streamer', {
        'user-id': '99', username: 'viewer', 'display-name': 'Viewer', badges: {}
    }, '!слв-топ');
    await game.manualWin();
    assert.deepEqual(game.data(), { '42': { value: 1, name: 'Стример' } });
});

test('tips and TestUser stay separate without IDs and test cleanup still works', () => {
    const game = setup();
    game.context.updateLeaderboard(undefined, '💡 Подсказка');
    game.context.updateLeaderboard(undefined, 'TestUser');
    game.context.updateLeaderboard(undefined, '💡 Подсказка');
    assert.deepEqual(game.data(), {
        '💡 Подсказка': { value: 2, name: '💡 Подсказка' },
        TestUser: { value: 1, name: 'TestUser' }
    });
    game.context.removeTestUserFromLeaderboard();
    assert.equal('TestUser' in game.data(), false);
});

test('mixed legacy and ID entries render the top five by win count', () => {
    const game = setup({
        Legacy: 20, '42': { value: 10, name: 'Alice' }, Low: 1,
        '43': { value: 30, name: 'Bob' }, Mid: 5, '44': { value: 3, name: 'Cara' }
    });
    game.context.renderLeaderboard();
    const names = game.getElement('#leaderboard .list').children.map(row => row.children[1].textContent);
    assert.deepEqual(names, ['Bob', 'Legacy', 'Alice', 'Mid', 'Cara']);
});
