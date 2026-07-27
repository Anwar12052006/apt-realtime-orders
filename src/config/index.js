import 'dotenv/config';

const required = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

const config = {
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',

  db: {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  },

  kafka: {
    brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
    clientId: process.env.KAFKA_CLIENT_ID || 'realtime-orders-app',
    groupId: process.env.KAFKA_GROUP_ID || 'order-monitoring-group',
    topic: process.env.KAFKA_TOPIC || 'cdc.public.orders',
  },
};

export default config;
