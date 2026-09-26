import mongoose from 'mongoose';

const lobSchema = new mongoose.Schema(
  {
    categoryName: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { timestamps: true }
);

lobSchema.index({ categoryName: 1 }, { unique: true });

export default mongoose.model('LOB', lobSchema);
