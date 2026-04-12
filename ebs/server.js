// server.js — EBS (Extension Backend Service) для Словотрон 9000.
// Принимает слово от зрителя (panel.html), верифицирует Twitch JWT,
// пересылает через Twitch PubSub в live_config.html стримера.
//
// Запуск: EXTENSION_SECRET=... CLIENT_ID=... OWNER_USER_ID=... node server.js
// Локальный тест: добавить MOCK_PUBSUB=true — PubSub вызов заменяется логом.

'use strict';

const express = require('express');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());

// ─── Конфигурация ─────────────────────────────────────────────────────────────

const SECRET       = Buffer.from(process.env.EXTENSION_SECRET || '', 'base64');
const CLIENT_ID    = process.env.CLIENT_ID    || '';
const OWNER_USER_ID = process.env.OWNER_USER_ID || '';
const MOCK_PUBSUB  = process.env.MOCK_PUBSUB === 'true';
const PORT         = process.env.PORT || 3000;

if (!process.env.EXTENSION_SECRET) {
    console.error('[EBS] EXTENSION_SECRET не задан — JWT верификация не будет работать');
}

// ─── CORS ────────────────────────────────────────────────────────────────────
// Расширения Twitch грузятся с домена extension-files.twitch.tv и подобных.

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

// ─── POST /word ───────────────────────────────────────────────────────────────

app.post('/word', async (req, res) => {
    // 1. Верификация viewer JWT
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing Authorization header' });
    }

    let payload;
    try {
        payload = jwt.verify(auth.slice(7), SECRET);
    } catch (e) {
        return res.status(401).json({ error: 'Invalid token', detail: e.message });
    }

    if (payload.role !== 'viewer') {
        return res.status(403).json({ error: 'Only viewers can submit words' });
    }

    // 2. Валидация слова
    const { word } = req.body;
    if (!word || typeof word !== 'string') {
        return res.status(400).json({ error: 'Missing word' });
    }

    // Нормализация — зеркало логики из ext-live-config.js
    const clean = word.replace(/ё/gi, 'е').replace(/[^a-zA-Zа-яА-Я]/g, '').toLowerCase();
    if (clean.length < 2 || clean.length > 20) {
        return res.status(400).json({ error: 'Word must be 2-20 letters' });
    }

    const channelId = payload.channel_id;

    // 3. Mock-режим — логируем вместо реального PubSub
    if (MOCK_PUBSUB) {
        console.log(`[MOCK] channel=${channelId} word=${clean}`);
        return res.json({ ok: true, mock: true });
    }

    // 4. Подписываем EBS JWT для Twitch API
    const ebsToken = jwt.sign(
        {
            exp: Math.floor(Date.now() / 1000) + 60,
            user_id: OWNER_USER_ID,
            role: 'external',
            channel_id: channelId,
            pubsub_perms: { send: ['broadcast'] }
        },
        SECRET
    );

    // 5. Отправляем слово в Twitch PubSub
    let pubsubRes;
    try {
        pubsubRes = await fetch('https://api.twitch.tv/helix/extensions/pubsub', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${ebsToken}`,
                'Client-Id': CLIENT_ID,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                target: ['broadcast'],
                broadcaster_id: channelId,
                message: JSON.stringify({ type: 'word', word: clean })
            })
        });
    } catch (e) {
        console.error('[EBS] Fetch error:', e.message);
        return res.status(502).json({ error: 'Network error reaching Twitch' });
    }

    if (!pubsubRes.ok) {
        const detail = await pubsubRes.text();
        console.error(`[EBS] PubSub ${pubsubRes.status}:`, detail);
        return res.status(502).json({ error: 'PubSub failed', status: pubsubRes.status });
    }

    console.log(`[EBS] channel=${channelId} word=${clean} → OK`);
    res.json({ ok: true });
});

// ─── Запуск ───────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
    console.log(`[EBS] Listening on :${PORT}  mock=${MOCK_PUBSUB}`);
});
