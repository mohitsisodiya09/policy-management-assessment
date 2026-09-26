import { MESSAGES } from '../constants/messages.js';
import * as uploadService from '../services/upload.service.js';

export async function uploadPolicyData(req, res, next) {
  try {
    const result = await uploadService.ingestUploadedFile(req.file);

    return res.success(MESSAGES.UPLOAD_SUCCESS, result, 201);
  } catch (error) {
    return next(error);
  }
}
