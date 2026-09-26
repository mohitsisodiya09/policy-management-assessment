import mongoose from 'mongoose';

const carrierSchema = new mongoose.Schema(
  {
    companyName: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { timestamps: true }
);

carrierSchema.index({ companyName: 1 }, { unique: true });

export default mongoose.model('Carrier', carrierSchema);
