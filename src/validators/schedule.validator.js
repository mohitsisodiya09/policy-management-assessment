import { z } from 'zod';
import { SCHEDULE_STATUS } from '../constants/enums.js';
import { MESSAGES } from '../constants/messages.js';

function parseScheduledFor(day, time) {
  const dayMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  const timeMatch = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(time);

  if (!dayMatch || !timeMatch) {
    return null;
  }

  const hours = Number(timeMatch[1]);
  const minutes = Number(timeMatch[2]);
  const seconds = Number(timeMatch[3] || 0);

  if (hours > 23 || minutes > 59 || seconds > 59) {
    return null;
  }

  const scheduledFor = new Date(
    Number(dayMatch[1]),
    Number(dayMatch[2]) - 1,
    Number(dayMatch[3]),
    hours,
    minutes,
    seconds,
    0
  );

  return Number.isNaN(scheduledFor.getTime()) ? null : scheduledFor;
}

export const createScheduleSchema = z
  .object({
    message: z.string().trim().min(1).max(5000),
    day: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, MESSAGES.SCHEDULE_DAY_FORMAT),
    time: z
      .string()
      .trim()
      .regex(/^\d{2}:\d{2}(:\d{2})?$/, MESSAGES.SCHEDULE_TIME_FORMAT),
  })
  .transform((data) => ({
    ...data,
    scheduledFor: parseScheduledFor(data.day, data.time),
  }))
  .superRefine((data, ctx) => {
    if (!data.scheduledFor) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: MESSAGES.SCHEDULE_INVALID_DATE_TIME,
      });
      return;
    }

    if (data.scheduledFor.getTime() <= Date.now()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: MESSAGES.SCHEDULE_MUST_BE_FUTURE,
      });
    }
  });

export const listScheduleQuerySchema = z.object({
  status: z.nativeEnum(SCHEDULE_STATUS).optional(),
});
