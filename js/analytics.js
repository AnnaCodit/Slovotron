// идентификаторы счетчиков
const yandex_metrica_id = 106339628;
const google_analytics_id = 'G-27VECDGS20';

// Настройки Axiom
const AXIOM_DATASET = 'slovotron';
const AXIOM_TOKEN = 'xaat-b37a6c77-c898-4f0c-96c3-d96c5e98867b';

// --- Инициализация Yandex.Metrika ---
(function (m, e, t, r, i, k, a) {
    m[i] = m[i] || function () { (m[i].a = m[i].a || []).push(arguments) };
    m[i].l = 1 * new Date();
    for (var j = 0; j < document.scripts.length; j++) { if (document.scripts[j].src === r) { return; } }
    k = e.createElement(t), a = e.getElementsByTagName(t)[0], k.async = 1, k.src = r, a.parentNode.insertBefore(k, a)
})(window, document, 'script', 'https://mc.yandex.ru/metrika/tag.js?id=' + yandex_metrica_id, 'ym');
ym(yandex_metrica_id, 'init', { ssr: true, webvisor: true, clickmap: true, ecommerce: "dataLayer", accurateTrackBounce: true, trackLinks: true });

// --- Инициализация Google Analytics 4 ---
(function () {
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + google_analytics_id;
    document.head.appendChild(script);

    window.dataLayer = window.dataLayer || [];
    function gtag() { dataLayer.push(arguments); }
    window.gtag = gtag;
    gtag('js', new Date());
    gtag('config', google_analytics_id);
})();

// сохранение данных о достижении цели в аналитику
function analytics_reach_goal(goal = '', params = {}) {
    // 1. Яндекс
    waitForYm(() => {
        console.log('Отправили достижение цели в яндекс.метрику', goal, params);
        ym(yandex_metrica_id, 'reachGoal', goal, params);
    });

    // 2. Google
    if (typeof gtag === 'function') {
        console.log('Отправили событие в Google Analytics', goal, params);
        gtag('event', goal, params);
    }

    // 3. Axiom (кастомный пинг при старте игры)
    if (goal === 'game_start') {
        analytics_custom_ping(params.channel_name || 'unknown');
    }
}

// сохранение данных о посетителе в аналитику
function analytics_set_visit_params(params = {}) {
    waitForYm(() => {
        console.log('Отправили параметр визита в яндекс.метрику', params);
        ym(yandex_metrica_id, 'params', params);
    });

    if (typeof gtag === 'function') {
        console.log('Отправили параметры пользователя в Google Analytics', params);
        gtag('set', 'user_properties', params);
    }
}

/**
 * Кастомный пинг в Axiom (AdBlock-resistant)
 */
function analytics_custom_ping(channel = '') {
    const url = `https://api.axiom.co/v1/datasets/${AXIOM_DATASET}/ingest`;
    const payload = [{ ch: channel, dt: new Date().toISOString() }];

    fetch(url, {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: {
            'Authorization': `Bearer ${AXIOM_TOKEN}`,
            'Content-Type': 'application/json'
        },
        mode: 'no-cors'
    }).catch(() => {
        // Резервный вариант, если fetch заблочен
        if (navigator.sendBeacon) {
            navigator.sendBeacon(url, JSON.stringify(payload));
        }
    });
}

// ожидание Yandex.Metrica так как счетчик загружается асинхронно
function waitForYm(callback) {
    if (typeof window.ym === 'function') {
        callback();
        return;
    }
    setTimeout(() => {
        waitForYm(callback);
    }, 1000);
}
