import { createServer } from 'node:http';
import { createApp } from './app.js';
import { config } from './config.js';
import { createSocketServer } from './realtime/socketServer.js';

const app = createApp();
const httpServer = createServer(app);

// Initialize Socket.IO
const io = createSocketServer(httpServer);

// Store io instance globally for access from services
// In production, use dependency injection or a service locator pattern
(global as any).io = io;

httpServer.listen(config.port, () => {
  console.log(`🚀 Server listening on port ${config.port}`);
  console.log(`📋 Health check: http://localhost:${config.port}/health`);
  console.log(`🔌 Socket.IO: ws://localhost:${config.port}/socket.io/`);
  console.log(`🔧 Environment: ${config.env}`);
});

// Graceful shutdown
const shutdown = (signal: string) => {
  console.log(`\n${signal} received, shutting down gracefully...`);
  
  // Close Socket.IO connections
  io.close(() => {
    console.log('Socket.IO closed');
    
    // Close HTTP server
    httpServer.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
