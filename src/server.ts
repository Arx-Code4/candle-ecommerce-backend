import { Server } from 'http';
import app from './app.js';
import { env } from './config/env.js';
import { prisma } from './config/db.js';
import logger from './utils/logger.js';

let server: Server;

/**
 * 🛡️ Handles Graceful Shutdown of the application stack
 * Prevents requests from cutting mid-flight during scaling or deployments
 */
const handleShutdown = async (signal: string) => {
  logger.warn(`Received ${signal}. Starting orderly, graceful shutdown pipeline...`);

  if (server) {
    // 1. Tell the HTTP server to stop accepting new client traffic
    server.close(async (err) => {
      if (err) {
        logger.error(err, 'Error occurred while closing the HTTP server connection pool');
        process.exit(1);
      }

      logger.info('HTTP server has closed all active connection pools.');

      try {
        // 2. Disconnect safely from Prisma once active workflows finish
        logger.info('Disconnecting database clients...');
        await prisma.$disconnect();
        logger.info('Database disconnected cleanly.');
        
        process.exit(0);
      } catch (dbError) {
        logger.error(dbError, 'Error closing database clients during shutdown');
        process.exit(1);
      }
    });
  } else {
    // If the server never started listening, just close database connections and exit
    await prisma.$disconnect();
    process.exit(0);
  }

  // 💥 Safety Timeout Net: Force an abrupt exit if cleanup gets stuck longer than 10s
  setTimeout(() => {
    logger.fatal('Shutdown took too long! Forcing immediate process termination.');
    process.exit(1);
  }, 10000);
};

// Listen for operational termination events
process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));

/**
 * 🚀 Boosts the Application runtime
 */
const startServer = async () => {
  try {
    // Establish database verification checks early
    await prisma.$connect();
    logger.info('Database connections established successfully');

    // Capture the running listener state instance
    server = app.listen(env.PORT, () => {
      logger.info(`Server running on port ${env.PORT} in ${env.NODE_ENV} mode`);
    });
  } catch (error) {
    logger.fatal(error, 'Failed to initialize system core startup layers');    
    await prisma.$disconnect();
    process.exit(1);
  }
};

startServer();