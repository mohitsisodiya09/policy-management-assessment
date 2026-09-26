import express from 'express';
import { MESSAGES } from '../constants/messages.js';
import * as uploadController from '../controllers/upload.controller.js';
import { upload } from '../middleware/upload.js';
import ApiError from '../utils/ApiError.js';

const router = express.Router();

router.post('/', upload.single('file'), (req, res, next) => {
  if (!req.file) {
    return next(new ApiError(400, MESSAGES.UPLOAD_ONLY_CSV_XLSX));
  }
  return uploadController.uploadPolicyData(req, res, next);
});

export default router;
