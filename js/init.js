

let secret_word_id = '';

async function generate_secret_word() {
    const data = await kontekstno_query('random-challenge');
    room_id = data.id;
    return room_id;
}

async function kontekstno_query(method = '', word = '', challenge_id = '') {

    let url = '';
    // console.log(method);

    if (method == 'random-challenge') {
        url = "https://xn--80aqu.xn--e1ajbkccewgd.xn--p1ai/" + method;
    }

    if (method == 'score') {
        url = "https://апи.контекстно.рф/score?challenge_id=" + challenge_id + "&word=" + word + "&challenge_type=random";
    }



    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Response status: ${response.status}`);
    }

    return await response.json();
}

function create_chat_connection(channel_name = '') {

    const client = new tmi.Client({
        channels: [channel_name]
    });

    // Подключаемся
    client.connect();

    // Слушаем сообщения
    // tags — это объект со всей инфой (цвет ника, бейджи, id сообщения и т.д.)
    client.on('message', (channel, tags, message, self) => {

        // console.log(channel, tags, message);

        const color = tags['color'] || '#00FF00';
        const name = tags['display-name'];

        // если в сообщении больше двух слов то игнорируем
        if (message.split(' ').length > 2) return;

        // prevent xss attack from message
        message = message.replace(/[^a-zA-Zа-яА-ЯёЁ0-9]/g, '');

        process_message(name, color, message);

    });

}

// basic app init
async function app() {
    try {

        if (channel_name) {
            secret_word_id = await generate_secret_word();
            console.log('ID секрутного слова: ', secret_word_id);
            create_chat_connection(channel_name);
        }

        // initMenu();
        // const data = await getData();
        // renderChallenge(data);
    } catch (error) {
        console.error(error);
    }
}

app();
