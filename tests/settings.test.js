const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function setup(search = '') {
    const storage = new Map();
    const elements = new Map();
    const createElement = () => ({
        style: {
            setProperty(name, val) { this[name] = val; }
        },
        children: [],
        listeners: {},
        value: '',
        classList: {
            classes: new Set(),
            add(name) { this.classes.add(name); },
            remove(name) { this.classes.delete(name); },
            contains(name) { return this.classes.has(name); },
            toggle(name) { if (this.classes.has(name)) this.classes.delete(name); else this.classes.add(name); }
        },
        addEventListener(name, callback) { this.listeners[name] = callback; },
        appendChild(child) { this.children.push(child); },
        closest: () => createElement(),
        querySelector: () => createElement(),
        querySelectorAll: () => [],
        setCustomValidity() {},
        reportValidity() {},
        focus() {}
    });

    const bodyElement = createElement();
    const getElement = (id) => {
        if (!elements.has(id)) elements.set(id, createElement());
        return elements.get(id);
    };

    const context = {
        localStorage: {
            getItem: (key) => storage.get(key) ?? null,
            setItem: (key, value) => storage.set(key, value),
            removeItem: (key) => storage.delete(key)
        },
        document: {
            getElementById: getElement,
            querySelector: getElement,
            querySelectorAll: () => [],
            createElement,
            body: bodyElement,
            head: createElement()
        },
        window: {
            location: {
                search,
                origin: 'https://slovotron.fra3a.ru',
                pathname: '/',
                href: `https://slovotron.fra3a.ru/${search}`
            }
        },
        URL,
        URLSearchParams,
        console: { log() {}, warn() {}, error() {} },
        setTimeout: () => 1,
        clearTimeout() {},
        setInterval: () => 1,
        clearInterval() {},
        GAME_BACKENDS: { kontekstno: {}, wordgun: {} }
    };

    vm.createContext(context);
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/config.js'), 'utf8'), context);
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/settings.js'), 'utf8'), context);

    return { context, bodyElement };
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
