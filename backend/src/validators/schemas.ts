import { z } from 'zod';
import { isValidCalendarDate, isValidTimezone } from '../services/timezone.service';

export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email('Must be a valid email address.'),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
  timezone: z
    .string()
    .min(1, 'Timezone is required.')
    .refine(isValidTimezone, { message: 'Must be a valid IANA timezone, e.g. Asia/Kolkata.' }),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1, 'Password is required.'),
});

export const createHabitSchema = z.object({
  name: z.string().trim().min(1, 'Habit name is required.').max(120),
  description: z.string().trim().max(500).optional(),
});

export const createCheckInSchema = z.object({
  date: z
    .string()
    .optional()
    .refine((d) => d === undefined || isValidCalendarDate(d), {
      message: 'date must be a valid calendar date in YYYY-MM-DD format.',
    }),
});
