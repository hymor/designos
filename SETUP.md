### DesignOS – Quick Start

#### 1. Prerequisites

- Node.js **20.11.x** (см. `.nvmrc`)
  - c `nvm`: `nvm install && nvm use`
- npm 10+ (идёт с Node 20)
- Docker + Docker Compose

#### 2. Установка зависимостей

```bash
# из корня репозитория
npm install           # для корневых скриптов
cd backend && npm install
cd ../frontend/shell && npm install
```

#### 3. Поднять PostgreSQL через Docker

В каталоге `backend` уже есть `docker-compose.yml` для Postgres 16.

Из корня проекта:

```bash
npm run db:up
```

Это запустит контейнер с:

- host: `localhost`
- port: `5432`
- database: `mydb`
- user/password: `postgres` / `postgres`

Остановить базу:

```bash
npm run db:down
```

#### 4. Настроить backend `.env`

Войти в `backend`:

```bash
cd backend
cp .env.example .env
```

По умолчанию:

- `DATABASE_URL` указывает на Docker‑Postgres
- `JWT_SECRET` — временный ключ (для локалки можно оставить как есть)

#### 5. Prisma: migrate + generate

```bash
cd backend
npx prisma migrate dev    # применит миграции к mydb
npx prisma generate       # обновит Prisma Client
```

Эти команды используют `prisma.config.ts` и `DATABASE_URL` из `.env`.

#### 6. Запуск backend (Nest + Prisma)

```bash
cd backend
npm run start:dev
```

Backend:

- слушает `http://localhost:3000/api`
- использует JWT‑auth (`/auth/register`, `/auth/login`, `/auth/me`)
- хранит Users / Projects / Documents в PostgreSQL через Prisma

#### 7. Запуск frontend (Angular shell)

В новом терминале:

```bash
cd frontend/shell
npm run start
```

По умолчанию Angular dev‑сервер поднимается на `http://localhost:4200`.

#### 8. Быстрые корневые скрипты

Из корня репозитория:

- `npm run dev:backend` — Nest backend (`backend/start:dev`)
- `npm run dev:frontend` — Angular frontend (`frontend/shell/start`)
- `npm run db:up` — запустить Postgres (Docker compose в `backend`)
- `npm run db:down` — остановить Postgres
- `npm run dev` — сокращение для `dev:frontend`

#### 9. Первый запуск как пользователь

1. Запусти `npm run db:up`, затем backend и frontend как выше.
2. Открой `http://localhost:4200`.
3. Перейди на `/auth/register`, создай пользователя (email + пароль).
4. После регистрации попадёшь на `/projects`.
5. Нажми **Create Project** — создастся новый проект + пустой документ, откроется редактор.

Все дальнейшие проекты и документы будут храниться в PostgreSQL и привязаны к твоему аккаунту.

