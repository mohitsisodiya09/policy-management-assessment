import express from 'express';
import * as scheduleController from '../controllers/schedule.controller.js';
import validate from '../middleware/validate.js';
import { createScheduleSchema, listScheduleQuerySchema } from '../validators/schedule.validator.js';

const router = express.Router();

router.post('/', validate(createScheduleSchema, 'body'), scheduleController.createSchedule);
router.get('/', validate(listScheduleQuerySchema, 'query'), scheduleController.listSchedules);

export default router;
