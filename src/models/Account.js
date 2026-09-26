import mongoose from 'mongoose';

const accountSchema = new mongoose.Schema(
  {
    accountName: {
      type: String,
      required: true,
      trim: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

accountSchema.index({ accountName: 1 }, { unique: true });

export default mongoose.model('Account', accountSchema);
