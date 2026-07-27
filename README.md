# Real-Time Order Monitoring System (PostgreSQL WAL + Debezium CDC + Kafka)

A production-oriented backend application that automatically streams PostgreSQL order changes to connected browser clients in real time using **PostgreSQL Write-Ahead Logging (WAL)**, **Debezium Change Data Capture (CDC)**, **Apache Kafka**, and **Socket.IO** — without polling or database triggers.

---

## 1. Problem Statement

Modern real-time applications require instant feedback when database rows are created, updated, or deleted. 

**Key Constraint:** Database mutations must be detected and broadcast in real time **even when SQL is executed directly in PostgreSQL** (e.g. via `psql`, pgAdmin, background jobs, or third-party services) — not just through Express REST endpoints.

The architecture solves this by capturing changes directly from PostgreSQL's engine log (WAL) using Debezium CDC and streaming them through Kafka to Socket.IO.

---

## 2. Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│              PostgreSQL Database (`orders`)             │
│        (Direct SQL / psql / REST API Mutations)         │
└────────────────────────────┬────────────────────────────┘
                             │ Write-Ahead Log (WAL)
                             ▼
┌─────────────────────────────────────────────────────────┐
│        PostgreSQL Logical Decoding (`pgoutput`)         │
└────────────────────────────┬────────────────────────────┘
                             │ Replication Stream
                             ▼
┌─────────────────────────────────────────────────────────┐
│           Debezium PostgreSQL Connector                 │
│                 (Kafka Connect)                         │
└────────────────────────────┬────────────────────────────┘
                             │ CDC JSON Events
                             ▼
┌─────────────────────────────────────────────────────────┐
│            Kafka Broker (`cdc.public.orders`)           │
└────────────────────────────┬────────────────────────────┘
                             │ Consumer Group
                             ▼
┌─────────────────────────────────────────────────────────┐
│          Node.js CDC Consumer (`cdcConsumer.js`)        │
└────────────────────────────┬────────────────────────────┘
                             │ Internal EventEmitter (`order_change`)
                             ▼
┌─────────────────────────────────────────────────────────┐
│          Socket.IO Bridge (`socketManager.js`)          │
└────────────────────────────┬────────────────────────────┘
                             │ WebSocket (`order-change`)
                             ▼
