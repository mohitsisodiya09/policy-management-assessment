import mongoose from 'mongoose';

const policySchema = new mongoose.Schema(
  {
    policyNumber: {
      type: String,
      required: true,
      trim: true,
    },
    policyStartDate: {
      type: Date,
      default: null,
    },
    policyEndDate: {
      type: Date,
      default: null,
    },
    policyCategoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LOB',
      required: true,
    },
    companyCollectionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Carrier',
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    agentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Agent',
      default: null,
    },
    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
      default: null,
    },
  },
  { timestamps: true }
);

policySchema.index({ policyNumber: 1 }, { unique: true });
policySchema.index({ userId: 1 });
policySchema.index({ policyCategoryId: 1 });
policySchema.index({ companyCollectionId: 1 });

export default mongoose.model('Policy', policySchema);
