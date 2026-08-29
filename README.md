# Email Scheduler

A production-grade bulk email scheduling system built for the ReachInbox assignment.

Schedule emails to hundreds of recipients, track delivery in real time, enforce per-user hourly rate limits, get Slack notifications when limits are hit, and monitor everything through a live BullMQ dashboard.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + Tailwind CSS v4 |
| Backend | Node.js + Express + TypeScript |
| Queue | BullMQ + Redis |
| Database | PostgreSQL + Prisma ORM |
| Search | Elasticsearch 8 |
| Auth | Google OAuth 2.0 + JWT |
| SMTP | Nodemailer + Ethereal (test) |
| Notifications | Slack OAuth + Web API |
| Dashboard | Bull-board |
| Infrastructure | Docker + Docker Compose |

---

## Architecture

```
Browser
  │
  ├─► React (Vite) :5173
  │         │
  │         └─► Express API :4000
  │                   │
  │          ┌────────┼────────┐
  │          ▼        ▼        ▼
  │       Postgres  Redis   Elasticsearch
  │       (data)   (queue)  (search)
  │                  │
  │             BullMQ Worker
  │             (separate process)
  │                  │
  │              Nodemailer
  │              (Ethereal SMTP)
  │                  │
  │           Slack Web API
  │           (rate-limit notify)
  │
  └─► Bull-board :4000/admin/queues
```

---

## Email Scheduling Flow

```
POST /api/emails/schedule
  │
  ├─ Validate recipients / startTime / delayMs
  ├─ Generate campaignId (UUID)
  │
  └─ For each recipient:
       ├─ prisma.email.create  { status: SCHEDULED }
       ├─ emailQueue.add       { delay: startTime + i*delayMs - now }
       └─ prisma.email.update  { jobId }

BullMQ Worker (fires at scheduled time)
  │
  ├─ Fetch email record
  ├─ Idempotency guard  (SENT/FAILED → skip)
  ├─ Hourly rate limit  (Redis Lua atomic INCR)
  │     └─ If exceeded:
  │           ├─ sendSlackNotification  (DM to user)
  │           ├─ Re-queue with delay = resetAt + 1s
  │           └─ Return cleanly (no failure)
  ├─ Optimistic claim   SCHEDULED → PROCESSING  (compare-and-swap)
  ├─ sendMail           (Nodemailer / Ethereal)
  ├─ Status → SENT      + indexEmail to Elasticsearch
  └─ On error → re-throw → BullMQ exponential backoff → FAILED after N attempts
```

---

## Restart / Idempotency

- **BullMQ delayed jobs live in Redis** — survive backend restarts
- **Deterministic jobId** (`email-<uuid>`) — prevents duplicate jobs on restart
- **`recoverStuckEmails()`** — resets any PROCESSING emails from a crashed worker back to SCHEDULED on startup
- **Optimistic claim** — `updateMany WHERE status=SCHEDULED` acts as a DB-level mutex; only one worker wins

---

## Rate Limiting

Uses an atomic Lua script in Redis:

```lua
local current = redis.call("INCR", KEYS[1])   -- email_rate:<user>:<YYYY-MM-DD-HH>
if current == 1 then
  redis.call("EXPIRE", KEYS[1], 3600)
end
return current
```

- Atomic across all worker instances — no race condition possible
- Key expires at the top of the next UTC hour
- Rate-limited emails are **rescheduled** (not failed) to fire after the reset

---

## Quick Start — Local Dev

### Prerequisites
- Node.js 18+
- Docker Desktop (for Postgres + Redis)

### 1. Clone and install

```bash
git clone https://github.com/Vasist10/email-scheduler-.git
cd email-scheduler-

# Backend
cd Backend && npm install

# Frontend
cd ../frontend && npm install
```

### 2. Start infrastructure

```bash
# Postgres
docker run -d --name email-pg \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=email_scheduler \
  -p 5432:5432 postgres:16-alpine

# Redis
docker run -d --name email-redis \
  -p 6379:6379 redis:7-alpine
```

### 3. Configure environment

```bash
cd Backend
cp .env.example .env
```

Edit `Backend/.env` — fill in these required values:

