import compression from 'compression';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { randomUUID } from 'node:crypto';
import pinoHttp from 'pino-http';
import env from './config/env.js';
import { MESSAGES } from './constants/messages.js';
import attachResponse from './middleware/attachResponse.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import router from './routes/index.js';
import logger from './utils/logger.js';

const app = express();
const BODY_LIMIT = '1mb';

app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(helmet());
app.use(
  cors({
    origin: env.corsOrigin,
    exposedHeaders: ['x-request-id'],
  })
);
app.use(compression());

app.use(
  pinoHttp({
    logger,
    genReqId: (req, res) => {
      const existing = req.headers['x-request-id'];
      const id = typeof existing === 'string' && existing.trim() ? existing : randomUUID();
      res.setHeader('x-request-id', id);
      return id;
    },
    autoLogging: {
      ignore: (req) => req.url === '/health',
    },
  })
);

app.use(attachResponse);

app.use(express.json({ limit: BODY_LIMIT }));

app.use((err, _req, res, next) => {
  if (err?.type === 'entity.parse.failed') {
    return res.error(MESSAGES.INVALID_JSON, { detail: err.message }, 400);
  }

  if (err?.type === 'entity.too.large' || err?.status === 413) {
    return res.error(MESSAGES.PAYLOAD_TOO_LARGE, { limit: BODY_LIMIT }, 413);
  }

  return next(err);
});

app.get('/health', (_req, res) =>
  res.success(MESSAGES.HEALTH_OK, {
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  })
);

const rateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/v1', rateLimiter, router);
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
