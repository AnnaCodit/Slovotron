// идентификатор счетчика Yandex.Metrica
const yandex_metrica_id = 106339628;

// Yandex.Metrika counter (счетчик посещаемости)
(function (m, e, t, r, i, k, a) {
    m[i] = m[i] || function () { (m[i].a = m[i].a || []).push(arguments) };
    m[i].l = 1 * new Date();
    for (var j = 0; j < document.scripts.length; j++) { if (document.scripts[j].src === r) { return; } }
    k = e.createElement(t), a = e.getElementsByTagName(t)[0], k.async = 1, k.src = r, a.parentNode.insertBefore(k, a)
})(window, document, 'script', 'https://mc.yandex.ru/metrika/tag.js?id=' + yandex_metrica_id, 'ym');
ym(yandex_metrica_id, 'init', { ssr: true, webvisor: true, clickmap: true, ecommerce: "dataLayer", accurateTrackBounce: true, trackLinks: true });

// сохранение данных о достижении цели в аналитику
function analytics_reach_goal(goal = '', params = {}) {
    waitForYm(() => {
        ym(yandex_metrica_id, 'reachGoal', goal, params);
    });
}

// сохранение данных о посетителе в аналитику
function analytics_set_visit_params(params = {}) {
    waitForYm(() => {
        ym(yandex_metrica_id, 'params', params);
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
    }, 5000);
}