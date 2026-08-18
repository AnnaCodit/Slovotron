# Design Spec: Banwords Filtering and Blurring

## Goal
Add a banwords filtering system to Slovotron to identify offensive/banned words in incoming guesses and blur all characters except the first letter when displayed across the interface (both left/right columns and status messages).

## Architecture & Components

### 1. `js/banwords.js`
A dedicated module containing:
- `BAN_WORDS`: A `Set<string>` containing all base forms and declensions (cases, plurals) of forbidden words to achieve O(1) lookup with zero false positives on normal words (such as "жидкость", "хачапури", "педикюр", "хохот").
- `is_banword(word: string): boolean`: Checks if normalized word is in `BAN_WORDS`.
- `render_word_html(word: string): string`: Returns HTML representation:
  - If banword: `<span class="banword"><span class="banword-first">${firstChar}</span><span class="banword-blur">${restChars}</span></span>`
  - Otherwise: escaped word string.

### 2. Integration in `js/ws.js`
- `message_template(word, distance, name, nickname_color)`:
  - Uses `render_word_html(word)` inside `<div class="word">${renderedWord}</div>`.
  - Also adds CSS class `banword` to the `.msg` container if applicable for parent-level styling.
- `addTextToLastWords(text)` / status messages (`... уже было использовано`, `... не найдено в словаре`, `... ошибка API`):
  - Uses `render_word_html(word)` to construct the message, ensuring banned words are blurred even in status notices.

### 3. Styling in `css/style.css`
- `.banword-blur`:
  - `filter: blur(6px);`
  - `user-select: none;`
  - `display: inline-block;`
- Ensure blurred text fits properly within `.word` containers with uppercase styling (`text-transform: uppercase`).

### 4. Scripts in `index.html`
- Include `<script src="js/banwords.js?v=__ASSETS_VERSION__"></script>` before `ws.js`.

## Word List (Initial Set)
Forms included for:
- Racial/Ethnic slurs: нигер, ниггер, нигга, чурка, чурбан, хач, хачик, жид, жидяра, хохол (with full standard case declensions and plural forms).
- Homophobic slurs: пидор, пидорас, пидарас, педик, гомик (with full declensions).
- Health/Disability insults: даун, аутист (with full declensions).

## Testing & Verification
- Unit/manual verification of:
  1. Banword detection (`is_banword('ниггер') === true`, `is_banword('чурки') === true`, `is_banword('педикюр') === false`, `is_banword('жидкость') === false`).
  2. UI rendering in `.last-words` and `.best-match` columns showing 1st letter sharp and remaining letters blurred.
  3. Status messages (`"уже было использовано"`, `"не найдено в словаре"`) blurring banwords correctly.
