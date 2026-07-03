# KOVER Telegram Mini App

Telegram Mini App и бот для ежемесячной оплаты репетиций проекта KOVER.

## Что внутри

- `backend` — Express + TypeScript + Prisma, REST API, проверка Telegram `initData`, RBAC, YooKassa webhook.
- `bot` — grammY + `node-cron`, напоминания и inline-кнопки для заявок на отсрочку.
- `frontend` — React + TypeScript Mini App, адаптация под Telegram theme params.
- `docker-compose.yml` — локальный PostgreSQL.

## Быстрый запуск

1. Установите зависимости:

```bash
pnpm install
```

2. Скопируйте переменные окружения:

```bash
cp .env.example .env
```

3. Заполните `.env`:

```env
DATABASE_URL="postgresql://kover:kover@localhost:5432/kover?schema=public"
TELEGRAM_BOT_TOKEN="..."
ADMIN_TELEGRAM_IDS="123456789"
ADMIN_CHAT_IDS="123456789"
FRONTEND_URL="https://your-mini-app.example.com"
YOOKASSA_SHOP_ID="..."
YOOKASSA_SECRET_KEY="..."
YOOKASSA_RETURN_URL="https://your-mini-app.example.com/payment-return"
```

4. Поднимите базу:

```bash
docker compose up -d postgres
```

5. Примените миграции и сгенерируйте Prisma Client:

```bash
pnpm db:migrate
pnpm db:generate
```

6. Запустите проект:

```bash
pnpm dev
```

По умолчанию:

- backend: `http://localhost:4000`
- frontend: `http://localhost:5173`
- bot: long polling

## Демо-режим

Если frontend открыть в обычном браузере без Telegram `initData`, он автоматически включает демо-режим и показывает тестовые данные. Можно проверить оплату, заявки на отсрочку, участников, дашборд и настройки без PostgreSQL, backend, Telegram-бота и YooKassa.

Для принудительного демо-режима даже внутри Telegram задайте:

```env
VITE_DEMO_MODE="true"
```

## Telegram Mini App

1. Создайте бота через BotFather.
2. Укажите домен Mini App через BotFather.
3. Разместите frontend на HTTPS-домене.
4. В `.env` задайте `FRONTEND_URL`.

Backend проверяет `initData` на каждом `/api/*` запросе через HMAC-SHA256 и срок действия `TELEGRAM_INIT_DATA_TTL_SECONDS`.

## YooKassa

Создание платежа реализовано через `PaymentProvider`:

- `createPayment`
- `handleWebhook`
- `getPaymentStatus`

Текущая реализация — `YooKassaProvider`.

Webhook endpoint:

```text
POST https://your-backend.example.com/webhooks/yookassa
```

В личном кабинете YooKassa включите события:

- `payment.succeeded`
- `payment.canceled`

YooKassa webhook дополнительно перепроверяется через `GET /v3/payments/{id}` перед изменением статуса платежа. Если хотите ограничить отправителей по IP, заполните:

```env
YOOKASSA_ALLOWED_IPS="185.71.76.0/27,185.71.77.0/27"
```

## Основные API

Все `/api/*` маршруты требуют заголовок:

```http
Authorization: tma <Telegram WebApp initData>
```

Участник:

- `GET /api/me`
- `GET /api/me/summary`
- `GET /api/payments`
- `POST /api/payments`
- `GET /api/deferrals`
- `POST /api/deferrals`

Руководитель:

- `GET /api/admin/dashboard?period=YYYY-MM`
- `GET /api/admin/musicians`
- `POST /api/admin/musicians`
- `PATCH /api/admin/musicians/:id`
- `DELETE /api/admin/musicians/:id`
- `GET /api/admin/deferrals`
- `POST /api/admin/deferrals/:id/approve`
- `POST /api/admin/deferrals/:id/reject`
- `GET /api/admin/settings`
- `PATCH /api/admin/settings`

## Логика отсрочки

`payment_day` участника не меняется при одобрении отсрочки. Для текущего периода одобренная заявка делает участника не просроченным в дашборде, пока платеж не будет оплачен или заявка не будет изменена.

## Проверка

```bash
pnpm typecheck
pnpm build
```

Для локального frontend без Telegram можно положить тестовый `initData` в `VITE_DEV_INIT_DATA`, но backend всё равно проверит подпись токеном из `TELEGRAM_BOT_TOKEN`.