| Variable | Where to get it |
|---|---|
| `GOOGLE_CLIENT_ID` | [console.cloud.google.com](https://console.cloud.google.com/apis/credentials) |
| `GOOGLE_CLIENT_SECRET` | Same |
| `JWT_SECRET` | Any long random string |
| `ETHEREAL_USER` | [ethereal.email](https://ethereal.email) → Create Account |
| `ETHEREAL_PASS` | Same |
| `SLACK_CLIENT_ID` | [api.slack.com/apps](https://api.slack.com/apps) |
| `SLACK_CLIENT_SECRET` | Same |

### 4. Run migrations

```bash
cd Backend
npx prisma migrate deploy
```

### 5. Start all three processes (3 terminals)

```bash
# Terminal 1 — API server
cd Backend
npm run dev

# Terminal 2 — Email worker
cd Backend
npm run worker

# Terminal 3 — Frontend
cd frontend
npm run dev
```

### 6. Open the app

| URL | What |
|---|---|
| http://localhost:5173 | Frontend |
| http://localhost:4000 | Backend API |
| http://localhost:4000/admin/queues | Bull-board (admin / admin123) |

---

## Quick Start — Docker (full stack)

```bash
# 1. Configure
cp Backend/.env.example Backend/.env
# Edit Backend/.env — set DATABASE_URL host to "postgres", fill in secrets

# 2. Start all 6 services
docker compose up -d

# 3. Run migrations (once, after first start)
docker compose exec backend npm run migrate

# 4. Open
# Frontend:  http://localhost
# API:       http://localhost:4000
# Bull-board: http://localhost:4000/admin/queues
```

### Docker service hostnames

When using Docker Compose, update these in `.env`:

```env
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/email_scheduler
REDIS_HOST=redis
ELASTICSEARCH_URL=http://elasticsearch:9200
FRONTEND_URL=http://localhost
```

---

## Environment Variables

```env
# Server
PORT=4000

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/email_scheduler

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Elasticsearch (optional — search degrades gracefully if unreachable)
ELASTICSEARCH_URL=http://localhost:9200

# Google OAuth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALLBACK_URL=http://localhost:4000/auth/google/callback

# JWT
JWT_SECRET=change-this-to-a-long-random-string

# Frontend (CORS + OAuth redirect)
FRONTEND_URL=http://localhost:5173

# Ethereal SMTP (https://ethereal.email)
ETHEREAL_USER=...
ETHEREAL_PASS=...

# Worker tuning
MAX_EMAILS_PER_HOUR=20
MIN_DELAY_BETWEEN_EMAILS_MS=2000
WORKER_CONCURRENCY=5
WORKER_MAX_ATTEMPTS=3
WORKER_BACKOFF_MS=5000

# Bull-board auth
ADMIN_USER=admin
ADMIN_PASSWORD=admin123

# Slack OAuth (https://api.slack.com/apps)
# Required scopes: chat:write  im:write  users:read
SLACK_CLIENT_ID=...
SLACK_CLIENT_SECRET=...
SLACK_CALLBACK_URL=http://localhost:4000/auth/slack/callback
```

---

## Features

- **Google OAuth** — one-click sign in, JWT stored client-side
- **Bulk scheduling** — CSV upload or manual entry, per-recipient BullMQ delayed jobs
- **Hourly rate limiting** — atomic Redis counter, rescheduled not failed
- **Slack notifications** — DM when hourly limit is hit
- **Retry with backoff** — exponential, configurable attempts
- **Elasticsearch search** — full-text search over sent emails
- **Bull-board** — live queue dashboard at `/admin/queues`
- **Restart recovery** — stuck PROCESSING emails auto-reset on startup
- **Docker** — full stack in one `docker compose up -d`

---

## Trade-offs

| Decision | Reason |
|---|---|
| Ethereal SMTP (not real email) | Safe for testing — no accidental spam |
| Rate limit counter can overshoot by ±1 | Accepted inaccuracy to keep Lua script simple |
| Small window between DB create and job create | Documented known trade-off — recovery via `recoverStuckEmails` |
| Elasticsearch is optional | Server starts without it; search returns 503 until ES is available |
