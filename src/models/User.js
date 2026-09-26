import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    dob: {
      type: Date,
      default: null,
    },
    address: {
      type: String,
      trim: true,
      default: '',
    },
    phoneNumber: {
      type: String,
      trim: true,
      default: '',
    },
    state: {
      type: String,
      trim: true,
      default: '',
    },
    zipCode: {
      type: String,
      trim: true,
      default: '',
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: '',
    },
    gender: {
      type: String,
      trim: true,
      default: '',
    },
    userType: {
      type: String,
      trim: true,
      default: '',
    },
  },
  { timestamps: true }
);

userSchema.index({ firstName: 1 });
userSchema.index(
  { email: 1 },
  {
    unique: true,
    partialFilterExpression: { email: { $gt: '' } },
  }
);
userSchema.index({ firstName: 1, email: 1, phoneNumber: 1 });

export default mongoose.model('User', userSchema);
