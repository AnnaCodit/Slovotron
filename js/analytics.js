// идентификаторы счетчиков
const yandex_metrica_id = 106339628;
const google_analytics_id = 'G-27VECDGS20';

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
    // Дублируем в Яндекс
    waitForYm(() => {
        console.log('Отправили достижение цели в яндекс.метрику', goal, params);
        ym(yandex_metrica_id, 'reachGoal', goal, params);
    });

    // Дублируем в Google
    if (typeof gtag === 'function') {
        console.log('Отправили событие в Google Analytics', goal, params);
        gtag('event', goal, params);
    }
}

// сохранение данных о посетителе в аналитику
function analytics_set_visit_params(params = {}) {
    // Дублируем в Яндекс
    waitForYm(() => {
        console.log('Отправили параметр визита в яндекс.метрику', params);
        ym(yandex_metrica_id, 'params', params);
    });

    // Дублируем в Google
    if (typeof gtag === 'function') {
        console.log('Отправили параметры пользователя в Google Analytics', params);
        gtag('set', 'user_properties', params);
    }
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
