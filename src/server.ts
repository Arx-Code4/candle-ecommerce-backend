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
let isShuttingDown = false;

const handleShutdown = async (signal: string) => {
  if (isShuttingDown) {
    logger.warn(`Received ${signal} again — shutdown already in progress, ignoring.`);
    return;
  }
  isShuttingDown = true;

  logger.warn(`Received ${signal}. Starting graceful shutdown pipeline...`);

  const forceExitTimer = setTimeout(async () => {
    logger.fatal('Graceful shutdown exceeded 10s. Forcing emergency cleanup...');
    try {
      await prisma.$disconnect();
      logger.info('Database disconnected (emergency path)');
    } catch (err) {
      logger.error(err, 'Emergency disconnect failed');
    } finally {
      process.exit(1);
    }
  }, 10_000);
  forceExitTimer.unref(); // don't let this timer itself keep the process alive

  const cleanupAndExit = async (exitCode: number) => {
    clearTimeout(forceExitTimer);
    try {
      await prisma.$disconnect();
      logger.info('Database disconnected successfully');
    } catch (err) {
      logger.error(err, 'Database disconnect failed');
      exitCode = 1;
    } finally {
      process.exit(exitCode);
    }
  };

  if (!server) {
    await cleanupAndExit(0);
    return;
  }

  server.close(async (err) => {
    if (err) {
      logger.error(err, 'Error closing HTTP server');
      await cleanupAndExit(1);
      return;
    }
    logger.info('HTTP server closed — no longer accepting connections');
    await cleanupAndExit(0);
  });
};

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));
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
