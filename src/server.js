import http from 'node:http';
import app from './app.js';
import config from './config/index.js';
import initSocket from './sockets/socketManager.js';
import dbListener from './services/databaseListener.js';
import pool from './config/database.js';

const server = http.createServer(app);

const io = initSocket(server);

server.listen(config.port, async () => {
  console.log(`🚀 Server running on http://localhost:${config.port} [${config.nodeEnv}]`);

  try {
    await dbListener.start();
  } catch (err) {
    console.error('Failed to start database listener:', err.message);
  }
});

// ── Graceful Shutdown ──────────────────────────────────────

const shutdown = async (signal) => {
  console.log(`\n${signal} received. Shutting down gracefully…`);

  io.close();
  await dbListener.stop();
  await pool.end();

  server.close(() => {
    console.log('👋 Server closed.');
    process.exit(0);
  });
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// ── Safety Net ─────────────────────────────────────────────

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
});
