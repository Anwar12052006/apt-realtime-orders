# Real-Time Order Update System

A backend system that automatically pushes order changes to connected browser clients in real time using **PostgreSQL LISTEN/NOTIFY**, database triggers, and **Socket.IO** — without any polling.

---

## Problem Statement

Build a system where connected clients automatically receive updates whenever an `INSERT`, `UPDATE`, or `DELETE` happens on a PostgreSQL `orders` table.

**Key constraint:** Database changes must be detected even when SQL is executed **directly in PostgreSQL** (e.g., via `psql`, pgAdmin, or another application) — not only through the REST API.

---

## Architecture

```
┌─────────────────────────────┐
│   PostgreSQL orders table   │
│   (INSERT / UPDATE / DELETE)│
└──────────────┬──────────────┘
               │ AFTER trigger
               ▼
┌─────────────────────────────┐
│   notify_order_change()     │
│   PL/pgSQL trigger function │
└──────────────┬──────────────┘
               │ pg_notify('order_changes', JSON)
               ▼
┌─────────────────────────────┐
│   Node.js LISTEN connection │
│   (dedicated pg.Client)     │
└──────────────┬──────────────┘
               │ EventEmitter
               ▼
┌─────────────────────────────┐
│   Socket.IO server          │
│   io.emit('order-change')   │
└──────────────┬──────────────┘
               │ WebSocket
               ▼
┌─────────────────────────────┐
│   Connected browser clients │
└─────────────────────────────┘
```

**The critical insight:** Because the trigger fires at the database level, **any** SQL change — whether from the REST API, a DBA running queries, a migration script, or another microservice — generates a real-time notification. The Node.js application layer is never bypassed.

---

## Why PostgreSQL LISTEN/NOTIFY?

| Approach | Mechanism | Drawback |
|----------|-----------|----------|
| **Client polling** | Browser calls `GET /api/orders` every N seconds | Wastes bandwidth; adds latency equal to the polling interval; doesn't scale |
| **Server polling** | Node.js polls the DB for changes | Adds unnecessary load on PostgreSQL; still has latency |
| **Application-level events** | Emit Socket.IO events from REST controllers | Misses changes made directly in PostgreSQL |
| **LISTEN/NOTIFY** ✅ | PostgreSQL pushes events to subscribers | Zero polling; captures all changes at the source; sub-second latency |

LISTEN/NOTIFY is the right tool here because the assignment explicitly requires detecting **direct SQL changes** — something that application-level event emitting cannot achieve.

---

## Tech Stack

| Technology | Purpose |
|------------|---------|
| **Node.js** | Server runtime |
| **Express.js** | REST API framework |
| **PostgreSQL** | Database with LISTEN/NOTIFY support |
| **pg** | PostgreSQL client for Node.js |
| **Socket.IO** | Real-time WebSocket communication |
| **HTML/CSS/JS** | Minimal browser client |
| **dotenv** | Environment variable management |

---

## Project Structure

```
apt-realtime-orders/
├── src/
│   ├── config/
│   │   ├── index.js              # Environment variables & validation
│   │   └── database.js           # PostgreSQL connection pool
│   ├── controllers/
│   │   ├── health.js             # Health check handler
│   │   └── order.js              # Order CRUD handlers + validation
│   ├── routes/
│   │   ├── health.js             # GET /health
│   │   └── order.js              # /api/orders routes
│   ├── services/
│   │   ├── order.js              # SQL queries (parameterized)
│   │   └── databaseListener.js   # PostgreSQL LISTEN + reconnection
│   ├── sockets/
│   │   └── socketManager.js      # Socket.IO ↔ DB listener bridge
│   ├── app.js                    # Express app setup
│   └── server.js                 # HTTP server + graceful shutdown
├── database/
│   ├── schema.sql                # Table definition + seed data
│   └── triggers.sql              # Trigger function + pg_notify
├── public/
│   ├── index.html                # Client UI
│   ├── app.js                    # Socket.IO client logic
│   └── style.css                 # Styling
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

---

## Database Schema

```sql
CREATE TABLE IF NOT EXISTS orders (
  id            SERIAL PRIMARY KEY,
  customer_name VARCHAR(100)  NOT NULL,
  product_name  VARCHAR(150)  NOT NULL,
  status        VARCHAR(20)   NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'shipped', 'delivered')),
  updated_at    TIMESTAMP     NOT NULL DEFAULT NOW()
);
```

The `CHECK` constraint ensures only valid statuses are stored — enforced at the database level regardless of how the data is inserted.

---

## Installation

```bash
git clone <repository-url>
cd apt-realtime-orders
npm install
```

---

## Environment Variables

Copy the example file and fill in your PostgreSQL credentials:

```bash
cp .env.example .env
```

```env
PORT=3000
NODE_ENV=development

