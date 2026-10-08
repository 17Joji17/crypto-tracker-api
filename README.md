# Crypto Tracker API

Backend-сервис для отслеживания цен криптовалют с использованием CoinMarketCap API.

Сервис предоставляет REST API для управления списком отслеживаемых криптовалют, получения актуальных цен, хранения истории цен в SQLite и автоматической фоновой синхронизации данных.

## Стек

- Node.js 22.13+
- Express.js
- TypeScript
- SQLite (`node:sqlite`, raw SQL, без ORM)
- Axios
- Jest
- Supertest
- OpenAPI 3.0
- CoinMarketCap API
- Git / GitHub

## Возможности

- авторизация через Bearer token;
- CRUD отслеживаемых криптовалют;
- проверка и идентификация криптовалют через CoinMarketCap;
- получение актуальной цены;
- хранение истории цен в SQLite;
- автоматическая фоновая синхронизация;
- групповые запросы цен по CoinMarketCap ID;
- обработка ошибок и таймаутов CoinMarketCap;
- корректное завершение работы по `SIGINT` и `SIGTERM`;
- OpenAPI 3.0 документация;
- Swagger UI;
- автоматические тесты API, CoinMarketCap-клиента и фоновых задач.

## Требования

Для запуска необходимы:

- Node.js 22.13 или новее;
- npm;
- API Key CoinMarketCap.

В проекте используется встроенный модуль `node:sqlite`, поэтому для данной реализации используется Node.js 22.13+.

Это соответствует требованию задания `Node.js 18+` и позволяет работать с SQLite без установки дополнительного драйвера.

## Установка

Клонировать репозиторий:

```bash
git clone https://github.com/17Joji17/crypto-tracker-api.git
cd crypto-tracker-api
```

Установить зависимости:

```bash
npm install
```

Создать файл `.env` на основе `.env.example`.

Пример:

```env
PORT=3000
API_KEY=your-local-api-key
DB_PATH=./data/app.sqlite

CMC_BASE_URL=https://pro-api.coinmarketcap.com
CMC_API_KEY=your-coinmarketcap-api-key
CMC_TIMEOUT_MS=5000
PRICE_CURRENCY=USD

PRICE_SYNC_INTERVAL_MS=60000
```

Настоящий `.env` не хранится в Git.

## Сборка

```bash
npm run build
```

## Запуск

```bash
npm start
```

После запуска API доступен по адресу:

```text
http://localhost:3000
```

## Авторизация

Все endpoints с префиксом `/api/*` требуют Bearer token.

API Key задаётся через переменную окружения:

```env
API_KEY=your-local-api-key
```

Пример заголовка:

```http
Authorization: Bearer your-local-api-key
```

Следующие endpoints доступны без авторизации:

```text
GET /health
GET /openapi.json
GET /docs
```

## API

### Проверка состояния сервиса

```http
GET /health
```

Пример ответа:

```json
{
  "status": "ok"
}
```

### Получить список отслеживаемых криптовалют

```http
GET /api/coins
```

### Получить криптовалюту по ID

```http
GET /api/coins/:id
```

### Добавить криптовалюту

```http
POST /api/coins
```

Тело запроса:

```json
{
  "symbol": "BTC"
}
```

Перед сохранением символ разрешается через CoinMarketCap в постоянный CoinMarketCap ID. После этого актуальные данные криптовалюты запрашиваются по полученному ID.

Пример сохранённой записи:

```json
{
  "id": 1,
  "cmc_id": 1,
  "symbol": "BTC",
  "name": "Bitcoin",
  "created_at": "2026-10-07T12:00:00.000Z",
  "updated_at": "2026-10-07T11:59:00.000Z"
}
```

`created_at` — время добавления записи в локальную базу.

`updated_at` — время последнего обновления котировки, полученное из данных CoinMarketCap.

### Изменить отслеживаемую криптовалюту

```http
PUT /api/coins/:id
```

Тело запроса:

```json
{
  "symbol": "ETH"
}
```

Новый символ также проверяется через CoinMarketCap и сохраняется вместе с соответствующим CoinMarketCap ID и названием.

### Удалить криптовалюту

```http
DELETE /api/coins/:id
```

При успешном удалении возвращается HTTP `204 No Content`.

### Получить актуальную цену

```http
GET /api/coins/:id/price
```

Пример ответа:

```json
{
  "coin_id": 1,
  "cmc_id": 1,
  "symbol": "BTC",
  "name": "Bitcoin",
  "price": "100000.5",
  "currency": "USD",
  "source": "CoinMarketCap",
  "updated_at": "2026-10-07T12:00:00.000Z",
  "fetched_at": "2026-10-07T12:00:01.000Z"
}
```

Валюта задаётся глобально:

```env
PRICE_CURRENCY=USD
```

### Получить историю цен

```http
GET /api/coins/:id/history
```

Можно указать максимальное количество записей:

```http
GET /api/coins/:id/history?limit=10
```

По умолчанию:

```text
limit = 100
```

Максимальное значение:

```text
1000
```

Пример ответа:

```json
{
  "coin": {
    "id": 1,
    "cmc_id": 1,
    "symbol": "BTC",
    "name": "Bitcoin"
  },
  "history": [
    {
      "id": 1,
      "price": "100000.5",
      "recorded_at": "2026-10-07T12:00:00.000Z"
    }
  ]
}
```

