import { Server } from 'socket.io';
import cdcConsumer from '../services/cdcConsumer.js';

let isListenerRegistered = false;

const initSocket = (httpServer) => {
  const io = new Server(httpServer);

  io.on('connection', (socket) => {
    console.log(`🟢 Client connected: ${socket.id}`);

    socket.on('disconnect', () => {
      console.log(`🔴 Client disconnected: ${socket.id}`);
    });
  });

  // Bridge: decoupled internal CDC consumer event -> Socket.IO 'order-change' broadcast
  if (!isListenerRegistered) {
    cdcConsumer.on('order_change', (payload) => {
      io.emit('order-change', payload);
    });
    isListenerRegistered = true;
  }

  return io;
};

export default initSocket;
