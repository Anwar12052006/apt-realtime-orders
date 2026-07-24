import { Server } from 'socket.io';
import dbListener from '../services/databaseListener.js';

const initSocket = (httpServer) => {
  const io = new Server(httpServer);

  io.on('connection', (socket) => {
    console.log(`🟢 Client connected: ${socket.id}`);

    socket.on('disconnect', () => {
      console.log(`🔴 Client disconnected: ${socket.id}`);
    });
  });

  // Bridge: one DB listener → all connected clients
  dbListener.on('order_change', (payload) => {
    io.emit('order-change', payload);
  });

  return io;
};

export default initSocket;