## CoinMarketCap API

Для получения актуальных данных используется официальный CoinMarketCap API.

API Key передаётся только сервером через переменную окружения:

```env
CMC_API_KEY=your-coinmarketcap-api-key
```

Ключ не хранится в исходном коде и не передаётся клиенту.

При добавлении или изменении криптовалюты символ сначала разрешается в CoinMarketCap ID через CoinMarketCap, после чего данные и цена запрашиваются уже по ID.

Это позволяет использовать стабильный идентификатор криптовалюты вместо дальнейшего обращения только по символу.

Для внешних HTTP-запросов настроен timeout:

```env
CMC_TIMEOUT_MS=5000
```

Сервис обрабатывает:

- неверный API Key;
- превышение rate limit;
- timeout;
- недоступность внешнего API;
- некорректный ответ CoinMarketCap;
- неизвестную криптовалюту.

## Фоновая синхронизация

Сервис автоматически обновляет цены всех отслеживаемых криптовалют.

Интервал задаётся через:

```env
PRICE_SYNC_INTERVAL_MS=60000
```

По умолчанию синхронизация выполняется раз в 60 секунд.

На каждом цикле список отслеживаемых криптовалют заново читается из SQLite.

Для нескольких криптовалют используется один групповой запрос по сохранённым CoinMarketCap ID, что уменьшает количество обращений к внешнему API.

Полученные цены сохраняются в таблицу истории.

## База данных

Используется SQLite без ORM.

SQL-запросы выполняются напрямую через `node:sqlite`.

При первом запуске приложение автоматически создаёт необходимые таблицы.

Файл базы данных не хранится в Git.

### Таблица `coins`

Содержит:

- `id` — локальный идентификатор;
- `cmc_id` — идентификатор CoinMarketCap;
- `symbol` — символ криптовалюты;
- `name` — название;
- `created_at` — дата добавления записи;
- `updated_at` — время последнего обновления данных по CoinMarketCap.

### Таблица `price_history`

Содержит:

- `id`;
- `coin_id`;
- `price`;
- `recorded_at`.

`coin_id` связан с таблицей `coins` через внешний ключ.

## Graceful shutdown

Приложение обрабатывает:

```text
SIGINT
SIGTERM
```

При завершении работы:

1. прекращается планирование новых фоновых задач;
2. приложение ожидает завершения текущей синхронизации;
3. останавливается HTTP-сервер;
4. закрывается соединение с SQLite.

## Обработка ошибок

API возвращает ошибки в JSON-формате:

```json
{
  "error": {
    "code": "COIN_NOT_FOUND",
    "message": "Coin not found"
  }
}
```

Используются HTTP-коды:

- `400` — ошибка валидации или неизвестная криптовалюта;
- `401` — неверный или отсутствующий Bearer token;
- `404` — ресурс не найден;
- `409` — конфликт данных;
- `500` — ошибка конфигурации или внутренняя ошибка;
- `502` — ошибка внешнего API;
- `503` — превышение rate limit CoinMarketCap;
- `504` — timeout внешнего API.

## Swagger / OpenAPI

Интерактивная Swagger-документация доступна после запуска приложения:

```text
http://localhost:3000/docs
```

Спецификация OpenAPI 3.0 находится в:

```text
openapi/openapi.json
```

Также её можно получить через API:

```http
GET /openapi.json
```

Файл можно импортировать в Swagger Editor или другой OpenAPI-совместимый инструмент.

## Тесты

Запуск всех тестов:

```bash
npm test
```

Запуск с отчётом покрытия:

```bash
npm run test:coverage
```

Тесты написаны на JavaScript и запускаются против скомпилированного приложения из `dist`.

Для тестов используются временные SQLite-файлы и mock-ответы CoinMarketCap, поэтому реальный внешний API не требуется.

Покрыты:

- позитивные и негативные сценарии API;
- Bearer-авторизация;
- валидация входных данных;
- CRUD криптовалют;
- получение актуальной цены;
- история цен;
- разрешение символа криптовалюты в CoinMarketCap ID;
- ошибки CoinMarketCap;
- timeout внешнего API;
- некорректный JSON;
- успешная фоновая синхронизация;
- ошибка фоновой синхронизации;
- остановка фоновой задачи;
- OpenAPI endpoint;
- Swagger UI endpoint.

## Хранение данных

Постоянные данные приложения хранятся в SQLite.

Файл базы данных, `.env`, результаты coverage, скомпилированный `dist` и `node_modules` исключены из Git.

## Структура проекта

```text
crypto-tracker-api/
├── openapi/
│   └── openapi.json
├── src/
│   ├── coinmarketcap/
│   ├── coins/
│   ├── db/
│   ├── jobs/
│   ├── middleware/
│   ├── prices/
│   ├── app.ts
│   └── server.ts
├── tests/
│   ├── coinmarketcap.test.js
│   ├── coins.test.js
│   └── price-sync.test.js
├── .env.example
├── .gitignore
├── jest.config.cjs
├── package.json
├── tsconfig.json
└── README.md
```

## Примечание

Docker и CI/CD в текущей версии проекта не используются.

Проект реализован в рамках backend Fast Track с использованием только требуемых технологий и стандартных возможностей Node.js.
