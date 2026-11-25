const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const readScript = name => fs.readFileSync(path.join(__dirname, '..', 'js', name), 'utf8');

function createElement(id = '') {
    const el = {
        id,
        style: {},
        children: [],
        listeners: {},
        value: '',
        innerText: '',
        innerHTMLValue: '',
        src: '',
        dataset: {},
        classList: {
            classes: new Set(),
            add(name) { this.classes.add(name); },
            remove(name) { this.classes.delete(name); },
            contains(name) { return this.classes.has(name); },
            toggle(name, force) {
                if (force === undefined) {
                    if (this.classes.has(name)) this.classes.delete(name);
                    else this.classes.add(name);
                    return;
                }
                if (force) this.classes.add(name);
                else this.classes.delete(name);
            }
        },
        addEventListener(name, callback) { this.listeners[name] = callback; },
        appendChild(child) { this.children.push(child); return child; },
        insertBefore(child, ref) {
            const idx = this.children.indexOf(ref);
            if (idx === -1) this.children.push(child);
            else this.children.splice(idx, 0, child);
            return child;
        },
        removeChild(child) {
            const idx = this.children.indexOf(child);
            if (idx !== -1) this.children.splice(idx, 1);
            return child;
        },
        insertAdjacentHTML(pos, html) {
            this.insertedHtml = this.insertedHtml || [];
            this.insertedHtml.unshift(html);
            this.children.unshift(createElement('msg'));
        },
        querySelector() {
            if (!this._sub) this._sub = createElement();
            return this._sub;
        },
        setCustomValidity() {},
        reportValidity() {},
        focus() {}
    };
    Object.defineProperty(el, 'innerHTML', {
        get() { return el.innerHTMLValue; },
        set(value) {
            el.innerHTMLValue = value;
            if (value === '') el.children = [];
            else {
                const match = String(value).match(/data-distance="([^"]+)"/);
                const child = createElement('parsed');
                if (match) child.dataset.distance = match[1];
                el.firstElementChild = child;
            }
        }
    });
    Object.defineProperty(el, 'lastElementChild', {
        get() { return el.children[el.children.length - 1] || null; }
    });
    return el;
}

