
let channel_name = 'fra3a';
let restart_time = 20;
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
