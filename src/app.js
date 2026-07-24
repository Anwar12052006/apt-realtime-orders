import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import healthRouter from './routes/health.js';
import orderRouter from './routes/order.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ── Middleware ──────────────────────────────────────────────
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// ── Routes ─────────────────────────────────────────────────
app.use(healthRouter);
app.use('/api/orders', orderRouter);

// ── Error Handling ─────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

export default app;