function setupRoundEnv({ withAnalytics = true, loadInit = true, withRealApi = false } = {}) {
    const elements = new Map();
    const getElement = id => {
        if (!elements.has(id)) elements.set(id, createElement(id));
        return elements.get(id);
    };
    const queries = new Map();
    let errorOverlayElement = null;
    const bodyElement = createElement('body');
    const origBodyInsert = bodyElement.insertAdjacentHTML.bind(bodyElement);
    bodyElement.insertAdjacentHTML = (pos, html) => {
        origBodyInsert(pos, html);
        if (String(html).includes('error-overlay')) {
            const overlay = createElement('.error-overlay');
            overlay.html = html;
            overlay.remove = () => {
                if (errorOverlayElement === overlay) errorOverlayElement = null;
            };
            errorOverlayElement = overlay;
        }
    };

    const query = sel => {
        if (sel === '.error-overlay') return errorOverlayElement;
        if (!queries.has(sel)) queries.set(sel, createElement(sel));
        return queries.get(sel);
    };

    const timers = new Map();
    const intervals = new Map();
    let nextTimerId = 1;
    const activeTimers = new Set();
    const activeIntervals = new Set();

    const chatClients = [];
    const tipCalls = [];
    const winCalls = [];
    const webhooks = [];
    let resetRoundCount = 0;

    const context = {
        document: {
            hidden: false,
            getElementById: getElement,
            querySelector: query,
            querySelectorAll: () => [],
            createElement: () => createElement(),
            dispatchEvent() {},
            addEventListener() {},
            body: bodyElement
        },
        window: { innerWidth: 800 },
        CustomEvent: class { constructor(name, opts) { this.name = name; this.detail = opts?.detail; } },
        Audio: class { play() { return Promise.resolve(); } },
        console: { log() {}, warn() {}, error() {} },
        Date,
        Math,
        URL,
        URLSearchParams,
        AbortController,
        setTimeout: (fn, ms) => {
            const id = nextTimerId++;
            timers.set(id, { fn, ms });
            activeTimers.add(id);
            return id;
        },
        clearTimeout: id => { activeTimers.delete(id); timers.delete(id); },
        setInterval: (fn, ms) => {
            const id = nextTimerId++;
            intervals.set(id, { fn, ms });
            activeIntervals.add(id);
            return id;
        },
        clearInterval: id => { activeIntervals.delete(id); intervals.delete(id); },
        confetti() {},
        tmi: {
            Client: class {
                constructor(opts) {
                    this.channels = opts?.channels || [];
                    this.callbacks = {};
                    this.disconnected = false;
                    chatClients.push(this);
                }
                on(ev, cb) { this.callbacks[ev] = cb; }
                connect() { return Promise.resolve(); }
                disconnect() {
                    this.disconnected = true;
                    return Promise.resolve();
                }
            }
        }
    };

    vm.createContext(context);
    vm.runInContext(readScript('config.js'), context);
    if (withRealApi) {
        vm.runInContext(readScript('api.js'), context);
    }
    vm.runInContext(readScript('banwords.js'), context);

    context.tip_menu_button = getElement('menu-button-tip');
    context.setManualGuessReady = ready => {
        vm.runInContext(`manual_guess_ready = ${Boolean(ready)};`, context);
    };
    context.loadSettings = () => {
        vm.runInContext(`channel_name = 'streamer';`, context);
        return true;
    };
    if (!withRealApi) {
        context.getActiveBackend = () => ({ id: 'kontekstno', supportsTips: true, maxDistance: 300 });
        context.backend_supports_tips = () => true;
        context.backend_max_distance = () => 300;
        context.generate_secret_word = async () => 'round-1';
        context.score_word = async () => ({ distance: 50 });
        context.backend_game_is_live = async () => true;
        context.getTwitchUserData = async () => ({ id: '42', login: 'streamer', displayName: 'Стример' });
        context.getTwitchTrackerChannelSummary = async () => null;
        context.sendWebhookEvent = (event, data) => { webhooks.push({ event, data }); };
        context.sendWinNotification = () => {};
        context.show_fullscreen_error = msg => {
            bodyElement.insertAdjacentHTML('beforeend', `<div class="error-overlay">${msg}</div>`);
        };
    } else {
        context.sendWebhookEvent = (event, data) => { webhooks.push({ event, data }); };
        context.sendWinNotification = () => {};
        context.getTwitchUserData = async () => ({ id: '42', login: 'streamer', displayName: 'Стример' });
        context.getTwitchTrackerChannelSummary = async () => null;
    }
    context.reset_tips = () => {};
    context.use_tip = (user, force) => { tipCalls.push({ user, force }); };
    context.pad = val => (val > 9 ? String(val) : '0' + val);
    context.updateLeaderboard = () => {};
    context.setLeaderboardVisible = isVisible => {
        getElement('leaderboard-statistic').style.display = isVisible ? 'flex' : 'none';
    };
    context.showLeaderboardTemporarily = () => {};
    context.loadWordgunOptions = () => {};

    if (withAnalytics) {
        context.analytics_set_visit_params = () => {};
        context.analytics_reach_goal = () => {};
    }

    vm.runInContext(readScript('confetti.js'), context);
    vm.runInContext(readScript('ws.js'), context);

    const origResetRound = context.reset_round;
    context.reset_round = () => {
        resetRoundCount++;
        return origResetRound();
    };
    const origHandleWin = context.handle_win;
    context.handle_win = (winnerUser, winningWord) => {
        winCalls.push({ winnerUser, winningWord });
        return origHandleWin(winnerUser, winningWord);
    };

    const evalExpr = expr => vm.runInContext(expr, context);

    return {
        context,
        getElement,
        query,
        timers,
        intervals,
        activeTimers,
        activeIntervals,
        chatClients,
        tipCalls,
        winCalls,
        webhooks,
        getErrorOverlay: () => errorOverlayElement,
        eval: evalExpr,
        setVar: (name, value) => vm.runInContext(`${name} = ${JSON.stringify(value)};`, context),
        getResetRoundCount: () => resetRoundCount,
        chatMessage: () => chatClients.at(-1)?.callbacks?.message,
        async initApp() {
            if (loadInit) {
                await vm.runInContext(readScript('init.js'), context);
            }
        }
    };
}

