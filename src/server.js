import http from 'http';
import app from './app.js';
import { connectDatabase, disconnectDatabase } from './config/db.js';
import env from './config/env.js';
import { startCpuMonitor, stopCpuMonitor } from './services/cpuMonitor.service.js';
import { startScheduleWorker, stopScheduleWorker } from './services/schedule.service.js';
import logger from './utils/logger.js';

const FATAL_EXIT_REASONS = new Set(['unhandledRejection', 'uncaughtException']);

const server = http.createServer(app);
let isShuttingDown = false;

server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;

async function start() {
  await connectDatabase();

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(env.PORT, () => {
      server.removeListener('error', reject);
      resolve();
    });
  });

  logger.info({ port: env.PORT, env: env.NODE_ENV }, 'HTTP server listening');

  startCpuMonitor({
    onThresholdExceeded: () => shutdown('CPU_THRESHOLD_EXCEEDED'),
  });
  startScheduleWorker();
}

export async function shutdown(reason) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  const exitCode = FATAL_EXIT_REASONS.has(reason) ? 1 : 0;

  logger.info({ reason }, 'Graceful shutdown initiated');
  stopCpuMonitor();
  stopScheduleWorker();

  const forceExit = setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10_000);
  forceExit.unref();

  try {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    await disconnectDatabase();
    clearTimeout(forceExit);
    process.exit(exitCode);
  } catch (error) {
    logger.error({ err: error }, 'Error during shutdown');
    process.exit(1);
  }
}

function registerProcessHandlers() {
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  process.on('unhandledRejection', (reason) => {
    logger.fatal({ err: reason }, 'Unhandled promise rejection');
    shutdown('unhandledRejection');
  });

  process.on('uncaughtException', (error) => {
    logger.fatal({ err: error }, 'Uncaught exception');
    shutdown('uncaughtException');
  });
}

registerProcessHandlers();

start().catch((error) => {
  logger.fatal({ err: error }, 'Failed to start server');
  process.exit(1);
});
