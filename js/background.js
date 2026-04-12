const BG_DB_NAME = 'slovotron-bg';
const BG_STORE_NAME = 'images';
const BG_KEY = 'custom-bg';
const BG_OPACITY_KEY = 'bg_opacity';

let bgObjectUrl = null;

const bgEl = document.getElementById('custom-background');
const bgFileInput = document.getElementById('bg-file-input');
const bgClearBtn = document.getElementById('bg-clear-btn');
const bgOpacitySlider = document.getElementById('bg-opacity-slider');
const bgOpacitySection = document.getElementById('bg-opacity-section');
const bgOpacityValue = document.getElementById('bg-opacity-value');
const bgFileName = document.getElementById('bg-file-name');

function openBgDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(BG_DB_NAME, 1);
        req.onupgradeneeded = (e) => e.target.result.createObjectStore(BG_STORE_NAME);
        req.onsuccess = (e) => resolve(e.target.result);
        req.onerror = (e) => reject(e.target.error);
    });
}

async function saveBgBlob(blob) {
    const db = await openBgDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(BG_STORE_NAME, 'readwrite');
        tx.objectStore(BG_STORE_NAME).put(blob, BG_KEY);
        tx.oncomplete = resolve;
        tx.onerror = (e) => reject(e.target.error);
    });
}

async function loadBgBlob() {
    const db = await openBgDB();
    return new Promise((resolve, reject) => {
        const req = db.transaction(BG_STORE_NAME, 'readonly')
            .objectStore(BG_STORE_NAME).get(BG_KEY);
        req.onsuccess = (e) => resolve(e.target.result || null);
        req.onerror = (e) => reject(e.target.error);
    });
}

async function deleteBgBlob() {
    const db = await openBgDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(BG_STORE_NAME, 'readwrite');
        tx.objectStore(BG_STORE_NAME).delete(BG_KEY);
        tx.oncomplete = resolve;
        tx.onerror = (e) => reject(e.target.error);
    });
}

function applyBgToDOM(objectUrl, opacity) {
    if (!bgEl) return;
    bgEl.style.backgroundImage = `url("${objectUrl}")`;
    bgEl.style.opacity = opacity / 100;
    document.body.classList.add('has-custom-bg');
}

function clearBgFromDOM() {
    if (!bgEl) return;
    bgEl.style.backgroundImage = '';
    document.body.classList.remove('has-custom-bg');
    if (bgObjectUrl) {
        URL.revokeObjectURL(bgObjectUrl);
        bgObjectUrl = null;
    }
}

function showBgOpacityControls(opacity) {
    if (bgOpacitySection) bgOpacitySection.style.display = 'flex';
    if (bgClearBtn) bgClearBtn.style.display = 'inline-block';
    if (bgOpacitySlider) bgOpacitySlider.value = opacity;
    if (bgOpacityValue) bgOpacityValue.textContent = opacity + '%';
}

function hideBgOpacityControls() {
    if (bgOpacitySection) bgOpacitySection.style.display = 'none';
    if (bgClearBtn) bgClearBtn.style.display = 'none';
    if (bgFileName) bgFileName.textContent = 'Файл не выбран';
}

async function initBackground() {
    try {
        const blob = await loadBgBlob();
        if (!blob) return;

        bgObjectUrl = URL.createObjectURL(blob);
        const opacity = parseInt(localStorage.getItem(BG_OPACITY_KEY) ?? '100', 10);
        applyBgToDOM(bgObjectUrl, opacity);
        showBgOpacityControls(opacity);
        if (bgFileName) bgFileName.textContent = 'Изображение загружено';
    } catch (e) {
        console.error('Ошибка при загрузке фона:', e);
    }
}

if (bgFileInput) {
    bgFileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
            await saveBgBlob(file);
            if (bgObjectUrl) URL.revokeObjectURL(bgObjectUrl);
            bgObjectUrl = URL.createObjectURL(file);
            const opacity = parseInt(localStorage.getItem(BG_OPACITY_KEY) ?? '100', 10);
            applyBgToDOM(bgObjectUrl, opacity);
            showBgOpacityControls(opacity);
            if (bgFileName) bgFileName.textContent = file.name;
        } catch (err) {
            console.error('Ошибка при сохранении фона:', err);
        }
    });
}

if (bgClearBtn) {
    bgClearBtn.addEventListener('click', async () => {
        try {
            await deleteBgBlob();
            clearBgFromDOM();
            hideBgOpacityControls();
            localStorage.removeItem(BG_OPACITY_KEY);
            if (bgFileInput) bgFileInput.value = '';
        } catch (err) {
            console.error('Ошибка при удалении фона:', err);
        }
    });
}

if (bgOpacitySlider) {
    bgOpacitySlider.addEventListener('input', () => {
        const opacity = parseInt(bgOpacitySlider.value, 10);
        if (bgEl) bgEl.style.opacity = opacity / 100;
        if (bgOpacityValue) bgOpacityValue.textContent = opacity + '%';
        localStorage.setItem(BG_OPACITY_KEY, opacity);
    });
}

initBackground();
