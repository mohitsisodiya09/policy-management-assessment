import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import env from '../config/env.js';
import { MESSAGES } from '../constants/messages.js';
import ApiError from '../utils/ApiError.js';
import { allowedExtensions, allowedMimeTypes } from '../validators/upload.validator.js';

const uploadsDir = path.join(process.cwd(), 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

function fileFilter(_req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();

  if (!allowedExtensions.has(ext)) {
    return cb(new ApiError(400, MESSAGES.UPLOAD_ONLY_CSV_XLSX));
  }

  // Some clients send wrong/empty MIME; only reject when MIME is present and not allowed.
  if (file.mimetype && !allowedMimeTypes.has(file.mimetype)) {
    return cb(new ApiError(400, MESSAGES.UPLOAD_UNSUPPORTED_FILE_TYPE(file.mimetype)));
  }

  return cb(null, true);
}

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: env.uploadMaxBytes,
    files: 1,
  },
});
