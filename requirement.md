### **MusicGPT – Scalable Backend Architecture Challenge**

Welcome to the Backend Challenge for the **MusicGPT AI Music Creation Platform**.

This assignment evaluates your ability to design and implement a **scalable, production-ready backend system** with:

- Authentication + Refresh Tokens
- Subscription system
- Unified search
- Background job processing
- WebSockets
- Cron-driven workflows
- Redis caching
- Clean architecture
- Dockerized environment
- Thorough documentation
- Swagger documentation

You are **not** expected to build a full production app, but your submission should demonstrate **architectural thinking, code clarity, maintainability, and clean implementation**.

---

# **Project Overview**

You will build a simplified backend service representing the core primitives of the MusicGPT platform. Users can submit prompts that eventually generate audio. Processing is simulated via background jobs and cron tasks. The app includes authentication, subscription tiers, dynamic rate limiting, paginated unified search, caching, WebSockets, and clean architecture.

---

# **Functional Requirements**

## 1. **Data Models**

Use ORM (Prisma)

### **User**

- id (UUID)
- email (unique)
- password (hashed)
- display_name
- subscription_status: `FREE` | `PAID`
- created_at, updated_at

### **Prompt**

- id (UUID)
- user_id (FK)
- text
- status: `PENDING` | `PROCESSING` | `COMPLETED`
- created_at, updated_at

### **Audio**

- id (UUID)
- prompt_id (FK)
- user_id (FK)
- title
- url
- created_at, updated_at

Ensure relationships, indices, and migrations.

---

## 2. **Authentication (Required & Secure)**

Implement **JWT Access + Refresh Token** flow:

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`

Authentication Requirements:

- Access token short-lived (e.g. 5–15 minutes)
- Refresh token long-lived (e.g. 7–30 days)
- Token rotation approach OR blacklisting strategy required
- Refresh token must be stored securely (DB)
- Logout must invalidate tokens

Expectation:

**Explain your token invalidation strategy in README.**

---

## 3. **Subscription System (Paid vs Free)**

Implement endpoints:

- `POST /subscription/subscribe`
- `POST /subscription/cancel`

### Subscription Effects (Mandatory)

Paid users must receive:

- Higher rate limits
- Priority prompt processing in the job queue

Free users:

- Lower rate limits
- Slower or lower priority job processing

The exact numbers are up to you - but must be clearly documented.

---

## 4. **Dynamic Rate Limiting (Redis Required)**

Implement rate limiting based on subscription tier:

- FREE example: 20 requests/min
- PAID example: 100 requests/min

Must be:

- Redis-backed
- Enforced on authenticated routes
- Clearly documented

---

## 5. **Unified Search (Paginated + Weighted Ranking)**

Single endpoint:

```
GET /search?q=&page=&limit=

```

Searches:

- Users (email, display_name)
- Audio (title)

### Ranking Requirements:

- Must include a scoring or ranking logic (e.g., exact match > partial match)
- Pagination is mandatory. Cursor based pagination strategy.
- Return structure:

```json
{
  "users": {
	  "data": [...],
	  "meta": {
		  "next_cursor" : "cursor_id"
	  }
  },
  "audio": {
	  "data": [...]
	  "meta": {
		  "next_cursor" : "cursor_id"
	  }
	},
 }
```

---

## 6. **CRUD Endpoints (Paginated + Cached)**

Endpoints:

- `GET /users`
- `GET /users/:id`
- `PUT /users/:id` → Update minimal content
- `GET /audio`
- `GET /audio/:id`
- `PUT /audio/:id` → Update minimal content

### Requirements:

- Must be paginated
- Must be cached using Redis
- Cache TTL ~1 minute
- Cache invalidated automatically on update

---

## 7. **Generation Simulation (Cron + Worker + WebSockets)**

This is a **core  requirement**.

### Flow:

1. User submits a prompt: `POST /prompts`
    - Initialize status = `"PENDING"`
2. A cron process (or scheduler) periodically scans for:
    - `PENDING` prompts
        
        → enqueue them into a job queue
        
    - paid prompts get higher priority
3. A job worker processes each job:
    - Set status = `"PROCESSING"`
    - Simulate generation delay
    - Create an Audio entry
    - Set status = `"COMPLETED"`
4. **On completion**, the worker must:
    - Send a WebSocket event to the user

### Requirements:

- Cron (or scheduler) must be real (node-cron, custom interval, or NestJS Schedule)
- Job queue must be used (BullMQ, BeeQueue, custom)
- WebSocket notification must be implemented

---

## 8. **WebSockets**

Must support:

- User-specific or session-specific notification channel
- “Prompt completed” event emitted by job worker to user

---

# **Architecture Requirements**

You MUST implement **clean architecture**.

- Clear, strict boundaries between layers
- Dependency flow: interface → application → domain → infrastructure (DI)
- No leaking ORM models into controllers

---

# **Docker Requirements**

Project must run via:

```
docker-compose up

```

Include:

- API service
- Worker service (can be separate container)
- Postgres
- Redis

---

# **Documentation Requirements**

## 1. **Swagger (REQUIRED)**

You must include complete Swagger docs that cover:

- Request/response schemas
- Authentication requirements
- Pagination
- Error responses
- Subscription tiers
- Prompt simulation lifecycle

Swagger must be accessible at:

`/docs` or `/api/docs`

---

## 2. **README (REQUIRED)**

A complete README including:

### Sections Required:

- Summary of architecture
- How to run with Docker
- How to run locally
- Environment variables
- Authentication flow (with diagrams or text)
- Token rotation / invalidation strategy
- Job queue processing flow
- Cron scheduler explanation
- Cache strategy & invalidation rules
- Rate limit logic
- Unified search ranking logic
- Subscription perks logic

---

# **Optional (Bonus)**

If you want to impress us:

### ⭐ Unit tests or integration tests

### ⭐ Deployment to a real server

- Render
- Fly.io
- Railway
- EC2

### ⭐ CI pipeline (GitHub Actions)

### ⭐ Docker healthcheck + container restarts

None are required but highly valued.

---

# **Deliverables**

Submit a GitHub repository containing:

✔ Complete source code

✔ Docker Compose setup

✔ Swagger documentation

✔ README with all required sections

✔ Postman collection (optional)

✔ Live deployment link (optional)

---

# **Evaluation Criteria**

We evaluate on:

### **1. Architecture**

- Clean separation of layers
- Maintainability
- Modularity
- Dependency boundaries

### **2. Code Quality**

- Naming
- Structure
- Error handling
- Testability
- Security

### **3. Documentation**

- Completeness of README
- Quality and clarity of Swagger
- Accuracy of diagrams

### **4. Correctness**

- All features implemented
- Cron + queue + websocket flow works
- Pagination and caching implemented
- Search ranking implemented

### **5. Production Readiness**

- Docker & environment works out of the box
- Rate limiting
- Token refresh security
- Cache invalidation strategy
- Proper job queue design

### **6. Bonus Work**

- Tests
- CI/CD
- Deployment
- Observability