DB_HOST=localhost
DB_PORT=5432
DB_USER=your_pg_user
DB_PASSWORD=your_pg_password
DB_NAME=apt_realtime_orders
```

The application validates that all required database variables are present at startup and fails fast with a clear error if any are missing.

---

## Database Setup

```bash
# 1. Create the database
createdb apt_realtime_orders

# 2. Create the orders table and seed data
psql -U your_pg_user -d apt_realtime_orders -f database/schema.sql

# 3. Create the trigger function and trigger
psql -U your_pg_user -d apt_realtime_orders -f database/triggers.sql
```

Both SQL files are idempotent and can be safely re-run.

---

## Running the Application

```bash
# Production
npm start

# Development (auto-restart on file changes)
npm run dev
```

Expected startup output:

```
🚀 Server running on http://localhost:3000 [development]
📡 Listening on PostgreSQL channel "order_changes"
```

Open `http://localhost:3000` in your browser to view the real-time order monitor.

---

## REST API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/api/orders` | List all orders |
| `GET` | `/api/orders/:id` | Get a single order |
| `POST` | `/api/orders` | Create an order |
| `PATCH` | `/api/orders/:id` | Update an order |
| `DELETE` | `/api/orders/:id` | Delete an order |

### Create Order

```bash
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{"customer_name": "Anwar Raza", "product_name": "Laptop", "status": "pending"}'
```

### Update Order

```bash
curl -X PATCH http://localhost:3000/api/orders/1 \
  -H "Content-Type: application/json" \
  -d '{"status": "shipped"}'
```

### Delete Order

```bash
curl -X DELETE http://localhost:3000/api/orders/1
```

---

## Real-Time Event Format

All connected clients receive events via Socket.IO on the `order-change` channel:

### INSERT

```json
{
  "operation": "INSERT",
  "data": {
    "id": 6,
    "customer_name": "Anwar Raza",
    "product_name": "Laptop",
    "status": "pending",
    "updated_at": "2026-07-24T10:15:00.000000"
  }
}
```

### UPDATE

```json
{
  "operation": "UPDATE",
  "data": {
    "id": 1,
    "customer_name": "Alice Johnson",
    "product_name": "Mechanical Keyboard",
    "status": "shipped",
    "updated_at": "2026-07-24T10:20:00.000000"
  }
}
```

### DELETE

```json
{
  "operation": "DELETE",
  "data": {
    "id": 3,
    "customer_name": "Charlie Lee",
    "product_name": "27\" 4K Monitor",
    "status": "delivered",
    "updated_at": "2026-07-24T10:10:00.000000"
  }
}
```

---

## Testing Real-Time Updates

This is the most important test — proving that the system detects changes made **outside** the Node.js application.

### Setup

1. **Terminal 1:** Start the server — `npm run dev`
2. **Browser:** Open `http://localhost:3000` (open two tabs to verify broadcast)
3. **Terminal 2:** Connect directly to PostgreSQL — `psql -U your_pg_user -d apt_realtime_orders`

### Direct SQL Test

In Terminal 2, execute:

```sql
-- The browser will update instantly after each statement

-- 1. Insert a new order
INSERT INTO orders (customer_name, product_name, status)
VALUES ('Test User', 'Widget', 'pending');

-- 2. Update the status
UPDATE orders SET status = 'shipped', updated_at = NOW()
WHERE id = 1;

-- 3. Delete an order
DELETE FROM orders WHERE id = 1;
```

**Expected result:** Each SQL statement immediately appears in the browser — a new row is added, the status badge changes, or the row disappears. The server log shows:

```
📦 INSERT on order id=6
📦 UPDATE on order id=1
📦 DELETE on order id=1
```

**This works because** the PostgreSQL trigger fires on every row change regardless of the source. The `pg_notify()` call pushes the event to the Node.js LISTEN connection, which then broadcasts via Socket.IO. The REST API is never involved.

---

## Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Dedicated `pg.Client` for LISTEN** | `pg.Pool` recycles connections — a pooled connection would lose its `LISTEN` subscription when returned to the pool. A dedicated `Client` maintains a persistent connection. |
| **EventEmitter between DB listener and Socket.IO** | Decouples PostgreSQL-specific code from the WebSocket layer. The listener emits events; the socket layer subscribes. Neither knows about the other's internals. |
| **Triggers instead of application-level events** | The assignment requires detecting direct SQL changes. Emitting events from Express controllers would miss changes made via `psql` or other applications. |
| **`AFTER` trigger (not `BEFORE`)** | Ensures notifications are only sent for changes that actually committed — no false positives from rolled-back transactions. |
| **`http.createServer` instead of `app.listen`** | Both Express and Socket.IO share the same HTTP server. This is required for Socket.IO to intercept WebSocket upgrade requests. |
| **Parameterized queries with hardcoded column allowlist** | The dynamic `PATCH` query builds `SET` clauses from a whitelist of column names (`customer_name`, `product_name`, `status`). User input only flows through `$1, $2, …` parameters — never concatenated into SQL. |
| **Reconnection with exponential backoff** | If PostgreSQL restarts, the LISTEN connection automatically reconnects (1s → 2s → 4s → … → 30s max) instead of silently going dead. |
| **Graceful shutdown** | `SIGINT`/`SIGTERM` handlers close Socket.IO, the LISTEN client, the connection pool, and the HTTP server in order — no dangling connections. |

---

## Scalability

### Current Design (Single Instance)

```
1 LISTEN connection ──→ 1 Node.js process ──→ N WebSocket clients
```

This architecture handles **one application instance** efficiently. PostgreSQL maintains a single notification channel, and Socket.IO broadcasts to all connected clients through that instance.

### Horizontal Scaling Considerations

If the application needs to scale beyond a single Node.js process:

- **Socket.IO + Redis adapter:** Use `@socket.io/redis-adapter` to share WebSocket events across multiple Node.js instances. Each instance maintains its own LISTEN connection, and Redis ensures events reach all clients regardless of which instance they're connected to.

- **PostgreSQL LISTEN/NOTIFY limitations:** NOTIFY payloads are limited to ~8,000 bytes. For tables with very large rows, the payload would need to be reduced (e.g., send only the ID and operation, then fetch the full row on the client). LISTEN/NOTIFY is also in-memory and does not persist — if no listener is connected, notifications are lost.

- **For much larger architectures:** At high scale (thousands of events per second), a dedicated message broker like **RabbitMQ** or **Apache Kafka** would replace LISTEN/NOTIFY. PostgreSQL would publish to the broker via logical replication or Change Data Capture (CDC), and consumers would process events independently.

> **Note:** Redis, Kafka, and RabbitMQ are **not implemented** in this project. They are mentioned here as natural evolution paths for the architecture.

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Missing environment variables | Application fails fast at startup with a clear error message |
| PostgreSQL unreachable at startup | Server starts; DB listener logs error and retries with backoff |
| LISTEN connection drops | Automatic reconnection with exponential backoff (1s → 30s cap) |
| Malformed notification payload | Caught, logged, and skipped — server continues running |
| Invalid request body | Returns `400` with descriptive validation errors |
| Non-numeric order ID | Returns `400` `"Invalid order ID"` |
| Order not found | Returns `404` `"Order not found"` |
| Invalid status value (API) | Returns `400` with allowed values |
| Invalid status value (SQL) | Blocked by PostgreSQL `CHECK` constraint — no notification sent |
| Unhandled promise rejection | Caught by global handler, logged, process continues |
| `SIGINT` / `SIGTERM` | Graceful shutdown: Socket.IO → LISTEN client → pool → HTTP server |

---

## Limitations

- **No authentication or authorization** — all endpoints and WebSocket connections are open.
- **No pagination** on `GET /api/orders` — suitable for small datasets only.
- **Single-instance** — horizontal scaling would require a Socket.IO Redis adapter.
- **pg_notify payload limit** — PostgreSQL limits NOTIFY payloads to ~8KB. Very large rows may be truncated.
- **No message persistence** — if the LISTEN connection is down during a change, that notification is lost. A page refresh re-syncs via the REST API.

---

## Future Improvements

- [ ] Add JWT authentication for API and WebSocket connections
- [ ] Implement pagination and filtering on `GET /api/orders`
- [ ] Add Socket.IO Redis adapter for multi-instance deployment
- [ ] Add request rate limiting
- [ ] Add structured logging (e.g., pino)
- [ ] Write automated integration tests
- [ ] Add order history / audit trail table
- [ ] Containerize with Docker and docker-compose

---

## Screenshots

> Screenshots can be added here after running the application locally. Open `http://localhost:3000`, perform some SQL operations, and capture the real-time updates appearing in the browser.
