import { Kafka, logLevel } from 'kafkajs';
import { EventEmitter } from 'node:events';
import config from '../config/index.js';

class CDCConsumer extends EventEmitter {
  constructor() {
    super();
    this.kafka = null;
    this.consumer = null;
    this.isRunning = false;
    this.isConnecting = false;
  }

  async start() {
    if (this.isRunning || this.isConnecting) {
      console.log('⚠️ CDC Consumer is already running or connecting.');
      return;
    }

    this.isConnecting = true;

    try {
      this.kafka = new Kafka({
        clientId: config.kafka.clientId,
        brokers: config.kafka.brokers,
        logLevel: logLevel.ERROR,
        retry: {
          initialRetryTime: 1000,
          retries: 10,
        },
      });

      this.consumer = this.kafka.consumer({
        groupId: config.kafka.groupId,
        allowAutoTopicCreation: true,
      });

      this.consumer.on(this.consumer.events.CRASH, (e) => {
        console.error('❌ CDC Consumer crashed:', e.payload.error?.message || e);
      });

      console.log(`🔌 Connecting to Kafka broker(s): ${config.kafka.brokers.join(', ')}...`);
      await this.consumer.connect();

      console.log(`🎯 Subscribing to Kafka CDC topic: "${config.kafka.topic}"...`);
      await this.consumer.subscribe({
        topic: config.kafka.topic,
        fromBeginning: false,
      });

      this.isRunning = true;
      this.isConnecting = false;
      console.log('✅ CDC Consumer connected and listening for database changes.');

      await this.consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          this._handleMessage(topic, partition, message);
        },
      });
    } catch (err) {
      this.isConnecting = false;
      this.isRunning = false;
      console.error('❌ Failed to start CDC Consumer:', err.message);
      throw err;
    }
  }

  _handleMessage(topic, partition, message) {
    // 1. Handle tombstone / empty records
    if (!message || message.value === null || message.value === undefined) {
      console.log(`ℹ️ Received tombstone/null message on partition ${partition}`);
      return;
    }

    try {
      const rawText = message.value.toString();
      const event = JSON.parse(rawText);

      // Debezium payload structure support (with or without schema wrapper)
      const payload = event.payload || event;

      if (!payload || typeof payload !== 'object') {
        console.warn('⚠️ Received non-object CDC payload, skipping.');
        return;
      }

      const { op, before, after } = payload;

      if (!op) {
        // Not a standard Debezium change event (e.g. metadata or heartbeat)
        return;
      }

      // 2. Handle snapshot operation ('r' = read) deliberately
      if (op === 'r') {
        const row = after || before;
        console.log(`📸 Initial snapshot event received for order id=${row?.id} (skipping live broadcast)`);
        return;
      }

      // 3. Map Debezium operation code to application operation contract
      let operation;
      if (op === 'c') operation = 'INSERT';
      else if (op === 'u') operation = 'UPDATE';
      else if (op === 'd') operation = 'DELETE';
      else {
        console.warn(`⚠️ Unknown Debezium operation code "${op}", skipping.`);
        return;
      }

      // 4. Extract row data (after for insert/update, before for delete)
      const rawRow = operation === 'DELETE' ? before : after;

      if (!rawRow) {
        console.warn(`⚠️ Missing row data for operation ${operation}, skipping.`);
        return;
      }

      // 5. Normalize payload into existing frontend contract
      const normalizedPayload = {
        operation,
        data: {
          id: rawRow.id,
          customer_name: rawRow.customer_name,
          product_name: rawRow.product_name,
          status: rawRow.status,
          updated_at: rawRow.updated_at
            ? new Date(rawRow.updated_at).toISOString()
            : new Date().toISOString(),
        },
      };

      console.log(`📦 CDC Event: ${normalizedPayload.operation} on order id=${normalizedPayload.data.id}`);

      // 6. Emit internal decoupled event for socketManager
      this.emit('order_change', normalizedPayload);
    } catch (err) {
      // 7. Safeguard: Do not crash the process on a single malformed message
      console.error('❌ Error processing CDC message:', err.message);
    }
  }

  async stop() {
    if (!this.isRunning && !this.isConnecting) return;

    console.log('🛑 Stopping CDC Consumer...');
    this.isRunning = false;
    this.isConnecting = false;

    if (this.consumer) {
      try {
        await this.consumer.disconnect();
        console.log('👋 CDC Consumer disconnected from Kafka.');
      } catch (err) {
        console.error('Error disconnecting CDC Consumer:', err.message);
      }
      this.consumer = null;
    }
  }

  getStatus() {
    return {
      connected: this.isRunning,
      status: this.isRunning ? 'running' : (this.isConnecting ? 'connecting' : 'stopped'),
    };
  }
}

const cdcConsumer = new CDCConsumer();
export default cdcConsumer;
