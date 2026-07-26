// Minimal WebSocket guess channel for the Wordgun v2 API (WS /v2/send_guess).
//
// One game per socket: the socket is reopened whenever a new game token arrives.
// Every guess carries an `id` so its reply stays matchable even when guesses are
// pipelined or the server rejects the frame. The socket is stateless — the token
// carries the whole game — so a dropped connection is simply reopened.
//
// When the socket cannot be opened WORDGUN_WS_MAX_OPEN_FAILURES times in a row,
// this module reports itself unavailable and api.js silently falls back to the
// slower HTTP endpoint (POST /v1/guess), which v2 tokens also accept. The failure
// count survives across games on purpose: where WebSockets are blocked, retrying
// every round would stall the first guesses of every round on the open timeout.
// A single successful reply clears it.

const WORDGUN_WS_URL = 'wss://api.wordgun.ru/v2/send_guess';
const WORDGUN_WS_OPEN_TIMEOUT_MS = 5000;
const WORDGUN_WS_REQUEST_TIMEOUT_MS = 10000;
const WORDGUN_WS_MAX_OPEN_FAILURES = 3;

const wordgun_socket = {
    ws: null,
    token: null,
    open_promise: null,
    pending: new Map(),
    next_id: 0,
    open_failures: 0
};

// Point the socket at a new game. Closing the old one keeps the
// "one game per socket" contract of the API.
function wordgun_ws_set_game(token) {
    if (wordgun_socket.token === token) return;
    wordgun_ws_close();
    wordgun_socket.token = token;
}

function wordgun_ws_close() {
    const ws = wordgun_socket.ws;
    wordgun_socket.ws = null;
    wordgun_socket.open_promise = null;
    wordgun_ws_reject_pending(new Error('Wordgun WebSocket закрыт'));

    if (ws) {
        // Detach handlers first so our own close() does not re-enter the cleanup.
        ws.onopen = ws.onmessage = ws.onerror = ws.onclose = null;
        try { ws.close(); } catch {}
    }
}

function wordgun_ws_reject_pending(error) {
    for (const entry of wordgun_socket.pending.values()) {
        clearTimeout(entry.timeout);
        entry.reject(error);
    }
    wordgun_socket.pending.clear();
}

// True while the socket is worth trying. Once it has failed to open too often we
// stay on HTTP for the rest of the game instead of stalling every guess.
function wordgun_ws_available(token) {
    return typeof WebSocket !== 'undefined'
        && !!token
        && wordgun_socket.open_failures < WORDGUN_WS_MAX_OPEN_FAILURES;
}

function wordgun_ws_ensure_open() {
    if (wordgun_socket.ws && wordgun_socket.ws.readyState === WebSocket.OPEN) {
        return Promise.resolve(wordgun_socket.ws);
    }
    if (wordgun_socket.open_promise) {
        return wordgun_socket.open_promise;
    }

    const open_promise = new Promise((resolve, reject) => {
        let ws;
        try {
            ws = new WebSocket(WORDGUN_WS_URL);
        } catch (error) {
            reject(error);
            return;
        }

        // Tracks whether this socket ever answered: a socket that dies without a
        // single reply counts as a failed connection, one that worked does not.
        let answered = false;

        const open_timeout = setTimeout(() => {
            try { ws.close(); } catch {}
            reject(new Error('Таймаут открытия Wordgun WebSocket'));
        }, WORDGUN_WS_OPEN_TIMEOUT_MS);

        ws.onopen = () => {
            clearTimeout(open_timeout);
            wordgun_socket.ws = ws;
            resolve(ws);
        };

        ws.onmessage = (event) => {
            if (wordgun_ws_handle_message(event)) answered = true;
        };

        // onerror is always followed by onclose, which does the cleanup.
        ws.onerror = () => {};

        ws.onclose = () => {
            clearTimeout(open_timeout);
            if (wordgun_socket.ws === ws) wordgun_socket.ws = null;
            if (wordgun_socket.open_promise === open_promise) wordgun_socket.open_promise = null;
            if (!answered) wordgun_socket.open_failures++;
            wordgun_ws_reject_pending(new Error('Wordgun WebSocket закрыт'));
            // No-op once the socket has already opened.
            reject(new Error('Wordgun WebSocket закрыт'));
        };
    });

    open_promise.catch(() => {
        if (wordgun_socket.open_promise === open_promise) wordgun_socket.open_promise = null;
    });

    wordgun_socket.open_promise = open_promise;
    return open_promise;
}

// Returns true when the frame resolved a pending guess, i.e. the socket is alive.
function wordgun_ws_handle_message(event) {
    let data;
    try {
        data = JSON.parse(event.data);
    } catch {
        console.warn('Wordgun WebSocket: не удалось разобрать кадр', event.data);
        return false;
    }

    const entry = wordgun_socket.pending.get(data?.id);
    if (!entry) {
        console.warn('Wordgun WebSocket: ответ без совпадающего id', data);
        return false;
    }

    wordgun_socket.pending.delete(data.id);
    clearTimeout(entry.timeout);
    wordgun_socket.open_failures = 0;

    if (data.error) {
        // A server-side rejection (bad/expired token, malformed frame). Marked so
        // the caller knows retrying over HTTP would fail the same way.
        const error = new Error(`Wordgun WebSocket: ${data.error}`);
        error.wordgun_rejected = true;
        entry.reject(error);
        return true;
    }

    entry.resolve(data);
    return true;
}

// Send one guess and resolve with the raw v2 reply: { in_vocab, rank, is_live }.
async function wordgun_ws_guess(token, word) {
    if (!token) throw new Error('Wordgun WebSocket: токен игры не задан');
    // Guard against a token change that never went through createGame.
    if (wordgun_socket.token !== token) wordgun_ws_set_game(token);

    const ws = await wordgun_ws_ensure_open();
    const id = `g${++wordgun_socket.next_id}`;

    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            wordgun_socket.pending.delete(id);
            reject(new Error('Таймаут ответа Wordgun WebSocket'));
        }, WORDGUN_WS_REQUEST_TIMEOUT_MS);

        wordgun_socket.pending.set(id, { resolve, reject, timeout });

        try {
            ws.send(JSON.stringify({ token: token, word: word, id: id }));
        } catch (error) {
            clearTimeout(timeout);
            wordgun_socket.pending.delete(id);
            reject(error);
        }
    });
}
