# Frontend and Backend Practice 7-12

- `Практика 7`: backend на `Node.js + Express`, регистрация и логин.
- `Практика 8`: хеширование паролей через `bcrypt`, JWT access/refresh tokens.
- `Практика 9`: CRUD для товаров.
- `Практика 10`: frontend на `React + Vite`, авторизация, `/me`, refresh-on-401, базовый UI.
- `Практика 11`: RBAC, роли `user/seller/admin`, управление пользователями, блокировка, ограничения доступа по ролям.
- `Практика 12`: тестирование backend, обновлённая документация, ручной checklist, проверка запуска и сборки.

## Стек технологий

- Backend: `Node.js`, `Express`, `bcrypt`, `jsonwebtoken`
- Testing: `Jest`, `Supertest`
- Frontend: `React`, `React Router`, `Vite`
- Client API: `fetch`
- Storage: `in-memory`

## Структура проекта

```text
.
├─ src/
│  └─ app.js
├─ tests/
│  └─ auth-products.test.js
├─ client/
│  ├─ src/
│  │  ├─ api.js
│  │  ├─ auth.js
│  │  ├─ App.jsx
│  │  ├─ components/
│  │  │  └─ Nav.jsx
│  │  └─ pages/
│  │     ├─ Login.jsx
│  │     ├─ Register.jsx
│  │     ├─ Products.jsx
│  │     ├─ ProductDetails.jsx
│  │     ├─ Me.jsx
│  │     └─ Users.jsx
│  └─ package.json
├─ CHECKLIST.md
├─ package.json
└─ README.md
```

## Установка зависимостей

Backend:

```bash
npm install
```

Frontend:

```bash
cd client
npm install
```

Или из корня:

```bash
npm --prefix client install
```

## Запуск backend

Режим разработки:

```bash
npm run dev
```

Обычный запуск:

```bash
npm start
```

Backend по умолчанию стартует на `http://localhost:3000`.

## Запуск frontend

Из папки `client`:

```bash
cd client
npm run dev
```

Или из корня:

```bash
npm --prefix client run dev
```

Frontend по умолчанию стартует на `http://localhost:5173`.

## Переменные окружения

### Backend

- `PORT` - порт backend, по умолчанию `3000`
- `JWT_SECRET` - секрет access token, по умолчанию `access_secret`
- `JWT_REFRESH_SECRET` - секрет refresh token, по умолчанию `refresh_secret`
- `ACCESS_TOKEN_TTL` - TTL access token, по умолчанию `15m`
- `REFRESH_TOKEN_TTL` - TTL refresh token, по умолчанию `7d`
- `CORS_ORIGIN` - значение `Access-Control-Allow-Origin`, по умолчанию `*`
- `ADMIN_EMAIL` - email bootstrap admin
- `ADMIN_PASSWORD` - пароль bootstrap admin
- `ADMIN_FIRST_NAME` - имя bootstrap admin
- `ADMIN_LAST_NAME` - фамилия bootstrap admin

### Frontend

- `VITE_API_BASE_URL` - адрес backend API, по умолчанию `http://localhost:3000`

## Bootstrap admin

В проекте нельзя зарегистрировать администратора через публичную форму. Первый `admin` создаётся автоматически при старте backend:

- при наличии `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_FIRST_NAME`, `ADMIN_LAST_NAME` используется конфигурация из env
- если env не заданы, для локальной разработки создаётся дефолтный admin:

```text
email: admin@example.com
password: admin12345
first_name: Local
last_name: Admin
role: admin
```

Это сделано только для локальной учебной in-memory среды.

## Роли и доступ

- `guest` - неавторизованный пользователь
- `user` - просмотр товаров
- `seller` - просмотр, создание и редактирование товаров
- `admin` - права seller + управление пользователями + удаление товаров + блокировка пользователей

## API маршруты

### Аутентификация

| Метод | Маршрут | Доступ | Описание |
| --- | --- | --- | --- |
| `POST` | `/api/auth/register` | `guest` | Регистрация обычного пользователя с ролью `user` |
| `POST` | `/api/auth/login` | `guest` | Логин, выдача `{ accessToken, refreshToken }` |
| `POST` | `/api/auth/refresh` | `guest` | Обновление токенов |
| `GET` | `/api/auth/me` | `user/seller/admin` | Получение текущего пользователя |

