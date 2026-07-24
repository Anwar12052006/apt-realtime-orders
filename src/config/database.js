import pg from 'pg';
import config from './index.js';

const pool = new pg.Pool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle database client:', err.message);
});

export default pool;
