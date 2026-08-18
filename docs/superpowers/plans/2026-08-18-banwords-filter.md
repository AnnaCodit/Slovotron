# Banwords Filter and Blur Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement banwords checking on all incoming words and blur every character after the first one when rendered in word columns and status messages.

**Architecture:** Create a dedicated `js/banwords.js` file with an extensive `Set` of base words and declensions to prevent false positives on regular words (e.g. "жидкость", "педикюр", "хачапури"). Integrate `render_word_html(word)` into `js/ws.js` for both word cards and status messages, styled with a CSS blur filter in `css/style.css`.

**Tech Stack:** Vanilla JavaScript (ES6+), Vanilla CSS, Node.js test runner for unit validation.

## Global Constraints
- Native vanilla HTML, CSS, JavaScript (no external npm dependencies or build tools).
- Preserve existing word queue and game logic in `js/ws.js` and `js/init.js`.
- Exact $O(1)$ `Set` lookups in lower-case Russian for forbidden words to prevent false positives.

---

### Task 1: Create `js/banwords.js` and Unit Tests

**Files:**
- Create: `js/banwords.js`
- Create: `test/banwords.test.js`

**Interfaces:**
- Produces:
  - `BAN_WORDS`: `Set<string>`
  - `is_banword(word: string): boolean`
  - `render_word_html(word: string): string`

- [ ] **Step 1: Write test file `test/banwords.test.js`**

```javascript
const assert = require('node:assert');
const test = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');

const code = fs.readFileSync('./js/banwords.js', 'utf8');
const context = {};
vm.createContext(context);
vm.runInContext(code, context);

const { BAN_WORDS, is_banword, render_word_html } = context;

test('BAN_WORDS includes base words and common forms', () => {
    assert.strictEqual(typeof is_banword, 'function');
    assert.strictEqual(is_banword('нигер'), true);
    assert.strictEqual(is_banword('ниггеры'), true);
    assert.strictEqual(is_banword('чурка'), true);
    assert.strictEqual(is_banword('чуркам'), true);
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
```

- [ ] **Step 2: Run test to verify it fails before implementation**

Run: `node --test test/banwords.test.js`
Expected: FAIL (cannot find `./js/banwords.js`)

- [ ] **Step 3: Create `js/banwords.js` with full word list and helper functions**

```javascript
const BAN_WORDS = new Set([
    // Расовые / этнические slurs
    // нигер / ниггер / нигга
    'нигер', 'нигера', 'нигеру', 'нигером', 'нигере', 'нигеры', 'нигеров', 'нигерам', 'нигерами', 'нигерах',
    'ниггер', 'ниггера', 'ниггеру', 'ниггером', 'ниггере', 'ниггеры', 'ниггеров', 'нигерам', 'ниггерами', 'ниггерах',
    'нигга', 'нигги', 'нигге', 'ниггу', 'ниггой', 'ниггою', 'нигг', 'ниггам', 'ниггами', 'ниггах',

    // чурка / чурбан
    'чурка', 'чурки', 'чурке', 'чурку', 'чуркой', 'чуркою', 'чурок', 'чуркам', 'чурками', 'чурках',
    'чурбан', 'чурбана', 'чурбану', 'чурбаном', 'чурбане', 'чурбаны', 'чурбанов', 'чурбанам', 'чурбанами', 'чурбанах',

    // хач / хачик
    'хач', 'хача', 'хачу', 'хачем', 'хачом', 'хаче', 'хачи', 'хачей', 'хачам', 'хачами', 'хачах',
    'хачик', 'хачика', 'хачику', 'хачиком', 'хачике', 'хачики', 'хачиков', 'хачикам', 'хачиками', 'хачиках',

    // жид / жидяра
    'жид', 'жида', 'жиду', 'жидом', 'жиде', 'жиды', 'жидов', 'жидам', 'жидами', 'жидах',
    'жидяра', 'жидяры', 'жидяре', 'жидяру', 'жидярой', 'жидярою', 'жидяр', 'жидярам', 'жидярами', 'жидярах',

    // хохол
    'хохол', 'хохла', 'хохлу', 'хохлом', 'хохле', 'хохлы', 'хохлов', 'хохлам', 'хохлами', 'хохлах',

    // Гомофобные slurs
    // пидор / пидорас / пидарас
    'пидор', 'пидора', 'пидору', 'пидором', 'пидоре', 'пидоры', 'пидоров', 'пидорам', 'пидорами', 'пидорах',
    'пидорас', 'пидораса', 'пидорасу', 'пидорасом', 'пидорасе', 'пидорасы', 'пидорасов', 'пидорасам', 'пидорасами', 'пидорасах',
    'пидарас', 'пидараса', 'пидарасу', 'пидарасом', 'пидарасе', 'пидарасы', 'пидарасов', 'пидарасам', 'пидарасами', 'пидарасах',
    // педик / гомик
    'педик', 'педика', 'педику', 'педиком', 'педике', 'педики', 'педиков', 'педикам', 'педиками', 'педиках',
    'гомик', 'гомика', 'гомику', 'гомиком', 'гомике', 'гомики', 'гомиков', 'гомикам', 'гомиками', 'гомиках',

    // Оскорбления по состоянию здоровья
    // даун / аутист
    'даун', 'дауна', 'дауну', 'дауном', 'дауне', 'дауны', 'даунов', 'даунам', 'даунами', 'даунах',
    'аутист', 'аутиста', 'аутисту', 'аутистом', 'аутисте', 'аутисты', 'аутистов', 'аутистам', 'аутистами', 'аутистах'
]);

function is_banword(word = '') {
    if (!word || typeof word !== 'string') return false;
    return BAN_WORDS.has(word.trim().toLowerCase());
}

function render_word_html(word = '') {
    if (!word || typeof word !== 'string') return '';
    const trimmed = word.trim();
    if (!is_banword(trimmed)) {
        return trimmed;
    }
    const firstChar = trimmed.charAt(0);
    const restChars = trimmed.slice(1);
    return `<span class="banword-text"><span class="banword-first">${firstChar}</span><span class="banword-blur">${restChars}</span></span>`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/banwords.test.js`
