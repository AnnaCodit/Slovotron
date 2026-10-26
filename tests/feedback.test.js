const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function setup(fetch) {
    const elements = new Map();
    const element = id => {
        if (!elements.has(id)) elements.set(id, {
            value: '', textContent: '', dataset: {}, listeners: {}, open: false,
            addEventListener(event, listener) { this.listeners[event] = listener; },
            setAttribute() {}, setCustomValidity() {}, reportValidity() {}, focus() {},
            showModal() { this.open = true; }, close() { this.open = false; }
        });
        return elements.get(id);
    };
    let now = 100_000;
    const intervals = new Map();
    let timerId = 0;
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../js/feedback.js'), 'utf8'), {
        document: { getElementById: element }, fetch, AbortController,
        Date: { now: () => now },
        setTimeout: () => ++timerId, clearTimeout() {},
        setInterval: callback => { intervals.set(++timerId, callback); return timerId; },
        clearInterval: id => intervals.delete(id)
    });
    return {
        element,
        input(text) {
            element('feedback-message').value = text;
            element('feedback-message').listeners.input();
        },
        submit: () => element('feedback-form').listeners.submit({ preventDefault() {} }),
        advance(seconds) {
            now += seconds * 1000;
            for (const callback of intervals.values()) callback();
        }
    };
}

function response(status, body) {
    return { status, ok: status >= 200 && status < 300, json: async () => body, headers: { get: () => null } };
}

test('one request while sending; clear draft only after confirmed delivery', async () => {
    const requests = [];
    let complete;
    const ui = setup((url, options) => {
        requests.push({ url, options });
        return new Promise(resolve => { complete = resolve; });
    });
    ui.input('  Идея для игры 💚  ');
    const pending = ui.submit();
    await ui.submit();
    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, 'https://slovotron-backend.fra3a.ru/api/v1/feedback');
    assert.deepEqual(JSON.parse(requests[0].options.body), { message: 'Идея для игры 💚' });
    assert.equal(ui.element('feedback-message').readOnly, true);
    assert.equal(ui.element('feedback-message').value, '  Идея для игры 💚  ');
    complete(response(200, { status: 'sent' }));
    await pending;
    assert.equal(ui.element('feedback-message').value, '');
    assert.equal(ui.element('feedback-status').dataset.state, 'success');
    ui.input('Ещё одна идея');
    await ui.submit();
    assert.equal(requests.length, 1);
    ui.advance(10);
    assert.equal(ui.element('feedback-submit').disabled, false);
});

test('server cooldown preserves the message and permits retry at its boundary', async () => {
    let calls = 0;
    const ui = setup(async () => { calls++; return response(429, { retry_after: 12 }); });
    ui.input('Предложение');
    await ui.submit();
    assert.equal(ui.element('feedback-message').value, 'Предложение');
    assert.equal(ui.element('feedback-status').dataset.state, 'error');
    ui.advance(11);
    await ui.submit();
    assert.equal(calls, 1);
    ui.advance(1);
    assert.equal(ui.element('feedback-submit').disabled, false);
    await ui.submit();
    assert.equal(calls, 2);
});

test('network and backend failures preserve the draft without claiming success', async () => {
    for (const fetch of [
        async () => { throw new Error('offline'); },
        async () => response(503, { code: 'feedback_unavailable' }),
        async () => response(200, { status: 'unexpected' }),
        async () => ({ ...response(502, null), json: async () => { throw new SyntaxError(); } })
    ]) {
        const ui = setup(fetch);
        ui.input('Не терять этот отзыв');
        await ui.submit();
        assert.equal(ui.element('feedback-message').value, 'Не терять этот отзыв');
        assert.equal(ui.element('feedback-message').readOnly, false);
        assert.equal(ui.element('feedback-status').dataset.state, 'error');
        assert.equal(ui.element('feedback-submit').disabled, false);
    }
});

test('empty and overlong messages never reach the backend', async () => {
    let calls = 0;
    const ui = setup(async () => { calls++; return response(200, { status: 'sent' }); });
    for (const text of [' \n ', 'я'.repeat(3001), '💚'.repeat(1501)]) {
        ui.input(text);
        await ui.submit();
        assert.equal(ui.element('feedback-submit').disabled, true);
    }
    assert.equal(calls, 0);
});

test('closing and reopening the form keeps the draft', () => {
    const ui = setup(() => { throw new Error('Unexpected network request'); });
    ui.element('feedback-button').listeners.click();
    ui.input('Допишу позже');
    ui.element('feedback-close').listeners.click();
    ui.element('feedback-button').listeners.click();
    assert.equal(ui.element('feedback-dialog').open, true);
    assert.equal(ui.element('feedback-message').value, 'Допишу позже');
});
