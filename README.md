# MusicGPT Backend API

A scalable, production-ready backend for an AI music creation platform. Users submit text prompts that are asynchronously processed through a job queue to simulate audio generation. The system is built on clean architecture principles with authentication, subscription tiers, rate limiting, WebSocket notifications, unified search, and Redis caching.

**Live API**: [https://your-deployment.up.railway.app](https://your-deployment.up.railway.app)
**Swagger Docs**: [https://your-deployment.up.railway.app/api/docs](https://your-deployment.up.railway.app/api/docs)

---

## Table of Contents

1. [Architecture](#architecture)
2. [Tech Stack](#tech-stack)
3. [Running with Docker](#running-with-docker)
4. [Running Locally](#running-locally)
5. [Environment Variables](#environment-variables)
6. [Authentication Flow](#authentication-flow)
7. [Token Invalidation Strategy](#token-invalidation-strategy)
8. [Subscription Tiers](#subscription-tiers)
9. [Rate Limiting](#rate-limiting)
10. [Job Queue & Prompt Processing](#job-queue--prompt-processing)
11. [Cron Scheduler](#cron-scheduler)
12. [WebSocket Notifications](#websocket-notifications)
13. [Cache Strategy](#cache-strategy)
14. [Unified Search](#unified-search)
15. [API Reference](#api-reference)

---

## Architecture

Clean Architecture with strict inward dependency flow:

```
interfaces/ ──► application/ ──► domain/
                    ▲
              infrastructure/
```

```
src/
├── domain/               # Pure TypeScript types — no frameworks, no ORMs
│   └── entities.ts       # User, Prompt, Audio types
│
├── application/          # Business logic — depends only on domain
│   ├── interfaces.ts     # Repository & service interfaces (ports)
│   └── use-cases/
│       ├── AuthService.ts
│       └── SubscriptionService.ts
│
├── infrastructure/       # Concrete implementations (adapters)
│   ├── database/
│   │   ├── prisma.ts           # Prisma client (PrismaPg adapter)
│   │   ├── UserRepository.ts
│   │   ├── PromptRepository.ts
│   │   └── AudioRepository.ts
│   ├── redis/
│   │   └── RedisService.ts     # ioredis wrapper
│   ├── queue/
│   │   ├── PromptQueue.ts      # BullMQ queue definition
│   │   └── PromptWorker.ts     # BullMQ worker
│   └── cron/
│       └── scheduler.ts        # node-cron job
│
├── interfaces/           # HTTP & WebSocket — thin controllers only
│   ├── http/
│   │   ├── routes/             # Express route handlers
│   │   └── middlewares/
│   │       ├── AuthMiddleware.ts
│   │       ├── RateLimiterMiddleware.ts
│   │       └── CacheMiddleware.ts
│   └── ws/
│       └── WebSocketService.ts
│
├── config/
│   ├── env.ts            # Env var validation (fails fast if missing)
│   └── swagger.ts        # OpenAPI 3.0 spec
├── container.ts          # tsyringe DI registrations
└── index.ts              # App bootstrap
```

**Key rule**: ORM models (Prisma types) never leak outside `infrastructure/database/`. Repositories map Prisma results to domain entities before returning them.

---

## Tech Stack

| Component     | Technology              |
|---------------|-------------------------|
| Language      | TypeScript (strict mode) |
| Framework     | Express.js v5           |
| Database      | PostgreSQL 15           |
| ORM           | Prisma 7 (PrismaPg adapter) |
| Cache         | Redis 7 (ioredis)       |
| Job Queue     | BullMQ                  |
| Scheduler     | node-cron               |
| WebSocket     | ws                      |
| DI Container  | tsyringe                |
| API Docs      | Swagger UI (OpenAPI 3.0) |
| Container     | Docker & Docker Compose |

---

## Running with Docker

> **Requires**: Docker Desktop running.

```bash
# Clone the repo
git clone https://github.com/your-username/musicgpt-backend.git
cd musicgpt-backend

# Start all services (API + PostgreSQL + Redis)
docker-compose up --build
```

This starts:

| Service    | URL / Port                          |
|------------|-------------------------------------|
| API        | http://localhost:3000               |
| Swagger    | http://localhost:3000/api/docs      |
| PostgreSQL | localhost:5432                      |
| Redis      | localhost:6379                      |

Migrations run automatically on container start via `prisma migrate deploy`.

To stop:
```bash
docker-compose down

# To also remove volumes (wipes database):
docker-compose down -v
```

---

## Running Locally

> **Requires**: Node.js 20+, PostgreSQL, and Redis running locally.

**1. Install dependencies**

```bash
npm install
```

**2. Set up environment**

Create a `.env` file in the project root:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/musicgpt?schema=public
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
JWT_REFRESH_SECRET=your-super-secret-refresh-key-min-32-chars
PORT=3000
```

**3. Run database migrations**

```bash
npm run migrate
```

**4. Generate Prisma client**

```bash
npm run generate
```

**5. Start the development server**

```bash
npm run dev
```

The server starts at `http://localhost:3000` with hot-reload via `ts-node-dev`.

**Other scripts**

```bash
npm run build      # Compile TypeScript to dist/
npm run start      # Run compiled dist/index.js
npm run migrate    # Run Prisma migrations (dev)
npm run generate   # Regenerate Prisma client after schema changes
```

---

## Environment Variables

| Variable             | Required | Description                              | Example                                              |
|----------------------|----------|------------------------------------------|------------------------------------------------------|
| `DATABASE_URL`       | Yes      | PostgreSQL connection string             | `postgresql://user:pass@localhost:5432/musicgpt`     |
| `REDIS_URL`          | Yes      | Redis connection string (supports auth)  | `redis://default:password@localhost:6379`            |
| `JWT_SECRET`         | Yes      | Secret for signing access tokens         | `a-long-random-string-32-chars-minimum`              |
| `JWT_REFRESH_SECRET` | Yes      | Secret for signing refresh tokens        | `a-different-long-random-string`                     |
| `PORT`               | No       | HTTP server port (default: `3000`)       | `3000`                                               |

> Never commit `.env` to source control. The app validates all required variables on startup and exits immediately if any are missing.

---

## Authentication Flow

```
┌─────────────┐                          ┌──────────────┐
│   Client    │                          │   Server     │
└──────┬──────┘                          └──────┬───────┘
       │                                        │
       │  POST /auth/register                   │
       │  { email, password, display_name }     │
       │ ─────────────────────────────────────► │
       │                                        │  Hash password (bcrypt)
       │                                        │  Create User record
       │  { accessToken, refreshToken }         │  Store refreshToken in DB
       │ ◄───────────────────────────────────── │
       │                                        │
       │  GET /protected (Bearer accessToken)   │
       │ ─────────────────────────────────────► │
       │                                        │  Verify JWT signature
       │                                        │  Check Redis blacklist
       │  { data }                              │  Attach req.user
       │ ◄───────────────────────────────────── │
       │                                        │
       │  [Access token expires after 15 min]   │
       │                                        │
       │  POST /auth/refresh                    │
       │  { refreshToken }                      │
       │ ─────────────────────────────────────► │
       │                                        │  Verify refresh token signature
       │                                        │  Check DB token matches exactly
       │  { new accessToken, new refreshToken } │  Issue new pair, overwrite DB
       │ ◄───────────────────────────────────── │
       │                                        │
       │  POST /auth/logout (Bearer token)      │
       │ ─────────────────────────────────────► │
       │                                        │  Set DB refresh_token = null
       │                                        │  Add access token to Redis blacklist
       │  { message: "Logged out" }             │  (TTL = remaining token lifetime)
       │ ◄───────────────────────────────────── │
```

### Token Invalidation Strategy

Two-layer approach:

**1. Refresh Token Rotation**
Every `/auth/refresh` call issues a brand new refresh token and overwrites the stored one in the database. The old token is immediately invalidated. If an attacker steals a refresh token, they get at most one use before the legitimate user's next refresh rotates it.

**2. Access Token Blacklisting**
On logout, the current access token is stored in Redis with a TTL equal to its remaining lifetime (up to 15 minutes). Every authenticated request checks the blacklist — blacklisted tokens are rejected with `401`. Once the token naturally expires, Redis automatically removes the key.

This combination means:
- Logout is immediate and secure (no waiting for token expiry)
- No permanent storage growth (Redis TTL handles cleanup)
- Refresh token theft is contained to a single use window

---

## Subscription Tiers

| Feature           | FREE                        | PAID                        |
|-------------------|-----------------------------|-----------------------------|
| Rate limit        | 20 requests / minute        | 100 requests / minute       |
| Queue priority    | Priority 2 (processed last) | Priority 1 (processed first)|
| Cost              | Free                        | Simulated upgrade           |

**Endpoints:**

```
POST /subscription/subscribe    → Upgrade current user to PAID
POST /subscription/cancel       → Downgrade current user to FREE
```

Both require a valid `Authorization: Bearer <token>` header. The subscription status is stored on the `User` record and read dynamically by both the rate limiter and the queue enqueue logic.

---

## Rate Limiting

Redis-backed sliding window counter, applied to all authenticated routes.

**Algorithm:**

```
On each request:
  key = "rate:<userId>"
  count = INCR key
  if count == 1:
    EXPIRE key 60        ← start 60-second window on first request
  if count > limit:
    return 429 with Retry-After header
```

**Limits by tier:**

| Tier | Requests | Window |
|------|----------|--------|
| FREE | 20       | 60 sec |
| PAID | 100      | 60 sec |

Response headers on all requests:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
```

Response on limit exceeded:
```json
HTTP 429 Too Many Requests
{ "error": "Rate limit exceeded. Try again in N seconds." }
```

---

## Job Queue & Prompt Processing

BullMQ (backed by Redis) processes prompts asynchronously in priority order.

```
User
 │
 │  POST /prompts { "text": "upbeat jazz piano" }
 ▼
Prompt created → status: PENDING
 │
 │  [every 10 seconds]
 ▼
Cron Job scans PENDING prompts
 │
 ├─ PAID user? → enqueue with priority 1 (HIGH)
 └─ FREE user? → enqueue with priority 2 (LOW)
                 → status set to: PROCESSING
 │
 ▼
BullMQ Worker picks up job
 │
 ├─ Simulate generation delay (2–5 seconds)
 ├─ Create Audio record in database
 ├─ Update Prompt → status: COMPLETED
 └─ Send WebSocket event → user's channel
```

**Job retry policy:**
- Max 3 attempts
- Exponential backoff (1s, 2s, 4s)
- On all retries exhausted: Prompt is reset back to `PENDING` so the cron scheduler can re-enqueue it on the next cycle

---

## Cron Scheduler

Implemented with `node-cron`, runs inside the same process as the API.

| Property       | Value                              |
|----------------|------------------------------------|
| Schedule       | Every 10 seconds                   |
| Batch size     | Up to 20 PENDING prompts per cycle |
| De-duplication | Sets status to PROCESSING immediately after enqueue to prevent double-enqueue |

The scheduler fetches PENDING prompts with the user's subscription status via a JOIN, so it can assign the correct BullMQ priority in a single query.

---

## WebSocket Notifications

**Connect:**

```
ws://localhost:3000/ws?token=<accessToken>
```

The server validates the JWT on connection. Invalid tokens are immediately closed with code `4001`.

**Events sent by server:**

| Event              | Payload                                              | When                            |
|--------------------|------------------------------------------------------|---------------------------------|
| `CONNECTED`        | `{ type: "CONNECTED", userId }`                      | On successful connection        |
| `PROMPT_COMPLETED` | `{ type: "PROMPT_COMPLETED", promptId, audioId, audio }` | When a prompt finishes processing |

**Example client (browser):**

```javascript
const token = 'your-access-token';
const ws = new WebSocket(`ws://localhost:3000/ws?token=${token}`);

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.type === 'PROMPT_COMPLETED') {
    console.log('Audio ready:', msg.audio);
  }
};
```

The server maintains a `Map<userId, WebSocket>` so each user has exactly one active channel. Reconnections replace the previous socket.

---

## Cache Strategy

GET endpoints are cached in Redis with a 60-second TTL using response interception.

**Cached endpoints:**

| Endpoint         | Cache Key Pattern              |
|------------------|-------------------------------|
| `GET /users`     | `cache:/users?cursor=...`     |
| `GET /users/:id` | `cache:/users/:id`            |
| `GET /audio`     | `cache:/audio?cursor=...`     |
| `GET /audio/:id` | `cache:/audio/:id`            |

**How it works:**

```
Request arrives
      │
      ▼
Check Redis for key
      │
 HIT ─┤─ MISS
      │       │
      │       ▼
      │   Execute handler
      │       │
      │       ▼
      │   Intercept res.json()
      │       │
      │       ▼
      │   Store in Redis (TTL 60s)
      │       │
      └───────┤
              ▼
         Send response
```

**Cache invalidation:**

When `PUT /users/:id` or `PUT /audio/:id` is called, all Redis keys matching the prefix (`cache:/users*` or `cache:/audio*`) are deleted, ensuring the next request fetches fresh data.

---

## Unified Search

`GET /search?q=<query>&user_cursor=<id>&audio_cursor=<id>&limit=<n>`

Searches across **Users** (email, display_name) and **Audio** (title) in a single request.

**Ranking algorithm:**

Results are scored at the database level using a `CASE` expression:

```sql
CASE
  WHEN field = 'query'          THEN 2  -- exact match
  WHEN field ILIKE '%query%'    THEN 1  -- partial match (case-insensitive)
END AS score
```

Results are ordered by `score DESC, id ASC` for stable, deterministic pagination.

**Cursor-based pagination:**

Each resource type (users, audio) has its own independent cursor. The last record's `id` is returned as `next_cursor`. Pass it on the next request to continue paging.

**Response shape:**

```json
{
  "users": {
    "data": [
      { "id": "...", "email": "...", "display_name": "...", "score": 2 }
    ],
    "meta": {
      "next_cursor": "uuid-of-last-user-in-this-page"
    }
  },
  "audio": {
    "data": [
      { "id": "...", "title": "...", "url": "...", "score": 1 }
    ],
    "meta": {
      "next_cursor": null
    }
  }
}
```

`next_cursor: null` means there are no more results for that resource.

---

## API Reference

Full interactive documentation available at `/api/docs`.

### Auth

| Method | Endpoint          | Auth | Description                              |
|--------|-------------------|------|------------------------------------------|
| POST   | `/auth/register`  | No   | Register with email + password           |
| POST   | `/auth/login`     | No   | Login, receive access + refresh tokens   |
| POST   | `/auth/refresh`   | No   | Exchange refresh token for new pair      |
| POST   | `/auth/logout`    | Yes  | Invalidate tokens                        |

### Subscription

| Method | Endpoint                    | Auth | Description           |
|--------|-----------------------------|------|-----------------------|
| POST   | `/subscription/subscribe`   | Yes  | Upgrade to PAID tier  |
| POST   | `/subscription/cancel`      | Yes  | Downgrade to FREE tier|

### Users

| Method | Endpoint       | Auth | Description                              |
|--------|----------------|------|------------------------------------------|
| GET    | `/users`       | Yes  | Paginated list (cursor-based, cached)    |
| GET    | `/users/:id`   | Yes  | Single user by ID (cached)               |
| PUT    | `/users/:id`   | Yes  | Update display_name (clears cache)       |

### Audio

| Method | Endpoint       | Auth | Description                              |
|--------|----------------|------|------------------------------------------|
| GET    | `/audio`       | Yes  | Paginated list (cursor-based, cached)    |
| GET    | `/audio/:id`   | Yes  | Single audio by ID (cached)              |
| PUT    | `/audio/:id`   | Yes  | Update title (clears cache)              |

### Prompts

| Method | Endpoint         | Auth | Description                              |
|--------|------------------|------|------------------------------------------|
| POST   | `/prompts`       | Yes  | Submit prompt → triggers processing flow |
| GET    | `/prompts/:id`   | Yes  | Poll prompt status (PENDING / PROCESSING / COMPLETED) |

### Search

| Method | Endpoint   | Auth | Description                              |
|--------|------------|------|------------------------------------------|
| GET    | `/search`  | Yes  | Search users + audio with weighted ranking |

### System

| Method | Endpoint   | Auth | Description      |
|--------|------------|------|------------------|
| GET    | `/health`  | No   | Health check     |

---

## Quick Start Guide

> Get up and running in under 2 minutes with Docker.

```bash
# 1. Start everything
docker-compose up --build

# 2. Register a user
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"secret","display_name":"Your Name"}'

# 3. Copy the accessToken from the response, then submit a prompt
curl -X POST http://localhost:3000/prompts \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{"text":"upbeat jazz with piano and drums"}'

# 4. Wait ~10 seconds, then check your audio
curl http://localhost:3000/audio \
  -H "Authorization: Bearer <accessToken>"
```

Or open `http://localhost:3000/api/docs` and use the interactive Swagger UI — click **Authorize** and paste your `accessToken` to authenticate all requests.
