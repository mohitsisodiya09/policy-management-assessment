import mongoose from 'mongoose';
import { SCHEDULE_STATUS } from '../constants/enums.js';

const scheduledMessageSchema = new mongoose.Schema(
  {
    message: {
      type: String,
      required: true,
      trim: true,
    },
    day: {
      type: String,
      required: true,
      trim: true,
    },
    time: {
      type: String,
      required: true,
      trim: true,
    },
    scheduledFor: {
      type: Date,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(SCHEDULE_STATUS),
      default: SCHEDULE_STATUS.PENDING,
      index: true,
    },
    deliveredAt: {
      type: Date,
      default: null,
    },
    deliveredPayload: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    error: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

scheduledMessageSchema.index({ status: 1, scheduledFor: 1 });

const ScheduledMessage = mongoose.model('ScheduledMessage', scheduledMessageSchema);

export default ScheduledMessage;