`/api/auth/refresh` принимает refresh token из:
- заголовка `X-Refresh-Token`
- заголовка `Authorization: Bearer <REFRESH_TOKEN>`
- `req.body.refreshToken`

### Пользователи

| Метод | Маршрут | Доступ | Описание |
| --- | --- | --- | --- |
| `GET` | `/api/users` | `admin` | Список пользователей |
| `GET` | `/api/users/:id` | `admin` | Просмотр пользователя |
| `PUT` | `/api/users/:id` | `admin` | Обновление имени, фамилии, email, роли, статуса блокировки |
| `DELETE` | `/api/users/:id` | `admin` | Логическая блокировка пользователя |

### Товары

| Метод | Маршрут | Доступ | Описание |
| --- | --- | --- | --- |
| `POST` | `/api/products` | `seller/admin` | Создание товара |
| `GET` | `/api/products` | `user/seller/admin` | Список товаров |
| `GET` | `/api/products/:id` | `user/seller/admin` | Детали товара |
| `PUT` | `/api/products/:id` | `seller/admin` | Редактирование товара |
| `DELETE` | `/api/products/:id` | `admin` | Удаление товара |

### Статусы ответов

- `400` - некорректные данные
- `401` - отсутствует или невалидна аутентификация
- `403` - недостаточно прав или пользователь заблокирован
- `404` - сущность не найдена
- `409` - конфликт, например дублирующийся email

## Сценарий access/refresh token

1. Пользователь логинится через `/api/auth/login`.
2. Backend возвращает `accessToken` и `refreshToken`.
3. Frontend сохраняет токены в `localStorage`.
4. При запросах frontend отправляет `Authorization: Bearer <ACCESS_TOKEN>`.
5. Если API отвечает `401`, frontend автоматически вызывает `/api/auth/refresh`.
6. После успешного refresh новый access token подставляется, исходный запрос повторяется.
7. Если refresh неуспешен, токены очищаются и пользователь разлогинивается.
8. Если пользователь заблокирован, backend отклоняет работу с защищёнными маршрутами и frontend сбрасывает сессию.

## Сценарий RBAC

1. `guest` видит только страницы логина и регистрации.
2. После логина frontend получает `/api/auth/me` и знает текущую `role`.
3. UI показывает только разрешённые действия:
   - `user`: просмотр товаров
   - `seller`: просмотр + создание + редактирование
   - `admin`: всё выше + удаление товаров + управление пользователями
4. Backend дополнительно валидирует доступ через `authMiddleware` и `roleMiddleware`.
5. Даже если скрытый в UI маршрут вызвать вручную, backend вернёт `403`.

## Как протестировать

Backend-тесты:

```bash
npm test
```

Проверка frontend-сборки:

```bash
npm --prefix client run build
```

Ручной checklist вынесен в [CHECKLIST.md](./CHECKLIST.md).

## Ручной чек-лист

Краткая версия:

- зарегистрировать пользователя и убедиться, что роль по умолчанию `user`
- войти под `user` и проверить просмотр товаров без создания/редактирования/удаления
- войти под `admin`, перевести пользователя в `seller`
- войти под `seller`, создать и отредактировать товар
- убедиться, что `seller` не может удалить товар
- войти под `admin`, удалить товар
- открыть раздел пользователей, изменить роль пользователя и заблокировать его
- проверить, что заблокированный пользователь не может логиниться и работать с API

Подробный сценарий см. в [CHECKLIST.md](./CHECKLIST.md).

## Ограничения проекта

- все данные in-memory и не сохраняются после перезапуска сервера
- нет базы данных и миграций
- refresh tokens тоже хранятся только в памяти
- нет автоматизированных frontend-тестов, вместо этого используется ручной checklist
- backend реализован в одном файле `src/app.js` ради минимальных изменений текущей архитектуры
- дефолтный bootstrap admin предназначен только для локальной учебной среды

## Команды проекта

Backend:

```bash
npm install
npm run dev
# или
npm start
```

Frontend:

```bash
cd client
npm install
npm run dev
```

Тесты и сборка:

```bash
npm test
npm --prefix client run build
```
