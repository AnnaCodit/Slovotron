const celebrities = [
    {
        id: "fra3a",
        tags: ["fra3a", "fraza", "фра3а", "фраза"],
        img: ["fra3a_1.gif", "fra3a_2.gif", "fra3a_3.gif", "fra3a_4.avif", "fra3a_5.avif"]
    },
    {
        id: "iwawwa",
        tags: ["ивавва", "ивава", "акане", "аканэ", "iwawwa", "iwawa", "akane", "akane_iwawwa"],
        img: ["iwawwa_1.avif", "iwawwa_2.avif", "iwawwa_3.avif", "iwawwa_4.avif", "iwawwa_5.avif", "iwawwa_6.avif"]
    },
    {
        id: "yui2d",
        tags: ["yui2d", "yui", "юй", "юи", "юй2д", "юи2д"],
        img: ["yui2d_1.gif", "yui2d_2.avif", "yui2d_3.avif", "yui2d_4.gif", "yui2d_5.png", "yui2d_6.avif"]
    }
];

function check_easter_egg(input) {
    const words = input.toLowerCase().split(/\s+/); 
    for (const word of words) {
        const celeb = celebrities.find(c => c.tags.includes(word));

        if (celeb) {
            const pics = celeb.img.slice(1);
            const pic = pics[Math.floor(Math.random() * pics.length)];

            const html = `
            <div class="msg">
                <div class="msg-content">
                    <div class="iwawwa">
                        <img src="img/${celeb.img[0]}">
                        <img src="img/${pic}">
                    </div>
                </div>
            </div>`;

            addAnythingToLastWords(html);
            // Особый случай для "фраза": показать пасхалку, но также разрешить обработку слова как обычной догадки
            if (word == "фраза") {return false;}
            return true;
        }
    }

    return false;
}