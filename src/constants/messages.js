export const MESSAGES = Object.freeze({
  SUCCESS: 'Request completed successfully',
  HEALTH_OK: 'Server is healthy',

  UPLOAD_SUCCESS: 'File processed and data upserted into MongoDB collections',
  UPLOAD_FILE_REQUIRED: 'File is required (form-data field name: file)',
  UPLOAD_PARSE_FAILED: 'Failed to parse upload file',
  UPLOAD_ONLY_CSV_XLSX: 'Only CSV and XLSX files are allowed',
  UPLOAD_FILE_TOO_LARGE: 'Uploaded file exceeds the configured size limit',
  UPLOAD_UNSUPPORTED_FILE_TYPE: (mimeType) => `Unsupported file type: ${mimeType}`,
  UPLOAD_WORKER_ERROR: (errorMessage) => `Worker thread error: ${errorMessage}`,
  UPLOAD_WORKER_EXIT: (code) => `Worker stopped with exit code ${code}`,

  POLICY_USER_NOT_FOUND: 'No user found for the given username/email',
  POLICY_SEARCH_SUCCESS: 'Policy information fetched successfully',
  POLICY_AGGREGATE_SUCCESS: 'Aggregated policies by user fetched successfully',
  POLICY_USERNAME_OR_EMAIL_REQUIRED: 'At least one of username or email is required',

  SCHEDULE_CREATED: 'Message scheduled successfully',
  SCHEDULE_LIST_SUCCESS: 'Scheduled messages fetched successfully',
  SCHEDULE_INVALID_DATE_TIME: 'Invalid scheduled date/time',
  SCHEDULE_MUST_BE_FUTURE: 'Scheduled day/time must be in the future',
  SCHEDULE_DAY_FORMAT: 'day must be YYYY-MM-DD',
  SCHEDULE_TIME_FORMAT: 'time must be HH:mm or HH:mm:ss',

  VALIDATION_FAILED: 'Validation failed',
  INVALID_JSON: 'Invalid JSON body',
  PAYLOAD_TOO_LARGE: 'Request body too large',
  INTERNAL_ERROR: 'Internal server error',
  ROUTE_NOT_FOUND: (method, url) => `Route not found: ${method} ${url}`,
});