┌─────────────────────────────────────────────────────────┐
│             Connected Web Clients (Browser UI)          │
└─────────────────────────────────────────────────────────┘
```

---

## 3. What is Write-Ahead Logging (WAL)?

The **Write-Ahead Log (WAL)** is PostgreSQL's internal, append-only log of all transactional modifications. Before any table row is updated or committed on disk, the change is written sequentially to the WAL. 

In CDC architectures with `wal_level=logical`, PostgreSQL streams these WAL log entries to logical replication clients using the `pgoutput` plugin.

---

## 4. What is Change Data Capture (CDC)?

**Change Data Capture (CDC)** is a software pattern that observes, captures, and streams database row-level changes (`INSERT`, `UPDATE`, `DELETE`) in real time to external systems. Instead of querying tables periodically, CDC converts database transactions into an event stream.

---

## 5. What Does Debezium Do?

[Debezium](https://debezium.io/) is an open-source, distributed Change Data Capture platform. 

In this application:
1. Debezium connects to PostgreSQL's logical replication slot (`orders_cdc_slot`).
2. It reads raw WAL change streams via the `pgoutput` plugin.
3. It parses binary WAL records into structured JSON change envelopes (`op: "c"|"u"|"d"|"r"`).
4. It publishes these change envelopes to Kafka topic `cdc.public.orders`.

---

## 6. Why Debezium Instead of Polling?

| Feature | Client/Server Polling | Debezium CDC |
| :--- | :--- | :--- |
| **Database Impact** | High query load (`SELECT ... WHERE updated_at > ?`) | Zero query load; reads append-only WAL stream |
| **Latency** | Polling interval (e.g. 5–30 seconds) | Sub-second real-time streaming |
| **Missed Deletes** | Hard to detect without soft-delete columns | Instantly captures `DELETE` operations |
| **Scalability** | Degrades exponentially with concurrent users | Highly scalable via Kafka partitions |

---

## 7. Why Debezium Instead of Application-Level Events?

Emitting Socket.IO events inside Express REST controllers (e.g. `res.json(); io.emit(...)`) fails whenever database changes happen outside the Express controller — such as manual `psql` queries, background workers, or external microservices.

Debezium captures database mutations **at the storage engine level**, guaranteeing 100% event capture regardless of where the SQL query originated.

---

## 8. Difference from PostgreSQL LISTEN/NOTIFY

| Metric / Capability | PostgreSQL LISTEN/NOTIFY | Debezium CDC + Kafka |
| :--- | :--- | :--- |
| **Mechanism** | Synchronous PL/pgSQL triggers (`pg_notify`) | Asynchronous WAL log tailing (`pgoutput`) |
| **Database Overhead** | Triggers execute inside caller transactions | Zero trigger overhead on SQL execution |
| **Payload Limit** | Hard limit of 8,000 bytes per notification | Unbounded Kafka payload capacity |
| **Persistence** | In-memory only (lost if listener is offline) | Persisted in Kafka topics & WAL slots |
| **Replay & Catch-up** | Impossible (no event history) | Supported via Kafka offsets & replication slots |

---

## 9. Tech Stack

- **Node.js**: Asynchronous server runtime.
- **Express.js**: HTTP server & REST API framework.
- **PostgreSQL 16**: Relational database with logical replication (`wal_level=logical`).
- **Debezium Connect 2.6**: CDC connector framework reading PostgreSQL WAL.
- **Apache Kafka 7.6 (KRaft)**: Event broker for CDC streams.
- **KafkaJS**: Node.js client for Kafka consumption.
- **Socket.IO**: Real-time WebSocket server.
- **HTML5 / Vanilla CSS & JS**: Browser frontend monitor.

---

## 10. Project Structure

```
apt-realtime-orders/
├── database/
│   ├── schema.sql                   # Schema definition & REPLICA IDENTITY FULL
│   └── cleanup_triggers.sql         # Legacy trigger cleanup migration
├── debezium/
│   └── postgres-connector.json      # Declarative Debezium connector config
├── public/
│   ├── index.html                   # Dashboard UI
│   ├── app.js                       # Socket.IO client logic
│   └── style.css                    # UI styles
├── scripts/
│   └── register-connector.sh        # Automated connector registration script
├── src/
│   ├── config/
│   │   ├── database.js              # PostgreSQL pool
│   │   └── index.js                 # App configuration
│   ├── controllers/
│   │   ├── health.js                # Liveness & readiness handlers
│   │   └── order.js                 # Order REST controllers
│   ├── routes/
│   │   ├── health.js                # GET /health & GET /ready
│   │   └── order.js                 # REST routes
│   ├── services/
│   │   ├── cdcConsumer.js           # KafkaJS CDC event consumer
│   │   └── order.js                 # Database queries
│   ├── sockets/
│   │   └── socketManager.js         # Socket.IO ↔ CDC consumer bridge
│   ├── app.js                       # Express app configuration
│   └── server.js                    # HTTP server & graceful shutdown
├── Dockerfile                       # Pinned Node.js multi-stage build
├── docker-compose.yml               # Multi-container orchestration
├── .env.example                     # Environment template
├── package.json
└── README.md
```

---

## 11. Environment Variables

Create `.env` from `.env.example`:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# PostgreSQL Configuration
DB_HOST=postgres
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=apt_realtime_orders

# Kafka Configuration
KAFKA_BROKERS=kafka:9092
KAFKA_CLIENT_ID=realtime-orders-app
KAFKA_GROUP_ID=order-monitoring-group
KAFKA_TOPIC=cdc.public.orders

# Debezium Connect Configuration
DEBEZIUM_CONNECT_URL=http://debezium:8083
```

---

## 12. Docker Setup

The architecture is containerized using `docker-compose.yml`:

- **`postgres`**: PostgreSQL 16 with `wal_level=logical`.
- **`kafka`**: Apache Kafka 7.6 operating in KRaft mode.
- **`debezium`**: Debezium Connect 2.6 engine.
- **`debezium-init`**: One-off container that registers the PostgreSQL CDC connector.
- **`app`**: Node.js Express server + Socket.IO + Kafka CDC Consumer.

---

## 13. Debezium Connector Registration

Connector configuration (`debezium/postgres-connector.json`):

```json
{
  "name": "orders-cdc-connector",
  "config": {
    "connector.class": "io.debezium.connector.postgresql.PostgresConnector",
    "tasks.max": "1",
    "plugin.name": "pgoutput",
    "database.hostname": "postgres",
    "database.port": "5432",
    "database.user": "postgres",
    "database.password": "postgres",
    "database.dbname": "apt_realtime_orders",
    "topic.prefix": "cdc",
    "schema.include.list": "public",
    "table.include.list": "public.orders",
    "slot.name": "orders_cdc_slot",
    "publication.name": "orders_cdc_publication",
    "publication.autocreate.mode": "filtered",
    "snapshot.mode": "initial",
    "tombstones.on.delete": "false",
    "slot.drop.on.stop": "false"
  }
}
```

