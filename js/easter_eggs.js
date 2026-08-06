const celebrities = [
    {
        id: "fra3a",
        tags: ["fra3a", "fraza", "фра3а", "фраза"],
        img_left: ["fra3a_1.gif"],
        img_right: ["fra3a_2.gif", "fra3a_3.gif", "fra3a_4.avif", "fra3a_5.avif"]
    },
    {
        id: "iwawwa",
        tags: ["ивавва", "ивава", "акане", "аканэ", "iwawwa", "iwawa", "akane", "akane_iwawwa"],
        img_left: ["iwawwa_1.avif"],
        img_right: ["iwawwa_2.avif", "iwawwa_3.avif", "iwawwa_4.avif", "iwawwa_5.avif", "iwawwa_6.avif"]
    },
    {
        id: "yui2d",
        tags: ["yui2d", "yui", "юй", "юи", "юй2д", "юи2д"],
        img_left: ["yui2d_1.gif"],
        img_right: ["yui2d_2.avif", "yui2d_3.avif", "yui2d_4.gif", "yui2d_5.png", "yui2d_6.avif"]
    },
    {
        id: "quantum075",
        tags: ["quantum0", "quantum", "quantum075", "квантум"],
        img_left: ["https://bot.quantum0.ru/static/images/dripping_name.gif"],
        img_right: ["https://bot.quantum0.ru/static/images/stickers/1.webp", "https://bot.quantum0.ru/static/images/stickers/2.webp", "https://bot.quantum0.ru/static/images/stickers/3.webp", "https://bot.quantum0.ru/static/images/stickers/4.webp", "https://bot.quantum0.ru/static/images/stickers/5.webp"]
    },
    {
        id: "hatome",
        tags: ["hatome", "хатоме", "хатомка", "хатоми"],
        img_left: ["hatome_1.gif"],
        img_right: ["hatome_2.png", "hatome_3.png", "hatome_4.gif"]
    },
    {
        id: "mrwhiskanson",
        tags: ["mrwhiskanson", "вискансон"],
        img_left: ["mrwhiskanson_1.gif"],
        img_right: ["mrwhiskanson_2.png", "mrwhiskanson_3.png", "mrwhiskanson_4.png"]
    },
    {
        id: "mirednesy",
        tags: ["мемель", "memel", "миреднеси", "mirednesy"],
        img_left: ["mirednesy_1.gif"],
        img_right: ["mirednesy_2.png", "mirednesy_3.gif", "mirednesy_4.avif", "mirednesy_5.avif"]
    }
];

function check_easter_egg(input) {
    const words = input.toLowerCase().split(/\s+/);
    for (const word of words) {
        const celeb = celebrities.find(c => c.tags.includes(word));

        if (celeb) {
            const img_left = celeb.img_left[Math.floor(Math.random() * celeb.img_left.length)];
            const img_right = celeb.img_right[Math.floor(Math.random() * celeb.img_right.length)];
            const getSrc = (path) => path.startsWith('https://') ? path : `img/${path}`;

            const html = `
            <div class="msg">
                <div class="msg-content">
                    <div class="iwawwa">
                        <img src="${getSrc(img_left)}">
                        <img src="${getSrc(img_right)}">
                    </div>
                </div>
            </div>`;

            addAnythingToLastWords(html);
            // Особый случай для "фраза": показать пасхалку, но также разрешить обработку слова как обычной догадки
            if (word == "фраза") { return false; }
            return true;
        }
    }

    return false;
}