test('failed start_new_round keeps input disabled, shows restart button & overlay, blocks old guesses, and cleans up on recovery', async () => {
    const env = setupRoundEnv({ loadInit: false });
    env.setVar('secret_word_id', 'old-round');
    let shouldFail = true;
    env.context.generate_secret_word = async () => {
        if (shouldFail) throw new Error('API down');
        return 'new-round';
    };

    const started = await env.context.start_new_round();
    assert.equal(started, false);
    assert.equal(env.eval('is_game_finished'), true);
    assert.equal(env.eval('manual_guess_ready'), false);
    assert.equal(env.eval('secret_word_id'), 'old-round');
    assert.equal(env.getElement('menu-button-restart').style.display, 'block');
    assert.ok(env.getErrorOverlay());

    let scoreCalls = 0;
    env.context.score_word = async () => { scoreCalls++; return { distance: 1 }; };
    await env.context.process_message({ username: 'viewer', 'display-name': 'Viewer' }, '#FFF', 'слово');
    assert.equal(scoreCalls, 0);

    shouldFail = false;
    const recovered = await env.context.start_new_round();
    assert.equal(recovered, true);
    assert.equal(env.eval('is_game_finished'), false);
    assert.equal(env.eval('manual_guess_ready'), true);
    assert.equal(env.eval('secret_word_id'), 'new-round');
    assert.equal(env.getElement('menu-button-restart').style.display, 'none');
    assert.equal(env.getErrorOverlay(), null);
});

test('app() on win screen cancels restart timers, resets resetTimerPaused, and hides win UI', async () => {
    const env = setupRoundEnv();
    await env.initApp();

    env.setVar('restart_time', 20);
    env.context.handle_win({ username: 'alice', 'display-name': 'Alice', 'user-id': '1' }, 'победа');
    assert.equal(env.eval('is_game_finished'), true);
    assert.equal(env.getElement('winner').style.display, 'block');
    assert.equal(env.getElement('menu-timer').style.display, 'block');
    assert.equal(env.getElement('leaderboard-statistic').style.display, 'flex');

    env.getElement('menu-timer').listeners.click();
    assert.equal(env.eval('resetTimerPaused'), true);
    assert.equal(env.getElement('menu-button-restart').style.display, 'block');

    env.context.handle_win({ username: 'bob', 'display-name': 'Bob', 'user-id': '2' }, 'финал');
    const restartTimerId = env.eval('resetRoundTimeoutId');
    const countdownTimerId = env.eval('menuTimerId');
    assert.ok(env.activeTimers.has(restartTimerId));
    assert.ok(env.activeIntervals.has(countdownTimerId));

    env.context.generate_secret_word = async () => 'round-after-save';
    await env.context.app();

    assert.equal(env.eval('is_game_finished'), false);
    assert.equal(env.eval('manual_guess_ready'), true);
    assert.equal(env.eval('resetTimerPaused'), false);
    assert.equal(env.eval('secret_word_id'), 'round-after-save');
    assert.equal(env.eval('resetRoundTimeoutId'), undefined);
    assert.equal(env.eval('menuTimerId'), undefined);
    assert.equal(env.activeTimers.has(restartTimerId), false);
    assert.equal(env.activeIntervals.has(countdownTimerId), false);
    assert.equal(env.getElement('winner').style.display, 'none');
    assert.equal(env.getElement('menu-timer').style.display, 'none');
    assert.equal(env.getElement('menu-button-restart').style.display, 'none');
    assert.equal(env.getElement('leaderboard-statistic').style.display, 'none');
});

