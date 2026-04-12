# Slovotron — Twitch Extension

Панель расширения для Twitch. Состоит из трёх страниц:

| Файл | Кто видит | Назначение |
|------|-----------|-----------|
| `live_config.html` | Стример | Полная игровая панель: ведёт игру, видит таблицу лидеров |
| `panel.html` | Зрители | Панель для угадывания слов и просмотра своего прогресса |
| `config.html` | Стример | Настройки расширения (EBS-токен и др.) |

---

## Структура файлов

```
extensions/panel/
├── live_config.html      # Панель стримера
├── panel.html            # Панель зрителей
├── config.html           # Страница настроек
├── css/
├── audio/
├── img/
└── js/
    ├── ext-live-config.js    # Логика панели стримера
    ├── ext-viewer.js         # Логика панели зрителей
    ├── ext-config.js         # Логика страницы настроек
    ├── ext-settings.js       # Чтение настроек из Twitch.ext.configuration
    ├── ext-init.js           # Инициализация с Twitch-авторизацией
    ├── ext-panel-leaderboard.js  # Таблица лидеров на стороне зрителя
    │
    │   # Файлы ниже — build-артефакты, не редактировать вручную:
    ├── config.js             # ← копируется из ../../js/
    ├── api.js                # ← копируется из ../../js/
    ├── ws.js                 # ← копируется из ../../js/
    ├── tips.js               # ← копируется из ../../js/
    ├── leaderboard.js        # ← копируется из ../../js/
    ├── confetti.js           # ← копируется из ../../js/
    └── easter_eggs.js        # ← копируется из ../../js/
```

Shared-файлы (`config.js`, `api.js` и др.) — это копии из корневого `js/`.
Источник истины — корневой `js/`, редактировать только там.

---

## Сборка перед запуском

Shared JS-файлы не хранятся в репозитории. После клонирования нужно их сгенерировать:

```bash
npm run build:extension
```

Скрипт копирует shared-файлы из корневого `js/` в `extensions/panel/js/`.

> Запускать также после каждого изменения в корневом `js/`, если хочешь проверить расширение.

---

## Локальная разработка

Открыть нужную страницу напрямую в браузере:

- **Панель стримера:** `extensions/panel/live_config.html`
- **Панель зрителя:** `extensions/panel/panel.html`
- **Настройки:** `extensions/panel/config.html`

В файлах есть встроенный mock для `Twitch.ext` — расширение работает без подключения к Twitch.

---

## Деплой на Twitch

1. Собрать shared-файлы:
   ```bash
   npm run build:extension
   ```

2. Проверить, что все файлы на месте:
   ```bash
   npm run verify:extension
   ```

3. Упаковать всю директорию `extensions/panel/` в zip-архив.

3. Загрузить архив в [Twitch Developer Console](https://dev.twitch.tv/console/extensions).
