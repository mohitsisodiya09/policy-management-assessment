import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  MONGODB_URI: z.string().min(1),
  CPU_THRESHOLD_PERCENT: z.coerce.number().min(1).max(100).default(70),
  CPU_SUSTAINED_SECONDS: z.coerce.number().int().positive().default(5),
  CPU_CHECK_INTERVAL_MS: z.coerce.number().int().positive().default(1000),
  LOG_LEVEL: z.string().default('info'),
  UPLOAD_MAX_FILE_SIZE_MB: z.coerce.number().positive().default(25),
  CORS_ORIGIN: z.string().default('*'),
  RATE_LIMIT_WINDOW_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(15 * 60 * 1000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  process.stderr.write(`Invalid environment configuration: ${JSON.stringify(parsed.error.flatten().fieldErrors)}\n`);
  process.exit(1);
}

const env = parsed.data;

const corsOrigin =
  env.CORS_ORIGIN.trim() === '*'
    ? '*'
    : env.CORS_ORIGIN.split(',')
        .map((origin) => origin.trim())
        .filter(Boolean);

export default {
  ...env,
  isProd: env.NODE_ENV === 'production',
  uploadMaxBytes: env.UPLOAD_MAX_FILE_SIZE_MB * 1024 * 1024,
  corsOrigin,
};
