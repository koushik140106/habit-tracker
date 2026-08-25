import { Request, Response } from 'express';
import { prisma } from '../config/db';
import { AppError } from '../middleware/errorHandler';
import { isFutureLocalDate, todayInTimezone } from '../services/timezone.service';
import { createCheckInSchema } from '../validators/schemas';
import { assertOwnedHabit } from './habit.controller';

export async function createCheckIn(req: Request, res: Response) {
  const { userId, timezone } = req.auth!;
  const habit = await assertOwnedHabit(req.params.id, userId);
  const { date } = createCheckInSchema.parse(req.body ?? {});

  // Defaulting to "today" is itself timezone-dependent, so it goes through
  // the same timezone service rather than using `new Date()` here.
  const localDate = date ?? todayInTimezone(timezone);

  if (isFutureLocalDate(localDate, timezone)) {
    throw new AppError(
      400,
      'FUTURE_DATE_NOT_ALLOWED',
      `Cannot log a check-in for ${localDate}: it is in the future relative to your timezone (${timezone}).`
    );
  }

  try {
    const checkIn = await prisma.checkIn.create({
      data: { habitId: habit.id, localDate },
    });
    res.status(201).json({ checkIn });
  } catch (err: unknown) {
    if (typeof err === 'object' && err !== null && (err as { code?: string }).code === 'P2002') {
      throw new AppError(
        409,
        'DUPLICATE_CHECKIN',
        `This habit already has a check-in for ${localDate}.`
      );
    }
    throw err;
  }
}

export async function deleteCheckIn(req: Request, res: Response) {
  const { userId } = req.auth!;
  const habit = await assertOwnedHabit(req.params.id, userId);

  const checkIn = await prisma.checkIn.findUnique({ where: { id: req.params.checkInId } });
  if (!checkIn || checkIn.habitId !== habit.id) {
    throw new AppError(404, 'CHECKIN_NOT_FOUND', 'Check-in not found.');
  }

  await prisma.checkIn.delete({ where: { id: checkIn.id } });
  res.status(204).send();
}
