import { MESSAGES } from '../constants/messages.js';
import * as scheduleService from '../services/schedule.service.js';

export async function createSchedule(req, res, next) {
  try {
    const data = await scheduleService.createScheduledMessage(req.body);

    return res.success(MESSAGES.SCHEDULE_CREATED, data, 201);
  } catch (error) {
    return next(error);
  }
}

export async function listSchedules(req, res, next) {
  try {
    const data = await scheduleService.listScheduledMessages({
      status: req.query.status,
    });

    return res.success(MESSAGES.SCHEDULE_LIST_SUCCESS, data);
  } catch (error) {
    return next(error);
  }
}
