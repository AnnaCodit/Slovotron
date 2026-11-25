


/*

ОСТОРОЖНО!
Не показывайте этот файл на стриме!

*/









































const assert = require('node:assert');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const banwordsCode = fs.readFileSync(path.join(__dirname, '../js/banwords.js'), 'utf8');
const wsCode = fs.readFileSync(path.join(__dirname, '../js/ws.js'), 'utf8');

function setupTestContext() {
    let lastInsertedHtml = '';
    const containerMock = {
        children: [],
        insertAdjacentHTML: (pos, html) => { lastInsertedHtml = html; },
        removeChild: () => {},
        appendChild: () => {},
        insertBefore: () => {}
    };

    const context = {
        document: {
            querySelector: () => containerMock,
            dispatchEvent: () => {},
            getElementById: () => ({
                style: {},
                querySelector: () => ({}),
                addEventListener: () => {}
            }),
            body: { classList: { contains: () => false, toggle: () => {} } }
        },
        getLastInsertedHtml: () => lastInsertedHtml,
        CustomEvent: class {},
        Audio: class { play() { return Promise.resolve(); } },
        Date: Date,
        Math: Math,
        parseFloat: parseFloat,
        parseInt: parseInt,
        isNaN: isNaN,
        setTimeout: setTimeout,
        clearTimeout: clearTimeout,
        setInterval: setInterval,
        clearInterval: clearInterval,
        console: console,
        MAX_LAST_WORDS: 20,
        tip_menu_button: { style: {} }
    };
    vm.createContext(context);
    vm.runInContext(banwordsCode, context);
    vm.runInContext(wsCode, context);
    return context;
}

test('message_template produces normal html for non-banwords', () => {
    const { message_template } = setupTestContext();
    const html = message_template('яблоко', 250, 'Viewer1', '#FF0000');
    assert.ok(html.includes('<div class="msg" data-distance="250">'));
    assert.ok(html.includes('<div class="word">яблоко</div>'));
    assert.ok(!html.includes('banword'));
});

test('message_template produces banword class and blurred html for banwords', () => {
    const { message_template } = setupTestContext();
    const html = message_template('чурка', 100, 'Viewer1', '#FF0000');
    assert.ok(html.includes('<div class="msg banword" data-distance="100">'));
    assert.ok(html.includes('<span class="banword-text"><span class="banword-first">ч</span><span class="banword-blur">урка</span></span>'));
});

test('addWordStatusToLastWords produces blurred markup for banwords in status', () => {
    const context = setupTestContext();
    context.addWordStatusToLastWords('пидорас', 'уже было использовано');
    const insertedHtml = context.getLastInsertedHtml();
    assert.ok(insertedHtml.includes('class="msg banword"'));
    assert.ok(insertedHtml.includes('<span class="banword-text"><span class="banword-first">п</span><span class="banword-blur">идорас</span></span> уже было использовано'));
});
