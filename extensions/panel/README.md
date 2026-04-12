# Slovotron — Twitch Extension

Панель расширения для Twitch. Состоит из трёх страниц:

| Файл | Кто видит | Назначение |
|------|-----------|-----------|
| `live_config.html` | Стример | Полная игровая панель: ведёт игру, видит таблицу лидеров |
| `panel.html` | Зрители | Панель для угадывания слов и просмотра своего прогресса |
| `config.html` | Стример | Настройки расширения (EBS-токен и др.) |

---

## Структура файлов

В репозитории хранится только extension-специфичный код. Всё остальное — build-артефакты,
генерируемые скриптом `build:extension` из корневых директорий.

```
extensions/panel/
├── live_config.html
├── panel.html
├── config.html
│
├── css/
│   ├── ext-live-config.css   # Переопределения для панели стримера (шрифт, отступы, broadcast-статус)
│   ├── panel.css             # Стили панели зрителя (318px)
│   │
│   │   # Build-артефакты — не редактировать, копируются из корневого css/:
│   ├── reset.css             # ← из css/
│   ├── style.css             # ← из css/
│   ├── leaderboard.css       # ← из css/
│   └── tips.css              # ← из css/
│
├── js/
│   ├── ext-live-config.js    # Логика панели стримера
│   ├── ext-viewer.js         # Логика панели зрителей
│   ├── ext-config.js         # Логика страницы настроек
│   ├── ext-settings.js       # Чтение настроек из Twitch.ext.configuration
│   ├── ext-init.js           # Инициализация с Twitch-авторизацией
│   ├── ext-panel-leaderboard.js  # Таблица лидеров на стороне зрителя
│   │
│   │   # Build-артефакты — не редактировать, копируются из корневого js/:
│   ├── config.js, api.js, ws.js, tips.js
│   ├── leaderboard.js, confetti.js, easter_eggs.js
│   └── libs/                 # Внешние библиотеки (tmi, tsparticles)
│
├── img/                      # ← build-артефакт, копируется из корневого img/
└── audio/                    # ← build-артефакт, копируется из корневого audio/
```

> Редактировать только `ext-*.js`, `ext-live-config.css` и `panel.css`.
> Всё остальное — источник истины в корне репозитория.

---

## Сборка перед запуском

После клонирования репозитория нужно сгенерировать build-артефакты:

```bash
npm run build:extension
```

Скрипт копирует в `extensions/panel/` следующее:
- `js/` — 7 shared JS модулей игры
- `css/` — reset.css, style.css, leaderboard.css, tips.css
- `img/` — картинки (easter eggs и др.)
- `audio/` — звуковые эффекты

> Запускать после каждого изменения в корневых `js/`, `css/`, `img/`, `audio/`,
> если хочешь проверить расширение.

---

## Локальная разработка

Запустить HTTP-сервер из директории `extensions/panel/` (нужен localhost для работы localStorage между вкладками):

```bash
cd extensions/panel
python -m http.server 8080
```

Открыть в браузере:

- **Панель стримера:** http://localhost:8080/live_config.html
- **Панель зрителя:** http://localhost:8080/panel.html
- **Настройки:** http://localhost:8080/config.html

Для теста двух панелей одновременно открой обе вкладки — они общаются через `localStorage`.
Моки `Twitch.ext` активируются автоматически на `localhost`.

---

## Деплой на Twitch

1. Собрать все файлы:
   ```bash
   npm run build:extension
   ```

2. Проверить, что всё на месте:
   ```bash
   npm run verify:extension
   ```

3. Упаковать директорию `extensions/panel/` в zip-архив и загрузить в [Twitch Developer Console](https://dev.twitch.tv/console/extensions).
