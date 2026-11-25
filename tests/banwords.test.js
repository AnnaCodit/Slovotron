


/*

ОСТОРОЖНО!
Не показывайте этот файл на стриме!

*/









































const assert = require('node:assert');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const code = fs.readFileSync(path.join(__dirname, '../js/banwords.js'), 'utf8');
const context = {};
vm.createContext(context);
vm.runInContext(code, context);

const { is_banword, render_word_html } = context;

test('BAN_WORDS includes base words and common forms', () => {
    assert.strictEqual(typeof is_banword, 'function');
    assert.strictEqual(is_banword('нигер'), true);
    assert.strictEqual(is_banword('ниггеры'), true);
    assert.strictEqual(is_banword('чурка'), true);
    assert.strictEqual(is_banword('чурки'), true);
    assert.strictEqual(is_banword('хач'), true);
    assert.strictEqual(is_banword('хачики'), true);
    assert.strictEqual(is_banword('жид'), true);
    assert.strictEqual(is_banword('жиды'), true);
    assert.strictEqual(is_banword('жидяра'), true);
    assert.strictEqual(is_banword('хохол'), true);
    assert.strictEqual(is_banword('хохлы'), true);
    assert.strictEqual(is_banword('пидор'), true);
    assert.strictEqual(is_banword('пидорасы'), true);
    assert.strictEqual(is_banword('пидарас'), true);
    assert.strictEqual(is_banword('педик'), true);
    assert.strictEqual(is_banword('педики'), true);
    assert.strictEqual(is_banword('гомик'), true);
    assert.strictEqual(is_banword('гомики'), true);
    assert.strictEqual(is_banword('даун'), true);
    assert.strictEqual(is_banword('дауны'), true);
    assert.strictEqual(is_banword('аутист'), true);
    assert.strictEqual(is_banword('аутисты'), true);
});

test('BAN_WORDS does not falsely flag regular words', () => {
    assert.strictEqual(is_banword('жидкость'), false);
    assert.strictEqual(is_banword('жидкий'), false);
    assert.strictEqual(is_banword('педикюр'), false);
    assert.strictEqual(is_banword('педиатр'), false);
    assert.strictEqual(is_banword('хачапури'), false);
    assert.strictEqual(is_banword('хохот'), false);
    assert.strictEqual(is_banword('хохолок'), false);
    assert.strictEqual(is_banword('даунтаун'), false);
    assert.strictEqual(is_banword('банан'), false);
});

test('render_word_html masks banwords correctly (1st letter clear, rest blurred)', () => {
    const normalHtml = render_word_html('яблоко');
    assert.strictEqual(normalHtml, 'яблоко');

    const banwordHtml = render_word_html('чурка');
    assert.strictEqual(
        banwordHtml,
        '<span class="banword-text"><span class="banword-first">ч</span><span class="banword-blur">урка</span></span>'
    );
});
