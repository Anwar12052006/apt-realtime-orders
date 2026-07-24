import pg from 'pg';
import { EventEmitter } from 'node:events';
import config from '../config/index.js';

const CHANNEL = 'order_changes';
const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30000;

class DatabaseListener extends EventEmitter {
  constructor() {
    super();
    this.client = null;
    this.shouldReconnect = true;
    this.reconnectAttempts = 0;
  }

  async start() {
    this.shouldReconnect = true;
    await this._connect();
  }

  async _connect() {
    this.client = new pg.Client({
      host: config.db.host,
      port: config.db.port,
      user: config.db.user,
      password: config.db.password,
      database: config.db.database,
    });

    this.client.on('error', (err) => {
      console.error('Database listener connection error:', err.message);
      this._reconnect();
    });

    await this.client.connect();
    await this.client.query(`LISTEN ${CHANNEL}`);
    this.reconnectAttempts = 0;
    console.log(`📡 Listening on PostgreSQL channel "${CHANNEL}"`);

    this.client.on('notification', (msg) => {
      try {
        const payload = JSON.parse(msg.payload);
        console.log(`📦 ${payload.operation} on order id=${payload.data?.id}`);
        this.emit('order_change', payload);
      } catch {
        console.error('Malformed notification payload:', msg.payload);
      }
    });
  }

  _reconnect() {
    if (!this.shouldReconnect) return;

    const delay = Math.min(
      RECONNECT_BASE_MS * 2 ** this.reconnectAttempts,
      RECONNECT_MAX_MS
    );
    this.reconnectAttempts++;

    console.log(`🔄 Reconnecting database listener in ${delay}ms (attempt ${this.reconnectAttempts})…`);

    setTimeout(async () => {
      try {
        await this._connect();
      } catch (err) {
        console.error('Database listener reconnect failed:', err.message);
        this._reconnect();
      }
    }, delay);
  }

  async stop() {
    this.shouldReconnect = false;
    if (this.client) {
      try {
        await this.client.end();
      } catch { /* already closed */ }
      this.client = null;
    }
  }
}

const dbListener = new DatabaseListener();
export default dbListener;

