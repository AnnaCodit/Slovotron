const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function setup(search = '', initialStorage = {}) {
    const storage = new Map(Object.entries(initialStorage));
    const elements = new Map();
    const selectors = new Map();
    const timeouts = new Map();
    const clearedTimeouts = [];
    let nextTimeoutId = 1;

    const createElement = (tagName = 'div') => {
        const el = {
            tagName,
            id: '',
            style: {
                setProperty(name, val) { this[name] = val; }
            },
            children: [],
            listeners: {},
            options: [],
            _value: '',
            checked: false,
            disabled: false,
            placeholder: '',
            src: '',
            customValidity: '',
            validity: { valid: true },
            dataset: {},
            classList: {
                classes: new Set(),
                add(name) { this.classes.add(name); },
                remove(name) { this.classes.delete(name); },
                contains(name) { return this.classes.has(name); },
                toggle(name) { if (this.classes.has(name)) this.classes.delete(name); else this.classes.add(name); }
            },
            addEventListener(name, callback) {
                if (!this.listeners[name]) this.listeners[name] = [];
                this.listeners[name].push(callback);
            },
            emit(name, event = {}) {
                for (const cb of this.listeners[name] || []) cb(event);
            },
            appendChild(child) { this.children.push(child); return child; },
            add(opt) { this.options.push(opt); },
            closest: () => createElement(),
            querySelector: () => createElement(),
            querySelectorAll: () => [],
            setCustomValidity(msg) {
                this.customValidity = msg;
                this.validity.valid = !msg;
            },
            reportValidity() {},
            focus() {},
            select() {}
        };
        Object.defineProperty(el, 'value', {
            get() { return el._value; },
            set(v) { el._value = v === undefined || v === null ? '' : String(v); }
        });
        Object.defineProperty(el, 'innerHTML', {
            get() { return el._innerHTML || ''; },
            set(value) {
                el._innerHTML = value;
                if (value === '') el.options = [];
            }
        });
        return el;
    };

    const bodyElement = createElement('body');
    const headElement = createElement('head');
    const getElement = (id) => {
        if (id === 'custom-css-file') {
            return headElement.children.find(child => child.id === 'custom-css-file') || null;
        }
        if (!elements.has(id)) {
            const el = createElement();
            el.id = id;
            elements.set(id, el);
        }
        return elements.get(id);
    };
    const querySelector = (selector) => {
        if (!selectors.has(selector)) selectors.set(selector, createElement());
        return selectors.get(selector);
    };

    const locationObj = {
        search,
        origin: 'https://slovotron.fra3a.ru',
        pathname: '/',
        href: `https://slovotron.fra3a.ru/${search}`
    };

    let appCalls = 0;
    const context = {
        localStorage: {
            getItem: (key) => storage.get(key) ?? null,
            setItem: (key, value) => storage.set(key, String(value)),
            removeItem: (key) => storage.delete(key)
        },
        document: {
            getElementById: getElement,
            querySelector,
            querySelectorAll: () => [],
            createElement,
            body: bodyElement,
            head: headElement
        },
        window: {
            location: locationObj,
            history: {
                state: null,
                replaceState(state, title, nextUrl) {
                    const parsed = new URL(String(nextUrl), locationObj.origin);
                    locationObj.href = parsed.href;
                    locationObj.pathname = parsed.pathname;
                    locationObj.search = parsed.search;
                }
            }
        },
        Option: class {
            constructor(text, value) {
                this.text = text;
                this.value = value;
            }
        },
        URL,
        URLSearchParams,
        console: { log() {}, warn() {}, error() {} },
        setTimeout: (fn, ms) => {
            const id = nextTimeoutId++;
            timeouts.set(id, { fn, ms });
            return id;
        },
        clearTimeout: id => {
            clearedTimeouts.push(id);
            timeouts.delete(id);
        },
        setInterval: () => 1,
        clearInterval() {},
        GAME_BACKENDS: { kontekstno: {}, wordgun: {} },
        getTwitchUserData: async () => null,
        loadWordgunOptions: () => {},
        app: () => {
            appCalls++;
            return context.loadSettings();
        }
    };

    vm.createContext(context);
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/config.js'), 'utf8'), context);
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/settings.js'), 'utf8'), context);

    const dispatchFormFieldEvent = (elementId, eventName) => {
        getElement(elementId).emit(eventName);
        querySelector('.main-settings-box').emit(eventName);
    };

    return {
        context,
        bodyElement,
        headElement,
        getElement,
        querySelector,
        storage,
        location: locationObj,
        timeouts,
        clearedTimeouts,
        dispatchFormFieldEvent,
        getAppCalls: () => appCalls,
        eval: expr => vm.runInContext(expr, context)
    };
}

