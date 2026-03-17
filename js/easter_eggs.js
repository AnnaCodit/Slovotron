const iwawwa = new Set(['ивавва', 'ивава', 'акане', 'аканэ', 'iwawwa', 'iwawa', 'akane']);
const iwawwa_img = [
    'iwawwa_2.avif',
    'iwawwa_3.avif',
    'iwawwa_4.avif',
    'iwawwa_5.avif'
];

function check_easter_egg(word) {
    if (iwawwa.has(word)) {
        const pig = iwawwa_img[Math.floor(Math.random() * iwawwa_img.length)];
        const html = `
        <div class="msg">
            <div class="msg-content">
                <div class="iwawwa">
                    <div class="word"><img src="img/iwawwa_1.avif"></div>
                    <div class="distance"><img src="img/${pig}"></div>
                </div>
            </div>
        </div>`
        addAnythingToLastWords(html);
        return true;
    }

    return false;
}