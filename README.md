# MusicGPT Backend API

A scalable, production-ready backend for the **MusicGPT AI Music Creation Platform** built with **clean architecture** principles.

## Architecture

```
src/
├── config/          # Environment & Swagger configuration
├── domain/          # Domain entities (User, Prompt, Audio)
├── application/     # Use cases, interfaces (ports)
│   ├── interfaces.ts
│   └── use-cases/   # AuthService, SubscriptionService
├── infrastructure/  # Concrete implementations (adapters)
│   ├── database/    # Prisma repositories
│   ├── redis/       # Redis caching service
│   ├── queue/       # BullMQ queue & worker
│   └── cron/        # Scheduled jobs
├── interfaces/      # HTTP controllers & WebSocket
│   ├── http/
│   │   ├── routes/       # Express route handlers
│   │   └── middlewares/  # Auth, RateLimiter, Cache
│   └── ws/          # WebSocket service
├── container.ts     # Dependency injection (tsyringe)
└── index.ts         # Application entrypoint
```

**Dependency flow**: `Interfaces → Application → Domain ← Infrastructure` (Dependency Inversion via tsyringe DI).

## Tech Stack

| Component | Technology |
|-----------|------------|
| Language | TypeScript |
| Framework | Express.js |
| Database | PostgreSQL (Prisma ORM) |
| Cache | Redis (ioredis) |
| Queue | BullMQ |
| Cron | node-cron |
| WebSocket | ws |
| DI | tsyringe |
| Docs | Swagger UI |
| Container | Docker & Docker Compose |

---

## How to Run

### With Docker (Recommended)

```bash
docker-compose up --build
```

This starts:
- **API** on `http://localhost:3000`
- **Swagger Docs** at `http://localhost:3000/api/docs`
- **PostgreSQL** on port `5432`
- **Redis** on port `6379`

### Locally (Without Docker)

1. **Prerequisites**: Node.js 20+, PostgreSQL, Redis running locally.

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment** — copy `.env` and adjust:
   ```
   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/musicgpt?schema=public
   REDIS_URL=redis://localhost:6379
   JWT_SECRET=your-secret-key
   JWT_REFRESH_SECRET=your-refresh-secret-key
   PORT=3000
   ```

4. **Run migrations**:
   ```bash
   npm run migrate
   ```

5. **Start the dev server**:
   ```bash
   npm run dev
   ```

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:postgres@localhost:5432/musicgpt` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `JWT_SECRET` | Secret for access tokens | — |
| `JWT_REFRESH_SECRET` | Secret for refresh tokens | — |
| `PORT` | API port | `3000` |

---

## Authentication Flow

```
Register/Login → { accessToken (15m), refreshToken (30d) }
    │
    ├── Access API with: Authorization: Bearer <accessToken>
    │
    ├── Token expired? → POST /auth/refresh { refreshToken }
    │                     → New { accessToken, refreshToken } (rotation)
    │
    └── Logout → POST /auth/logout
                 → Refresh token deleted from DB
                 → Access token added to Redis blacklist (TTL = remaining expiry)
```

### Token Invalidation Strategy

- **Token Rotation**: On every `/auth/refresh`, a new refresh token is issued and the old one is replaced in the database. This means a stolen refresh token can only be used once.
- **Access Token Blacklisting**: On `/auth/logout`, the current access token is added to a Redis blacklist with a TTL matching its remaining lifetime. Every authenticated request checks this blacklist.
- **Refresh Token Storage**: Refresh tokens are stored in the `User` table. On logout, the stored token is set to `null`, invalidating any outstanding refresh tokens.

---

## Subscription Perks

| Feature | FREE | PAID |
|---------|------|------|
| Rate Limit | 20 req/min | 100 req/min |
| Prompt Priority | Low (priority 2 in queue) | High (priority 1 in queue) |

Endpoints:
- `POST /subscription/subscribe` — Upgrade to PAID
- `POST /subscription/cancel` — Downgrade to FREE

---

## Rate Limiting

- **Redis-backed** sliding window counter per user (or IP for unauthenticated).
- **FREE users**: 20 requests per minute.
- **PAID users**: 100 requests per minute.
- Returns `429 Too Many Requests` when exceeded.
- Applied on all authenticated routes.

---

## Job Queue Processing Flow

```
User submits prompt (POST /prompts)
    → Status: PENDING
    → Cron (every 10s) scans PENDING prompts
    → Enqueues to BullMQ (PAID = priority 1, FREE = priority 2)
    → Status: PROCESSING
    → Worker simulates generation (2-5s delay)
    → Creates Audio record
    → Status: COMPLETED
    → WebSocket notification sent to user
```

### Cron Scheduler

- Runs every **10 seconds** using `node-cron`.
- Queries for `PENDING` prompts (up to 20 per batch).
- Enqueues them to BullMQ and immediately sets status to `PROCESSING` to prevent duplicate enqueue.

---

## Cache Strategy

- **Cached endpoints**: `GET /users`, `GET /users/:id`, `GET /audio`, `GET /audio/:id`
- **TTL**: 60 seconds (1 minute)
- **Cache key**: Request URL (e.g., `cache:/users?cursor=abc&limit=10`)
- **Invalidation**: On `PUT /users/:id` or `PUT /audio/:id`, all keys with the matching prefix (`/users*` or `/audio*`) are deleted from Redis.

---

## Unified Search

**Endpoint**: `GET /search?q=<query>&user_cursor=<cursor>&audio_cursor=<cursor>&limit=10`

### Ranking Logic

Results are scored at the database level:
- **Score 2 (Exact match)**: Field value exactly matches the query.
- **Score 1 (Partial match)**: Field value contains the query (case-insensitive ILIKE).
- Results are sorted by score descending, then by ID ascending for stable pagination.

### Cursor-Based Pagination

Each resource (users, audio) has its own cursor. The response includes `next_cursor` in the `meta` object. Pass it back as `user_cursor` or `audio_cursor` to fetch the next page.

---

## WebSocket

- **Endpoint**: `ws://localhost:3000/ws?token=<accessToken>`
- **Authentication**: JWT access token passed as query parameter.
- **Events**:
  - `CONNECTED` — Sent upon successful connection.
  - `PROMPT_COMPLETED` — Sent when a prompt finishes processing, includes the generated audio data.

---

## API Endpoints Summary

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/register` | No | Register new user |
| POST | `/auth/login` | No | Login |
| POST | `/auth/refresh` | No | Refresh tokens |
| POST | `/auth/logout` | Yes | Logout |
| POST | `/subscription/subscribe` | Yes | Upgrade to PAID |
| POST | `/subscription/cancel` | Yes | Downgrade to FREE |
| GET | `/users` | Yes | List users (paginated, cached) |
| GET | `/users/:id` | Yes | Get user (cached) |
| PUT | `/users/:id` | Yes | Update user |
| GET | `/audio` | Yes | List audio (paginated, cached) |
| GET | `/audio/:id` | Yes | Get audio (cached) |
| PUT | `/audio/:id` | Yes | Update audio |
| POST | `/prompts` | Yes | Submit prompt |
| GET | `/prompts/:id` | Yes | Get prompt status |
| GET | `/search` | Yes | Unified search |
| GET | `/health` | No | Health check |