test('transparent_background=1 sets body background-color to transparent', () => {
    const { context, bodyElement } = setup('?transparent_background=1');
    context.loadSettings();
    assert.equal(bodyElement.style.backgroundColor, 'transparent');
});

test('without transparent_background=1, body background-color remains unset', () => {
    const { context, bodyElement } = setup('?channel=test');
    context.loadSettings();
    assert.equal(bodyElement.style.backgroundColor, undefined);
});

test('OBS URL parameters take priority over localStorage on loadSettings (including restart_time=0)', () => {
    const env = setup(
        '?channel=obschan&obs-overlay=1&restart_time=0&win_sound_url=https://example.com/win.mp3&win_avatar_enable=1&win_notification_enable=0&sound_enable=0&backend=wordgun&wg_difficulty=hard',
        {
            channel_name: 'localchan',
            restart_time: '10',
            win_sound_url: 'https://local.test/old.mp3',
            win_avatar_enable: 'false',
            win_notification_enable: 'true',
            sound_enable: 'true',
            game_backend: 'kontekstno',
            wordgun_difficulty: 'easy'
        }
    );

    const ready = env.context.loadSettings();
    assert.equal(ready, true);
    assert.equal(env.eval('channel_name'), 'obschan');
    assert.equal(env.eval('restart_time'), 0);
    assert.equal(env.getElement('restart-time').value, '0');
    assert.equal(env.eval('win_sound_url'), 'https://example.com/win.mp3');
    assert.equal(env.eval('win_avatar_enable'), true);
    assert.equal(env.eval('win_notification_enable'), false);
    assert.equal(env.eval('sound_enable'), false);
    assert.equal(env.eval('game_backend'), 'wordgun');
    assert.equal(env.eval('wordgun_difficulty'), 'hard');

    const obsUrl = new URL(env.getElement('obs-link').value);
    assert.equal(obsUrl.searchParams.get('restart_time'), '0');
});

test('OBS URL with backend=wordgun and no wg_difficulty resets stored wordgun_difficulty', () => {
    const env = setup('?channel=obschan&backend=wordgun', {
        wordgun_difficulty: 'hard'
    });
    env.context.loadSettings();
    assert.equal(env.eval('game_backend'), 'wordgun');
    assert.equal(env.eval('wordgun_difficulty'), '');
});