test('concurrent start_new_round calls ignore both stale resolution and stale rejection', async () => {
    const env = setupRoundEnv({ loadInit: false });
    let resolveFirst;
    let rejectFirst;
    let callNum = 0;
    env.context.generate_secret_word = () => {
        callNum++;
        if (callNum === 1) return new Promise(resolve => { resolveFirst = resolve; });
        if (callNum === 2) return Promise.resolve('second-round');
        if (callNum === 3) return new Promise((_, reject) => { rejectFirst = reject; });
        return Promise.resolve('fourth-round');
    };

    const firstStart = env.context.start_new_round();
    const secondStart = env.context.start_new_round();
    assert.equal(await secondStart, true);
    const resetsAfterSecond = env.getResetRoundCount();

    resolveFirst('stale-first-round');
    assert.equal(await firstStart, false);
    assert.equal(env.eval('secret_word_id'), 'second-round');
    assert.equal(env.getResetRoundCount(), resetsAfterSecond);
    assert.equal(env.getElement('menu-button-restart').style.display, 'none');

    const thirdStart = env.context.start_new_round();
    const fourthStart = env.context.start_new_round();
    assert.equal(await fourthStart, true);

    rejectFirst(new Error('stale rejection'));
    assert.equal(await thirdStart, false);
    assert.equal(env.eval('secret_word_id'), 'fourth-round');
    assert.equal(env.eval('is_game_finished'), false);
    assert.equal(env.eval('manual_guess_ready'), true);
    assert.equal(env.getElement('menu-button-restart').style.display, 'none');
    assert.equal(env.getErrorOverlay(), null);
    assert.equal(env.eval('round_retry_timeout_id'), null);
});

test('real api.js generate_secret_word interrupted by start_new_round neither pops error-overlay nor overwrites current_secret_word_data', async () => {
    const env = setupRoundEnv({ loadInit: false, withRealApi: true });
    let rejectWordgun;
    let resolveWordgun;

    // 1. Stale wordgun failure with e.userMessage must not show .error-overlay over active kontekstno round
    env.eval(`
        GAME_BACKENDS.wordgun.createGame = () => new Promise((_, reject) => {
            globalThis.__rejectWg = reject;
        });
        GAME_BACKENDS.kontekstno.createGame = async () => ({ gameId: 'k-round-1', secretWord: 'космос' });
    `);

    env.setVar('game_backend', 'wordgun');
    const wgStart = env.context.start_new_round();
    await new Promise(resolve => setImmediate(resolve));
    rejectWordgun = env.eval('globalThis.__rejectWg');

    env.setVar('game_backend', 'kontekstno');
    const kStart = env.context.start_new_round();
    assert.equal(await kStart, true);
    assert.equal(env.eval('secret_word_id'), 'k-round-1');
    assert.equal(env.eval('current_secret_word_data.secret_word'), 'космос');

    const cfgErr = new Error('Wordgun HTTP 400');
    cfgErr.userMessage = 'Выбранная сложность Wordgun больше не поддерживается.';
    rejectWordgun(cfgErr);
    assert.equal(await wgStart, false);
    assert.equal(env.getErrorOverlay(), null);
    assert.equal(env.eval('secret_word_id'), 'k-round-1');

    // 2. Late resolution of stale createGame must not overwrite current_secret_word_data
    env.eval(`
        GAME_BACKENDS.wordgun.createGame = () => new Promise(resolve => {
            globalThis.__resolveWg = resolve;
        });
        GAME_BACKENDS.kontekstno.createGame = async () => ({ gameId: 'k-round-2', secretWord: 'новое' });
    `);
    env.setVar('game_backend', 'wordgun');
    const wgStart2 = env.context.start_new_round();
    await new Promise(resolve => setImmediate(resolve));
    resolveWordgun = env.eval('globalThis.__resolveWg');

    env.setVar('game_backend', 'kontekstno');
    assert.equal(await env.context.start_new_round(), true);

    resolveWordgun({ gameId: 'wg-stale', secretWord: 'устаревшее' });
    assert.equal(await wgStart2, false);
    assert.equal(env.eval('secret_word_id'), 'k-round-2');
    assert.equal(env.eval('current_secret_word_data.challenge_id'), 'k-round-2');
    assert.equal(env.eval('current_secret_word_data.secret_word'), 'новое');
});

