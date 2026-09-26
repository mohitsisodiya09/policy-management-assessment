import { z } from 'zod';
import { MESSAGES } from '../constants/messages.js';
import { escapeRegex } from '../utils/escapeRegex.js';

export const searchQuerySchema = z
  .object({
    username: z
      .string()
      .trim()
      .min(1)
      .transform((value) => escapeRegex(value))
      .optional(),
    email: z
      .string()
      .trim()
      .email()
      .transform((value) => value.toLowerCase())
      .optional(),
  })
  .refine((data) => Boolean(data.username || data.email), {
    message: MESSAGES.POLICY_USERNAME_OR_EMAIL_REQUIRED,
  });
