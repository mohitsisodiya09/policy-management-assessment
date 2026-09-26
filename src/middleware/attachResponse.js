import { MESSAGES } from '../constants/messages.js';

export default function attachResponse(_req, res, next) {
  res.success = (message = MESSAGES.SUCCESS, data = null, statusCode = 200) => {
    return res.status(statusCode).json({
      status: true,
      statusCode,
      message,
      data,
      error: null,
    });
  };

  res.error = (message = MESSAGES.INTERNAL_ERROR, error = null, statusCode = 500) => {
    return res.status(statusCode).json({
      status: false,
      statusCode,
      message,
      data: null,
      error,
    });
  };

  next();
}