test('automatic backoff retry recovers unattended OBS round after transient failures and caps at 60s', async () => {
    const env = setupRoundEnv({ loadInit: false });
    let failCount = 4;
    env.context.generate_secret_word = async () => {
        if (failCount-- > 0) throw new Error('temporary network outage');
        return 'recovered-round';
    };

    assert.equal(await env.context.start_new_round(), false);
    assert.ok(env.getErrorOverlay());
    // Simulate user closing the error modal; background retries must not re-open it
    env.getErrorOverlay().remove();

    const delays = [];
    for (let i = 0; i < 3; i++) {
        const timerId = env.eval('round_retry_timeout_id');
        assert.ok(timerId);
        const entry = env.timers.get(timerId);
        delays.push(entry.ms);
        entry.fn();
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(env.eval('is_game_finished'), true);
        assert.equal(env.eval('round_retry_attempt'), i + 2);
        assert.equal(env.getErrorOverlay(), null);
    }
    assert.deepEqual(delays, [15000, 30000, 60000]);

    // 4th retry (still capped at 60000ms) succeeds
    const finalTimerId = env.eval('round_retry_timeout_id');
    assert.equal(env.timers.get(finalTimerId).ms, 60000);
    env.timers.get(finalTimerId).fn();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(env.eval('secret_word_id'), 'recovered-round');
    assert.equal(env.eval('is_game_finished'), false);
    assert.equal(env.eval('manual_guess_ready'), true);
    assert.equal(env.eval('round_retry_timeout_id'), null);
    assert.equal(env.eval('round_retry_attempt'), 0);

    // Permanent settings error (e.userMessage) schedules NO auto-retry timer
    env.context.generate_secret_word = async () => {
        const err = new Error('unknown difficulty');
        err.userMessage = 'Выберите другую сложность';
        throw err;
    };
    assert.equal(await env.context.start_new_round(), false);
    assert.ok(env.getErrorOverlay());
    assert.equal(env.eval('round_retry_timeout_id'), null);
});

test('app() disconnects old tmi_client immediately and defers opening round until streamerUser is ready', async () => {
    const env = setupRoundEnv();
    await env.initApp();
    const clientA = env.chatClients[0];
    assert.equal(clientA.disconnected, false);

    let resolveUserB;
    let scoreCalls = 0;
    env.context.loadSettings = () => {
        vm.runInContext(`channel_name = 'channel_b';`, env.context);
        return true;
    };
    env.context.generate_secret_word = async () => 'round-b';
    env.context.getTwitchUserData = () => new Promise(resolve => { resolveUserB = resolve; });
    env.context.score_word = async () => { scoreCalls++; return { distance: 10 }; };

    const appPromise = env.context.app();
    await new Promise(resolve => setImmediate(resolve));

    // Old client disconnected immediately; round is still closed while getTwitchUserData('channel_b') is pending
    assert.equal(clientA.disconnected, true);
    assert.equal(env.eval('is_game_finished'), true);
    assert.equal(env.eval('manual_guess_ready'), false);

    // Late message from old client A must be ignored
    await clientA.callbacks.message('#channel_a', { username: 'viewer_a', 'display-name': 'ViewerA' }, 'слово');
    assert.equal(scoreCalls, 0);

    resolveUserB({ id: '777', login: 'channel_b', displayName: 'ChannelB' });
    await appPromise;

    assert.equal(env.eval('is_game_finished'), false);
    assert.equal(env.eval('manual_guess_ready'), true);
    assert.equal(env.eval('streamerUser["user-id"]'), '777');
    assert.equal(env.chatClients.length, 2);
    assert.deepEqual([...env.chatClients[1].channels], ['channel_b']);
});

test('no double win when round finishes while score_word is awaiting', async () => {
    const env = setupRoundEnv({ loadInit: false });
    env.setVar('secret_word_id', 'round-1');
    env.setVar('is_game_finished', false);
    let resolveScore;
    env.context.score_word = () => new Promise(resolve => { resolveScore = resolve; });

    const pendingGuess = env.context.process_message(
        { username: 'viewer', 'display-name': 'Viewer' },
        '#FFF',
        'победа'
    );

    env.context.handle_win({ username: 'podskazka', 'display-name': '💡 Подсказка' }, 'победа');
    resolveScore({ distance: 1 });
    await pendingGuess;

    assert.equal(env.winCalls.length, 1);
    assert.equal(env.eval('checked_words.has("победа")'), false);
});

