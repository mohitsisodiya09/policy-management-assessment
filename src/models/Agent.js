import mongoose from 'mongoose';

const agentSchema = new mongoose.Schema(
  {
    agentName: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { timestamps: true }
);

agentSchema.index({ agentName: 1 }, { unique: true });

export default mongoose.model('Agent', agentSchema);
