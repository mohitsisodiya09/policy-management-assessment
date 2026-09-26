import env from '../config/env.js';
import { MESSAGES } from '../constants/messages.js';
import ApiError from '../utils/ApiError.js';
import logger from '../utils/logger.js';

export function notFoundHandler(req, res, next) {
  next(new ApiError(404, MESSAGES.ROUTE_NOT_FOUND(req.method, req.originalUrl)));
}

export function errorHandler(err, req, res, _next) {
  if (err?.name === 'MulterError') {
    const isTooLarge = err.code === 'LIMIT_FILE_SIZE';
    return res.error(
      isTooLarge ? MESSAGES.UPLOAD_FILE_TOO_LARGE : err.message,
      { code: err.code },
      isTooLarge ? 413 : 400
    );
  }

  const statusCode = err.statusCode || 500;
  const message = err.message || MESSAGES.INTERNAL_ERROR;
  const errorPayload = err.details ?? (statusCode >= 500 ? { name: err.name } : null);

  if (statusCode >= 500) {
    logger.error({ err, path: req.originalUrl }, 'Unhandled error');
  } else {
    logger.warn(
      {
        err: { message: err.message, details: err.details },
        path: req.originalUrl,
      },
      'Request error'
    );
  }

  const error =
    !env.isProd && statusCode >= 500
      ? {
          ...((typeof errorPayload === 'object' && errorPayload) || {}),
          stack: err.stack,
        }
      : errorPayload;

  return res.error(message, error, statusCode);
}