test('saving settings clears form-managed URL params (including channel_name) while preserving non-form params and persists across reload', () => {
    const env = setup(
        '?channel_name=urlchan&restart_time=30&win_sound_url=https://old.test/a.mp3&win_avatar_enable=1&win_notification_enable=0&sound_enable=0&backend=wordgun&wg_difficulty=hard&theme=dark&cssFile=https://cdn.test/custom.css&transparent_background=1&webhook_url=https://hook.test/ev&inactive_timeout=12'
    );
    env.context.loadSettings();

    env.getElement('channel-name').value = 'savedchan';
    env.getElement('restart-time').value = '0';
    env.getElement('win-sound-url').value = 'https://new.test/win.mp3';
    env.getElement('win-avatar-enable').checked = false;
    env.getElement('win-notification-enable').checked = true;
    env.getElement('sound-enable').checked = true;
    env.getElement('game-backend').value = 'kontekstno';
    env.getElement('wordgun-difficulty').value = '';

    env.getElement('save-settings-btn').emit('click');

    assert.equal(env.getAppCalls(), 1);
    const remainingParams = new URLSearchParams(env.location.search);
    for (const formParam of [
        'channel',
        'channel_name',
        'restart_time',
        'win_sound_url',
        'win_avatar_enable',
        'win_notification_enable',
        'sound_enable',
        'backend',
        'wg_difficulty'
    ]) {
        assert.equal(remainingParams.has(formParam), false, `${formParam} should be stripped from URL`);
    }
    assert.equal(remainingParams.get('theme'), 'dark');
    assert.equal(remainingParams.get('cssFile'), 'https://cdn.test/custom.css');
    assert.equal(remainingParams.get('transparent_background'), '1');
    assert.equal(remainingParams.get('webhook_url'), 'https://hook.test/ev');
    assert.equal(remainingParams.get('inactive_timeout'), '12');

    env.context.loadSettings();
    assert.equal(env.eval('channel_name'), 'savedchan');
    assert.equal(env.eval('restart_time'), 0);
    assert.equal(env.eval('win_sound_url'), 'https://new.test/win.mp3');
    assert.equal(env.eval('win_avatar_enable'), false);
    assert.equal(env.eval('win_notification_enable'), true);
    assert.equal(env.eval('sound_enable'), true);
    assert.equal(env.eval('game_backend'), 'kontekstno');
});

test('clearing restart_time on save removes localStorage entry and resets restart_time to 20', () => {
    const env = setup('?channel=test&restart_time=45', { restart_time: '45' });
    env.context.loadSettings();
    assert.equal(env.eval('restart_time'), 45);

    env.getElement('restart-time').value = '';
    env.getElement('save-settings-btn').emit('click');

    assert.equal(env.storage.has('restart_time'), false);
    assert.equal(env.eval('restart_time'), 20);
});

test('SecurityError in history.replaceState does not abort saving settings', () => {
    const env = setup('?restart_time=10');
    env.context.loadSettings();
    env.context.window.history.replaceState = () => {
        throw new Error('SecurityError');
    };

    env.getElement('channel-name').value = 'localfilechan';
    env.getElement('restart-time').value = '25';
    env.getElement('save-settings-btn').emit('click');

    assert.equal(env.storage.get('channel_name'), 'localfilechan');
    assert.equal(env.storage.get('restart_time'), '25');
    assert.equal(env.getElement('settings').style.display, 'none');
    assert.equal(env.getAppCalls(), 1);
    assert.ok(env.getElement('obs-link').value.includes('channel=localfilechan'));
});

test('delegated .main-settings-box input/change updates OBS link, validates channel length, and save cancels pending validationTimeout', () => {
    const env = setup('');
    env.context.loadSettings();

    // Too-short channel disables Save via real validity.valid update
    env.getElement('channel-name').value = 'ab';
    env.dispatchFormFieldEvent('channel-name', 'input');
    assert.equal(env.getElement('save-settings-btn').disabled, true);

    // Full twitch.tv URL is stripped and schedules validationTimeout
    env.getElement('channel-name').value = 'https://twitch.tv/livechan/about';
    env.getElement('restart-time').value = '25';
    env.getElement('win-avatar-enable').checked = true;
    env.getElement('sound-enable').checked = false;
    env.dispatchFormFieldEvent('channel-name', 'input');
    assert.equal(env.getElement('channel-name').value, 'livechan');
    assert.equal(env.timeouts.size, 1);
    const [[pendingValidationId]] = Array.from(env.timeouts.entries());

    let obsUrl = new URL(env.getElement('obs-link').value);
    assert.equal(obsUrl.searchParams.get('channel'), 'livechan');
    assert.equal(obsUrl.searchParams.get('restart_time'), '25');
    assert.equal(obsUrl.searchParams.get('win_avatar_enable'), '1');
    assert.equal(obsUrl.searchParams.get('sound_enable'), '0');

    env.getElement('game-backend').value = 'wordgun';
    env.context.ensureSelectOption(env.getElement('wordgun-difficulty'), 'medium');
    env.dispatchFormFieldEvent('wordgun-difficulty', 'change');

    obsUrl = new URL(env.getElement('obs-link').value);
    assert.equal(obsUrl.searchParams.get('backend'), 'wordgun');
    assert.equal(obsUrl.searchParams.get('wg_difficulty'), 'medium');

    // Clicking Save cancels the pending validationTimeout
    env.getElement('save-settings-btn').emit('click');
    assert.equal(env.clearedTimeouts.includes(pendingValidationId), true);
});

