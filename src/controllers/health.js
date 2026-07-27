import pool from '../config/database.js';
import cdcConsumer from '../services/cdcConsumer.js';

// ── GET /health (Liveness Probe) ──────────────────────────────
export const getHealth = (_req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
};

// ── GET /ready (Readiness Probe) ──────────────────────────────
export const getReadiness = async (_req, res) => {
  let dbStatus = 'disconnected';
  let isDbReady = false;

  try {
    // Quick ping query to verify DB pool connectivity
    await pool.query('SELECT 1');
    dbStatus = 'connected';
    isDbReady = true;
  } catch (err) {
    dbStatus = 'error';
    console.error('Readiness check database failure:', err.message);
  }

  const cdcState = cdcConsumer.getStatus();
  const isHealthy = isDbReady && cdcState.connected;

  const statusCode = isHealthy ? 200 : 503;

  res.status(statusCode).json({
    status: isHealthy ? 'up' : 'down',
    services: {
      database: dbStatus,
      cdcConsumer: cdcState.status,
    },
    timestamp: new Date().toISOString(),
  });
};