Expected: PASS

---

### Task 2: Add CSS Styles in `css/style.css`

**Files:**
- Modify: `css/style.css`

**Interfaces:**
- Produces styles for `.banword-text`, `.banword-blur`, `.banword-first`, `.msg.is-banword`

- [ ] **Step 1: Add CSS classes to `css/style.css`**

```css
/* banwords */
.banword-text {
    display: inline-flex;
    align-items: baseline;
}

.banword-first {
    display: inline-block;
}

.banword-blur {
    display: inline-block;
    filter: blur(6px);
    user-select: none;
    pointer-events: none;
}
```

---

### Task 3: Include `js/banwords.js` in `index.html`

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Add script tag before `ws.js`**

```html
    <script src="js/config.js?v=__ASSETS_VERSION__"></script>
    <script src="js/api.js?v=__ASSETS_VERSION__"></script>
    <script src="js/banwords.js?v=__ASSETS_VERSION__"></script>
    <script src="js/easter_eggs.js?v=__ASSETS_VERSION__"></script>
    <script src="js/ws.js?v=__ASSETS_VERSION__"></script>
```

---

### Task 4: Integrate Banwords Filtering into `js/ws.js`

**Files:**
- Modify: `js/ws.js`

- [ ] **Step 1: Update `message_template` and `addTextToLastWords` to handle banwords**

In `message_template`:
- Check if `is_banword(word)`.
- If true, add class `is-banword` to `.msg` container and render word via `render_word_html(word)`.

In `addTextToLastWords(text)` or status messages in `process_message`:
- For `"слово уже было использовано"` / `"не найдено в словаре"` / `"ошибка API"`, render `${render_word_html(word)} <span class="status-suffix">уже было использовано</span>` so banwords stay masked.

- [ ] **Step 2: Run test suite to verify no regressions**

Run: `node --test test/banwords.test.js`
Expected: PASS

---

### Task 5: End-to-End Verification

- [ ] **Step 1: Create an integration test script `test/ws-render.test.js`**
Verify that:
1. Normal words produce normal message HTML without blur spans.
2. Banwords produce `.msg.is-banword` and blurred HTML spans.
3. Status messages with banwords properly blur the banword part.

- [ ] **Step 2: Run all tests**
Run: `node --test test/*.test.js`
Expected: All tests pass.
