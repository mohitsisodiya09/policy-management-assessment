import { MESSAGES } from '../constants/messages.js';
import ApiError from '../utils/ApiError.js';

export default function validate(schema, source = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      return next(new ApiError(400, MESSAGES.VALIDATION_FAILED, result.error.flatten()));
    }

    req[source] = result.data;
    return next();
  };
}
