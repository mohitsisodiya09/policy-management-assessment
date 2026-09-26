import mongoose from 'mongoose';
import logger from '../utils/logger.js';
import env from './env.js';

export async function connectDatabase() {
  mongoose.set('strictQuery', true);

  await mongoose.connect(env.MONGODB_URI, {
    maxPoolSize: 20,
    serverSelectionTimeoutMS: 10000,
  });

  logger.info({ uri: env.MONGODB_URI.replace(/\/\/.*@/, '//***@') }, 'MongoDB connected');
}

export async function disconnectDatabase() {
  await mongoose.connection.close();
  logger.info('MongoDB disconnected');
}