Registration script (`scripts/register-connector.sh`):

```bash
sh scripts/register-connector.sh
```

---

## 14. Running the Application

### Option A: Complete Docker Compose Stack (Recommended)

```bash
# Build and start all services in detached mode
docker compose up --build -d

# Check status of containers
docker compose ps

# View application logs
docker compose logs -f app
```

Open `http://localhost:3000` in your web browser.

### Option B: Local Node.js Development (Connecting to Docker Services)

```bash
# 1. Start infrastructure services (PostgreSQL, Kafka, Debezium)
docker compose up -d postgres kafka debezium debezium-init

# 2. Update .env for local host connections
DB_HOST=localhost
KAFKA_BROKERS=localhost:9092

# 3. Start Node.js application locally
npm run dev
```

---

## 15. REST API Endpoints

| Method | Path | Description |
| :--- | :--- | :--- |
| `GET` | `/health` | Liveness probe (HTTP 200) |
| `GET` | `/ready` | Readiness probe (Checks PostgreSQL & CDC Consumer status) |
| `GET` | `/api/orders` | Fetch all orders |
| `GET` | `/api/orders/:id` | Fetch order by ID |
| `POST` | `/api/orders` | Create a new order |
| `PATCH` | `/api/orders/:id` | Update order fields |
| `DELETE` | `/api/orders/:id` | Delete an order |

---

## 16. Real-Time Event Format

Connected Socket.IO clients receive normalized events on the `order-change` topic:

```json
{
  "operation": "INSERT" | "UPDATE" | "DELETE",
  "data": {
    "id": 1,
    "customer_name": "Alice Johnson",
    "product_name": "Mechanical Keyboard",
    "status": "shipped",
    "updated_at": "2026-07-27T18:00:00.000Z"
  }
}
```

---

## 17. Direct PostgreSQL INSERT / UPDATE / DELETE Testing

Test that direct database operations bypass the REST API and stream to web browsers:

```bash
# 1. Connect directly to PostgreSQL container
docker compose exec postgres psql -U postgres -d apt_realtime_orders
```

Run SQL queries:

```sql
-- 1. INSERT test
INSERT INTO orders (customer_name, product_name, status) 
VALUES ('Direct SQL User', 'Mechanical Keyboard', 'pending');

-- 2. UPDATE test
UPDATE orders 
SET status = 'shipped', updated_at = NOW() 
WHERE customer_name = 'Direct SQL User';

-- 3. DELETE test
DELETE FROM orders 
WHERE customer_name = 'Direct SQL User';
```

Observe browser UI at `http://localhost:3000` updating instantly in real time!

---

## 18. How to Verify Kafka / Debezium Events

### Verify Debezium Connector Status

```bash
curl -s http://localhost:8083/connectors/orders-cdc-connector/status | jq .
```

### Consume Raw CDC Messages from Kafka Topic

```bash
docker compose exec kafka kafka-console-consumer \
  --bootstrap-server localhost:9092 \
  --topic cdc.public.orders \
  --from-beginning
```

---

## 19. Graceful Shutdown

The application intercepts `SIGINT` and `SIGTERM` signals and executes shutdown procedures in order:

1. Close Socket.IO server connections (`io.close()`).
2. Disconnect Kafka CDC Consumer (`cdcConsumer.stop()`).
3. Drain and terminate PostgreSQL connection pool (`pool.end()`).
4. Close HTTP server socket (`server.close()`).

---

## 20. Failure & Recovery Behavior

- **PostgreSQL Crash**: `pg.Pool` automatically retries connection acquisition. Debezium resumes from its last confirmed LSN once PostgreSQL recovers.
- **Kafka Broker Outage**: `KafkaJS` consumer retries connection using exponential backoff without crashing the application process.
- **Debezium Container Restart**: The replication slot (`orders_cdc_slot`) persists in PostgreSQL (`slot.drop.on.stop: false`). Debezium reconnects and streams unacknowledged WAL segments without message loss.

---

## 21. Known Production Considerations

1. **Replication Slot WAL Retention**: If Debezium remains offline for days, PostgreSQL retains WAL files on disk for `orders_cdc_slot`. Set `max_slot_wal_keep_size` in PostgreSQL configuration to prevent disk exhaustion.
2. **Horizontal Scaling**: Multiple instances of `app` sharing `KAFKA_GROUP_ID=order-monitoring-group` will load-balance Kafka topic partitions automatically. A Socket.IO Redis adapter can be added to route events across multi-node socket servers.
3. **Partition Ordering**: Events for each order are partitioned by `orders.id` (primary key), guaranteeing total in-order delivery per order.
