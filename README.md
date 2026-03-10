# Практики 7–10

Этот репозиторий содержит полный стек для практик 7, 8, 9 и 10:
- Backend: Express API с bcrypt, JWT access/refresh токенами и защищёнными маршрутами.
- Frontend: React + Vite клиент с авторизацией, обновлением токена и CRUD для продуктов.

## Быстрый старт (Backend)

```bash
npm install
npm run dev
# или
npm start
```

Переменные окружения (опционально):
- `PORT` (по умолчанию `3000`)
- `JWT_SECRET` (по умолчанию `access_secret`)
- `JWT_REFRESH_SECRET` (по умолчанию `refresh_secret`)
- `ACCESS_TOKEN_TTL` (по умолчанию `15m`)
- `REFRESH_TOKEN_TTL` (по умолчанию `7d`)
- `CORS_ORIGIN` (по умолчанию `*`)

## Запуск Frontend (React)

```bash
cd client
npm install
npm run dev
```

Переменные окружения фронтенда (опционально):
- `VITE_API_BASE_URL` (по умолчанию `http://localhost:3000`)

## Тесты (Backend)

```bash
npm test
```

Тесты проверяют регистрацию, логин, `/api/auth/me`, refresh токены и защищённые CRUD маршруты продуктов.

## Основные маршруты API

### Аутентификация
- `POST /api/auth/register`
- `POST /api/auth/login` > возвращает `{ accessToken, refreshToken }`
- `GET /api/auth/me` (требует `Authorization: Bearer <ACCESS_TOKEN>`)
- `POST /api/auth/refresh` (требует заголовок `X-Refresh-Token: <REFRESH_TOKEN>`)

### Продукты
- `POST /api/products`
- `GET /api/products`
- `GET /api/products/:id` (защищённый)
- `PUT /api/products/:id` (защищённый)
- `DELETE /api/products/:id` (защищённый)

## Примеры запросов (curl)

### Регистрация
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","first_name":"Ivan","last_name":"Ivanov","password":"secret123"}'
```

### Логин (access + refresh токены)
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"secret123"}'
```

### /api/auth/me
```bash
curl http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

### /api/auth/refresh
```bash
curl -X POST http://localhost:3000/api/auth/refresh \
  -H "X-Refresh-Token: <REFRESH_TOKEN>"
```

### Защищённый GET /api/products/:id
```bash
curl http://localhost:3000/api/products/<PRODUCT_ID> \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```
