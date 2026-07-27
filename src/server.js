import http from 'node:http';
import app from './app.js';
import config from './config/index.js';
import initSocket from './sockets/socketManager.js';
import cdcConsumer from './services/cdcConsumer.js';
import pool from './config/database.js';

// 1. Express application initialized via import app
// 2. Create HTTP server
const server = http.createServer(app);

// 3. Initialize Socket.IO server
const io = initSocket(server);

// 4. Start HTTP server
server.listen(config.port, async () => {
  console.log(`🚀 Server running on port ${config.port} [${config.nodeEnv}]`);

  // 5. Start CDC Consumer safely
  try {
    await cdcConsumer.start();
  } catch (err) {
    console.error('⚠️ CDC Consumer initial connection failed (retries handled by Kafka client):', err.message);
  }
});

// ── Graceful Shutdown ──────────────────────────────────────

let isShuttingDown = false;

const shutdown = async (signal) => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`\n${signal} received. Shutting down gracefully…`);

  try {
    // 1. Close Socket.IO connections
    io.close();
    console.log('🔴 Socket.IO server closed.');

    // 2. Disconnect CDC / Kafka Consumer
    await cdcConsumer.stop();

    // 3. Close PostgreSQL connection pool
    await pool.end();
    console.log('📦 PostgreSQL database pool closed.');

    // 4. Close HTTP server
    server.close(() => {
      console.log('👋 HTTP server closed.');
      process.exit(0);
    });
  } catch (err) {
    console.error('❌ Error during graceful shutdown:', err.message);
    process.exit(1);
  }
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// ── Safety Net ─────────────────────────────────────────────

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
});