test('wordQueue tail stays bound to its round even when new round word is queued before old word resolves', async () => {
    const env = setupRoundEnv();
    let roundCounter = 0;
    let resolveWord1;
    const scored = [];
    env.context.generate_secret_word = async () => `round-${++roundCounter}`;
    env.context.score_word = (word, gameId) => {
        scored.push({ word, gameId });
        if (word === 'первое') {
            return new Promise(resolve => { resolveWord1 = resolve; });
        }
        return Promise.resolve({ distance: 25 });
    };

    await env.initApp();
    assert.equal(env.eval('secret_word_id'), 'round-1');

    const chat = env.chatMessage();
    await chat('#streamer', { username: 'u1', 'display-name': 'U1' }, 'первое');
    await chat('#streamer', { username: 'u2', 'display-name': 'U2' }, 'второе');

    assert.deepEqual(scored, [{ word: 'первое', gameId: 'round-1' }]);

    await env.context.start_new_round();
    assert.equal(env.eval('secret_word_id'), 'round-2');

    // Enqueue Round 2 word BEFORE Round 1's score_word resolves
    await chat('#streamer', { username: 'u3', 'display-name': 'U3' }, 'третье');
    assert.equal(env.eval('wordQueue.length'), 3);

    resolveWord1({ distance: 15 });
    await new Promise(resolve => setImmediate(resolve));
    await new Promise(resolve => setImmediate(resolve));
    await new Promise(resolve => setImmediate(resolve));

    assert.deepEqual(scored, [
        { word: 'первое', gameId: 'round-1' },
        { word: 'третье', gameId: 'round-2' }
    ]);
    assert.equal(env.eval('checked_words.has("первое")'), false);
    assert.equal(env.eval('checked_words.has("второе")'), false);
    assert.equal(env.eval('checked_words.has("третье")'), true);
});

test('stale catch branch in process_message neither checks backend_game_is_live nor renders into new round', async () => {
    const env = setupRoundEnv({ loadInit: false });
    env.setVar('secret_word_id', 'round-1');
    let rejectScore;
    let isLiveCalls = 0;
    env.context.score_word = () => new Promise((_, reject) => { rejectScore = reject; });
    env.context.backend_game_is_live = async () => { isLiveCalls++; return false; };

    const p1 = env.context.process_message({ username: 'u1', 'display-name': 'U1' }, '#FFF', 'слово');
    env.setVar('secret_word_id', 'round-2');
    rejectScore(new Error('network fail'));
    await p1;
    assert.equal(isLiveCalls, 0);
    assert.equal((env.query('.guessing .last-words').insertedHtml || []).length, 0);

    let resolveLive;
    env.context.score_word = async () => { throw new Error('network fail'); };
    env.context.backend_game_is_live = () => new Promise(resolve => { resolveLive = resolve; });
    const p2 = env.context.process_message({ username: 'u2', 'display-name': 'U2' }, '#FFF', 'другое');
    await new Promise(resolve => setImmediate(resolve));
    env.setVar('secret_word_id', 'round-3');
    resolveLive(false);
    await p2;
    assert.equal((env.query('.guessing .last-words').insertedHtml || []).length, 0);
});

test('moderator commands !слв-рестарт, !слв-рес work in active round, after failure, and on win screen', async () => {
    const env = setupRoundEnv();
    let roundCounter = 0;
    let shouldFail = false;
    env.context.generate_secret_word = async () => {
        if (shouldFail) throw new Error('temp down');
        return `round-${++roundCounter}`;
    };
    await env.initApp();

    const chat = env.chatMessage();
    const modUser = { username: 'moduser', 'display-name': 'Mod', mod: true };

    await chat('#streamer', modUser, '!слв-рестарт');
    assert.equal(env.eval('secret_word_id'), 'round-2');
    assert.equal(env.tipCalls.length, 0);

    await chat('#streamer', modUser, '!слв-подсказка');
    assert.deepEqual(env.tipCalls, [{ user: 'moduser', force: true }]);

    // Recovery after failed start_new_round (when is_game_finished === true)
    shouldFail = true;
    assert.equal(await env.context.start_new_round(), false);
    assert.equal(env.eval('is_game_finished'), true);
    assert.ok(env.getErrorOverlay());
    assert.ok(env.eval('round_retry_timeout_id'));

    shouldFail = false;
    await chat('#streamer', modUser, '!слв-рес');
    assert.equal(env.eval('secret_word_id'), 'round-3');
    assert.equal(env.eval('is_game_finished'), false);
    assert.equal(env.getErrorOverlay(), null);
    assert.equal(env.eval('round_retry_timeout_id'), null);

    // Early restart from win screen (when is_game_finished === true)
    env.setVar('restart_time', 20);
    env.context.handle_win({ username: 'alice', 'display-name': 'Alice', 'user-id': '1' }, 'слово');
    assert.equal(env.eval('is_game_finished'), true);
    await chat('#streamer', modUser, '!sres');
    assert.equal(env.eval('secret_word_id'), 'round-4');
    assert.equal(env.eval('is_game_finished'), false);
    assert.equal(env.getElement('winner').style.display, 'none');
});

