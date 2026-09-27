import cron from 'node-cron';
import { SCHEDULE_STATUS } from '../constants/enums.js';
import ScheduledMessage from '../models/ScheduledMessage.js';
import logger from '../utils/logger.js';

let cronJob = null;

export async function createScheduledMessage({ message, day, time, scheduledFor }) {
  const doc = await ScheduledMessage.create({
    message,
    day,
    time,
    scheduledFor,
    status: SCHEDULE_STATUS.PENDING,
  });

  return {
    id: doc._id,
    message: doc.message,
    day: doc.day,
    time: doc.time,
    scheduledFor: doc.scheduledFor,
    status: doc.status,
  };
}

export async function listScheduledMessages({ status } = {}) {
  const filter = status ? { status } : {};
  return ScheduledMessage.find(filter).sort({ scheduledFor: 1 }).lean();
}

export async function deliverDueMessages() {
  const now = new Date();
  let delivered = 0;

  for (let i = 0; i < 100; i += 1) {
    try {
      // Atomically claim + mark delivered so overlapping cron ticks cannot double-deliver.
      const item = await ScheduledMessage.findOneAndUpdate(
        {
          status: SCHEDULE_STATUS.PENDING,
          scheduledFor: { $lte: now },
        },
        [
          {
            $set: {
              status: SCHEDULE_STATUS.DELIVERED,
              deliveredAt: now,
              error: null,
              deliveredPayload: {
                message: '$message',
                deliveredOn: now,
                originallyScheduledFor: '$scheduledFor',
              },
            },
          },
        ],
        { new: true }
      );

      if (!item) {
        break;
      }

      delivered += 1;
      logger.info({ scheduleId: item._id, scheduledFor: item.scheduledFor }, 'Scheduled message delivered into DB');
    } catch (error) {
      logger.error({ err: error }, 'Failed to deliver scheduled message');
      break;
    }
  }

  return { delivered };
}

export function startScheduleWorker() {
  if (cronJob) {
    return;
  }

  cronJob = cron.schedule('* * * * *', async () => {
    try {
      await deliverDueMessages();
    } catch (error) {
      logger.error({ err: error }, 'Schedule worker tick failed');
    }
  });

  logger.info('Scheduled message worker started (cron: every minute)');
}

export function stopScheduleWorker() {
  if (!cronJob) {
    return;
  }

  cronJob.stop();
  cronJob = null;
  logger.info('Scheduled message worker stopped');
}