test('validateTwitchAcc ignores stale response and stale rejection after channel input changes', async () => {
    const env = setup('');
    let resolveOld;
    let rejectOld;

    env.context.getTwitchUserData = () => new Promise(resolve => { resolveOld = resolve; });
    env.getElement('channel-name').value = 'oldchan';
    const p1 = env.context.validateTwitchAcc('oldchan');

    env.getElement('channel-name').value = 'newchan';
    env.getElement('channel-name').setCustomValidity('');
    env.getElement('setting-avatar').src = 'https://cdn.test/new.png';
    env.getElement('setting-avatar').style.display = 'flex';

    resolveOld(null);
    await p1;

    assert.equal(env.getElement('channel-name').customValidity, '');
    assert.equal(env.getElement('channel-name').validity.valid, true);
    assert.equal(env.getElement('setting-avatar').src, 'https://cdn.test/new.png');
    assert.equal(env.getElement('setting-avatar').style.display, 'flex');

    env.context.getTwitchUserData = () => new Promise((_, reject) => { rejectOld = reject; });
    const p2 = env.context.validateTwitchAcc('oldchan');
    env.getElement('channel-name').value = 'newchan';
    env.getElement('channel-name').setCustomValidity('');

    rejectOld(new Error('network timeout'));
    await p2;

    assert.equal(env.getElement('channel-name').customValidity, '');
    assert.equal(env.getElement('channel-name').validity.valid, true);
    assert.equal(env.getElement('setting-avatar').style.display, 'flex');
});

test('loadSettings deduplicates external cssFile link and updates existing link when cssFile changes', () => {
    const env = setup('?channel=test&cssFile=https://cdn.test/overlay.css');
    env.context.loadSettings();
    env.context.loadSettings();

    let links = env.headElement.children.filter(el => el.tagName === 'link');
    assert.equal(links.length, 1);
    assert.equal(links[0].id, 'custom-css-file');
    assert.ok(links[0].href.startsWith('https://cdn.test/overlay.css?slv_timestamp='));

    env.location.search = '?channel=test&cssFile=https://cdn.test/overlay-v2.css';
    env.location.href = `https://slovotron.fra3a.ru/${env.location.search}`;
    env.context.loadSettings();

    links = env.headElement.children.filter(el => el.tagName === 'link');
    assert.equal(links.length, 1);
    assert.ok(links[0].href.startsWith('https://cdn.test/overlay-v2.css?slv_timestamp='));
});

test('ensureSelectOption resets select.value to empty string when value is empty', () => {
    const env = setup('');
    const select = env.getElement('wordgun-difficulty');
    env.context.ensureSelectOption(select, 'hard');
    assert.equal(select.value, 'hard');

    env.context.ensureSelectOption(select, '');
    assert.equal(select.value, '');
});

test('validateTwitchAcc disables saveBtn while checking and saveBtn invalidates in-flight check', async () => {
    const env = setup('');
    let resolveLookup;
    env.context.getTwitchUserData = () => new Promise(resolve => { resolveLookup = resolve; });

    env.getElement('channel-name').value = 'somechan';
    const pendingValidation = env.context.validateTwitchAcc('somechan');
    assert.equal(env.getElement('save-settings-btn').disabled, true);

    env.getElement('save-settings-btn').emit('click');
    env.getElement('channel-name').setCustomValidity('');

    resolveLookup(null);
    await pendingValidation;

    assert.equal(env.getElement('channel-name').customValidity, '');
    assert.equal(env.getElement('channel-name').validity.valid, true);
});