test('#test-win-btn triggers force_win on the current round', async () => {
    const env = setupRoundEnv({ loadInit: false });
    env.setVar('secret_word_id', 'round-1');
    env.setVar('is_game_finished', false);

    env.getElement('test-win-btn').listeners.click();
    await new Promise(resolve => setImmediate(resolve));

    assert.equal(env.winCalls.length, 1);
    assert.equal(env.winCalls[0].winnerUser.username, 'TestUser');
    assert.equal(env.eval('is_game_finished'), true);
});

test('app() keeps manual guess enabled when analytics functions are blocked/undefined', async () => {
    const env = setupRoundEnv({ withAnalytics: false });
    await env.initApp();
    assert.equal(env.eval('manual_guess_ready'), true);
    assert.equal(env.eval('is_game_finished'), false);
});

test('getTwitchUserData passes AbortSignal, aborts after 5000ms returning null, and clears timeout', async () => {
    const timeouts = new Map();
    const cleared = [];
    let nextId = 1;
    let capturedSignal = null;

    const context = {
        AbortController,
        URL,
        console: { log() {}, warn() {}, error() {} },
        kontekstno_api_tips_max_distance: 300,
        setTimeout: (fn, ms) => {
            const id = nextId++;
            timeouts.set(id, { fn, ms });
            return id;
        },
        clearTimeout: id => cleared.push(id),
        fetch: (url, opts) => {
            capturedSignal = opts?.signal;
            return new Promise((_, reject) => {
                opts.signal.addEventListener('abort', () => {
                    const err = new Error('Aborted');
                    err.name = 'AbortError';
                    reject(err);
                });
            });
        }
    };

    vm.createContext(context);
    vm.runInContext(readScript('api.js'), context);

    const pending = context.getTwitchUserData('fra3a');
    assert.ok(capturedSignal);
    assert.equal(timeouts.size, 1);
    const [timerId, timer] = Array.from(timeouts.entries())[0];
    assert.equal(timer.ms, 5000);

    timer.fn();
    assert.equal(capturedSignal.aborted, true);
    const result = await pending;
    assert.equal(result, null);
    assert.deepEqual(cleared, [timerId]);
});

test('app() initial start_new_round failure connects chat and recovers automatically on retry', async () => {
    const env = setupRoundEnv();
    let failInitial = true;
    env.context.generate_secret_word = async () => {
        if (failInitial) throw new Error('initial outage');
        return 'auto-recovered-round';
    };

    await env.initApp();
    assert.equal(env.eval('is_game_finished'), true);
    assert.equal(env.eval('manual_guess_ready'), false);
    assert.equal(env.chatClients.length, 1);
    assert.ok(env.getErrorOverlay());
    const retryTimerId = env.eval('round_retry_timeout_id');
    assert.ok(retryTimerId);

    failInitial = false;
    env.timers.get(retryTimerId).fn();
    await new Promise(resolve => setImmediate(resolve));

    assert.equal(env.eval('secret_word_id'), 'auto-recovered-round');
    assert.equal(env.eval('is_game_finished'), false);
    assert.equal(env.eval('manual_guess_ready'), true);
    assert.equal(env.getErrorOverlay(), null);

    await env.chatMessage()('#streamer', { username: 'viewer1', 'display-name': 'Viewer1' }, 'облако');
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(env.eval('checked_words.has("облако")'), true);
});

