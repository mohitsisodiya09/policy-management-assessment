import pino from 'pino';
import env from '../config/env.js';

const logger = pino({
  level: env.LOG_LEVEL,
  transport:
    env.NODE_ENV === 'development'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
          },
        }
      : undefined,
  base: {
    service: 'policy-management-api',
    env: env.NODE_ENV,
  },
});

export default logger;
