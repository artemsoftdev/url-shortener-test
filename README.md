# URL Shortener

A small REST API built with **NestJS + TypeScript + TypeORM + PostgreSQL**, featuring JWT
authentication and short-link management.

## Stack

- NestJS 10 / TypeScript 5
- TypeORM + PostgreSQL 16
- JWT (Passport) + bcrypt
- class-validator / class-transformer
- `@nestjs/throttler` — rate limiting
- Jest + Supertest — unit + e2e
- ESLint + Prettier
- Docker Compose for local database

## Getting started

1. Start Postgres:

   ```bash
   docker compose up -d
   ```

2. Copy environment variables (defaults already match the compose file):

   ```bash
   cp .env.example .env
   ```

3. Install dependencies and run:

   ```bash
   npm install
   npm run start:dev
   ```

The API starts on `http://localhost:3000`.

## Environment variables (`.env`)

| Variable         | Description                       |
| ---------------- | --------------------------------- |
| `PORT`           | HTTP server port                  |
| `BASE_URL`       | Base URL used for `shortUrl`      |
| `DB_HOST`        | Postgres host                     |
| `DB_PORT`        | Postgres port (compose uses 5433) |
| `DB_USER`        | Postgres user                     |
| `DB_PASSWORD`    | Postgres password                 |
| `DB_NAME`        | Postgres database name            |
| `JWT_SECRET`     | JWT signing secret                |
| `JWT_EXPIRES_IN` | JWT lifetime                      |

> TypeORM runs with `synchronize: true` — the schema is applied automatically.
> For production, switch to migrations.

## Endpoints

### `POST /auth/register`
Creates a new user. Returns a JWT.

```bash
curl -X POST http://localhost:3000/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"user@example.com","password":"secret123"}'
```

### `POST /auth/login`
Logs a user in — returns a JWT.

```bash
curl -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"user@example.com","password":"secret123"}'
```

Both return:

```json
{
  "accessToken": "eyJhbGciOi...",
  "user": { "id": "uuid", "email": "user@example.com" }
}
```

### `POST /links` *(auth)*
Creates a short link.

```bash
curl -X POST http://localhost:3000/links \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://example.com/"}'
```

### `GET /links` *(auth)*
Returns all links owned by the current user.

```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/links
```

### `GET /links/:code`
Public `302` redirect to the original URL.

```bash
curl -I http://localhost:3000/links/zm7lRhy
```

## Validation and errors

- Global `ValidationPipe` with `whitelist` + `forbidNonWhitelisted`.
- `400` — invalid body (email / short password / malformed URL).
- `401` — missing token or invalid credentials.
- `404` — unknown `code`.
- `409` — email already registered.
- `429` — rate limit exceeded.

## Rate limiting

`@nestjs/throttler` is registered globally via `APP_GUARD`:

- **default**: 60 requests / 60 seconds per IP — applied to every endpoint.
- **auth**: 10 requests / 60 seconds per IP — applied to `POST /auth/*`
  (via the `@Throttle({ auth: ... })` decorator on `AuthController`) to mitigate brute-force.

Disabled in tests via `skipIf: () => process.env.NODE_ENV === 'test'`.

## Tests

```bash
npm test         # unit tests (AuthService, LinksService) — 10 tests
npm run test:e2e # full-flow e2e via Supertest — 12 tests
```

- E2E requires a running Postgres (`docker compose up -d`).
- Tables are truncated between tests with `TRUNCATE ... RESTART IDENTITY CASCADE`.
- E2E runs with `--runInBand` to avoid database races.

## Scripts

```bash
npm run start:dev   # dev server with hot-reload
npm run build       # build into dist/
npm run start:prod  # run the built bundle
npm run lint        # eslint (check only)
npm run lint:fix    # eslint --fix
npm run format      # prettier --write
npm test            # unit tests
npm run test:e2e    # e2e via Supertest (requires Postgres)
```

## Project layout

```
src/
├── app.module.ts
├── main.ts
├── auth/
│   ├── auth.controller.ts
│   ├── auth.module.ts
│   ├── auth.service.ts
│   ├── auth.service.spec.ts
│   ├── current-user.decorator.ts
│   ├── jwt-auth.guard.ts
│   ├── jwt.strategy.ts
│   └── dto/auth.dto.ts
├── users/
│   ├── user.entity.ts
│   ├── users.module.ts
│   └── users.service.ts
└── links/
    ├── link.entity.ts
    ├── links.controller.ts
    ├── links.module.ts
    ├── links.service.ts
    ├── links.service.spec.ts
    └── dto/create-link.dto.ts
test/
├── app.e2e-spec.ts
└── jest-e2e.json
```
