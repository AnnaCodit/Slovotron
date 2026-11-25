const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const readScript = name => fs.readFileSync(path.join(__dirname, '..', 'js', name), 'utf8');

function createElement(id = '') {
    return {
        id,
        style: {},
        children: [],
        listeners: {},
        innerText: '',
        classList: {
            classes: new Set(),
            add(name) { this.classes.add(name); },
            remove(name) { this.classes.delete(name); },
            contains(name) { return this.classes.has(name); }
        },
        addEventListener(name, cb) { this.listeners[name] = cb; }
    };
}

function setupTipsEnv() {
    const elements = new Map();
    const getElement = id => {
        if (!elements.has(id)) elements.set(id, createElement(id));
        return elements.get(id);
    };
    const queries = new Map();
    const query = sel => {
        if (!queries.has(sel)) queries.set(sel, createElement(sel));
        return queries.get(sel);
    };

    const timers = new Map();
    const clearedTimers = [];
    let nextTimerId = 1;
    let now = 1_000_000;
    const winCalls = [];

    const context = {
        document: {
            getElementById: getElement,
            querySelector: query,
            addEventListener() {}
        },
        Date: { now: () => now },
        Math,
        console: { log() {}, warn() {}, error() {} },
        setTimeout: (fn, ms) => {
            const id = nextTimerId++;
            timers.set(id, { fn, ms });
            return id;
        },
        clearTimeout: id => {
            clearedTimers.push(id);
            timers.delete(id);
        },
        backend_supports_tips: () => true,
        backend_max_distance: () => 300,
        is_game_finished: false,
        secret_word_id: 'round-1',
        round_start_gen: 1,
        best_found_distance: 100,
        hints_used: 0,
        uniqUsers: new Set(['u1']),
        checked_words: new Map(),
        addTextToLastWords() {},
        markOverlayActivity() {},
        message_template: (word, dist) => `<div data-distance="${dist}">${word}</div>`,
        addAnythingToLastWords() {},
        addMatchWord() {},
        sendWebhookEvent() {},
        handle_win: (user, word) => { winCalls.push({ user, word }); }
    };

    vm.createContext(context);
    vm.runInContext(readScript('tips.js'), context);

    return {
        context,
        timers,
        clearedTimers,
        winCalls,
        eval: expr => vm.runInContext(expr, context),
        advance(ms) { now += ms; }
    };
}

test('best_found_distance never regresses if a closer word arrives while get_tip is in flight', async () => {
    const env = setupTipsEnv();
    let resolveTip;
    env.context.get_tip = () => new Promise(resolve => { resolveTip = resolve; });

    const tipPromise = env.context.use_tip('u1', true);
    env.context.best_found_distance = 2;

    resolveTip({ word: 'дом', distance: 30 });
    await tipPromise;

    assert.equal(env.context.best_found_distance, 2);
});

test('tip word normalizes ё/Ё -> е and lowercase when recorded in checked_words', async () => {
    const env = setupTipsEnv();
    env.context.get_tip = async () => ({ word: 'Самолёт', distance: 10 });
    await env.context.use_tip('u1', true);

    assert.equal(env.context.checked_words.has('самолет'), true);
    assert.equal(env.context.checked_words.get('самолет').distance, 10);

    env.context.reset_tips();
    env.context.get_tip = async () => ({ word: 'Ёлка', distance: 5 });
    await env.context.use_tip('u2', true);

    assert.equal(env.context.checked_words.has('елка'), true);
    assert.equal(env.context.checked_words.get('елка').distance, 5);
});

test('stale get_tip resolve or reject after round change (by secret_word_id or round_start_gen) does not abort new round tip state', async () => {
    const env = setupTipsEnv();
    let resolveTip;
    let rejectTip;

    env.context.get_tip = () => new Promise(resolve => { resolveTip = resolve; });
    const p1 = env.context.use_tip('u1', true);
    env.context.secret_word_id = 'round-2';
    env.eval('tip_requests_users.add("new-voter"); tip_in_progress = true;');
    resolveTip({ word: 'старое', distance: 20 });
    await p1;

    assert.equal(env.eval('tip_in_progress'), true);
    assert.equal(env.eval('tip_requests_users.has("new-voter")'), true);
    assert.equal(env.context.checked_words.has('старое'), false);

    // Same secret_word_id collision, but round_start_gen incremented
    env.eval('tip_in_progress = false;');
    env.context.get_tip = () => new Promise((_, reject) => { rejectTip = reject; });
    const p2 = env.context.use_tip('u2', true);
    env.context.round_start_gen = 2;
    env.eval('tip_requests_users.add("round3-voter"); tip_in_progress = true;');
    rejectTip(new Error('late failure'));
    await p2;

    assert.equal(env.eval('tip_in_progress'), true);
    assert.equal(env.eval('tip_requests_users.has("round3-voter")'), true);
});

test('winning get_tip resolving after chat already finished the round does not trigger handle_win', async () => {
    const env = setupTipsEnv();
    let resolveTip;
    env.context.get_tip = () => new Promise(resolve => { resolveTip = resolve; });

    const pendingTip = env.context.use_tip('u1', true);
    env.context.is_game_finished = true;

    resolveTip({ word: 'секрет', distance: 1 });
    await pendingTip;

    assert.equal(env.winCalls.length, 0);
    assert.equal(env.eval('tip_in_progress'), false);
    assert.equal(env.context.checked_words.has('секрет'), false);
});

test('reset_tips cancels the pending 800ms animation reset timer', async () => {
    const env = setupTipsEnv();
    env.context.get_tip = async () => ({ word: 'река', distance: 15 });

    await env.context.use_tip('u1', true);
    assert.equal(env.timers.size, 1);
    const [[scheduledId]] = Array.from(env.timers.entries());

    env.context.reset_tips();
    assert.equal(env.timers.size, 0);
    assert.equal(env.clearedTimers.includes(scheduledId), true);
});