test('real api.js generate_secret_word stops retry sleep when superseded and rejects empty gameId', async () => {
    const env = setupRoundEnv({ loadInit: false, withRealApi: true });
    let wordgunCalls = 0;
    env.eval(`
        GAME_BACKENDS.wordgun.createGame = async () => {
            globalThis.__wgCalls = (globalThis.__wgCalls || 0) + 1;
            throw new Error('temporary 503');
        };
        GAME_BACKENDS.kontekstno.createGame = async () => ({ gameId: 'k-ok', secretWord: 'свет' });
    `);

    env.setVar('game_backend', 'wordgun');
    const wgStart = env.context.start_new_round();
    await new Promise(resolve => setImmediate(resolve));
    wordgunCalls = env.eval('globalThis.__wgCalls');
    assert.equal(wordgunCalls, 1);

    // Supersede while generate_secret_word is sleeping 1000ms before retry #2
    env.setVar('game_backend', 'kontekstno');
    assert.equal(await env.context.start_new_round(), true);
    for (const entry of Array.from(env.timers.values())) {
        if (entry.ms === 1000) entry.fn();
    }
    assert.equal(await wgStart, false);
    assert.equal(env.eval('globalThis.__wgCalls'), 1);

    // Empty gameId must throw and enter error + auto-retry path (no silent deadlock)
    env.eval(`GAME_BACKENDS.kontekstno.createGame = async () => ({ gameId: '', secretWord: null });`);
    const emptyStart = env.context.start_new_round();
    for (let i = 0; i < 6; i++) {
        await new Promise(resolve => setImmediate(resolve));
        for (const [id, entry] of Array.from(env.timers.entries())) {
            if (entry.ms === 1000) {
                env.timers.delete(id);
                entry.fn();
            }
        }
    }
    assert.equal(await emptyStart, false);
    assert.equal(env.getElement('menu-button-restart').style.display, 'block');
    assert.ok(env.getErrorOverlay());
    assert.ok(env.eval('round_retry_timeout_id'));
});

test('e.userMessage during isAutoRetry updates error-overlay and stops auto-retries', async () => {
    const env = setupRoundEnv({ loadInit: false });
    let phase = 1;
    env.context.generate_secret_word = async () => {
        if (phase === 1) throw new Error('temporary 503');
        const err = new Error('Wordgun HTTP 400');
        err.userMessage = 'Сложность устарела';
        throw err;
    };

    assert.equal(await env.context.start_new_round(), false);
    assert.ok(env.getErrorOverlay().html.includes('Ошибка получения секретного слова'));
    const retryTimerId = env.eval('round_retry_timeout_id');
    assert.ok(retryTimerId);

    phase = 2;
    env.timers.get(retryTimerId).fn();
    await new Promise(resolve => setImmediate(resolve));

    assert.ok(env.getErrorOverlay().html.includes('Сложность устарела'));
    assert.equal(env.eval('round_retry_timeout_id'), null);
});

test('non-moderator cannot run !слв-рестарт or !слв-подсказка, and !слв-подсказка is ignored when finished', async () => {
    const env = setupRoundEnv();
    await env.initApp();

    const chat = env.chatMessage();
    const viewer = { username: 'regular_viewer', 'display-name': 'Viewer', mod: false };
    const modUser = { username: 'moduser', 'display-name': 'Mod', mod: true };

    await chat('#streamer', viewer, '!слв-рестарт');
    await chat('#streamer', viewer, '!слв-подсказка');
    assert.equal(env.eval('secret_word_id'), 'round-1');
    assert.equal(env.tipCalls.length, 0);

    env.setVar('is_game_finished', true);
    await chat('#streamer', modUser, '!слв-подсказка');
    assert.equal(env.tipCalls.length, 0);
});

test('app() with missing channel sets is_game_finished=true so #test-win-btn cannot open win screen', async () => {
    const env = setupRoundEnv();
    env.context.loadSettings = () => false;
    await env.initApp();

    assert.equal(env.eval('is_game_finished'), true);
    assert.equal(env.eval('manual_guess_ready'), false);
    env.getElement('test-win-btn').listeners.click();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(env.winCalls.length, 0);
});
