import { Request, Response } from 'express';
import { prisma } from '../config/db';
import { AppError } from '../middleware/errorHandler';
import { calculateStreaks } from '../services/streak.service';
import { todayInTimezone } from '../services/timezone.service';
import { createHabitSchema } from '../validators/schemas';

export async function assertOwnedHabit(habitId: string, userId: string) {
  const habit = await prisma.habit.findUnique({ where: { id: habitId } });
  if (!habit || habit.userId !== userId) {
    throw new AppError(404, 'HABIT_NOT_FOUND', 'Habit not found.');
  }
  return habit;
}

export async function listHabits(req: Request, res: Response) {
  const { userId, timezone } = req.auth!;
  const today = todayInTimezone(timezone);

  const habits = await prisma.habit.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
    include: { checkIns: { select: { localDate: true } } },
  });

  const result = habits.map((h: (typeof habits)[number]) => {
    const { currentStreak, longestStreak } = calculateStreaks(
      h.checkIns.map((c: { localDate: string }) => c.localDate),
      today
    );
    return {
      id: h.id,
      name: h.name,
      description: h.description,
      createdAt: h.createdAt,
      totalCheckIns: h.checkIns.length,
      currentStreak,
      longestStreak,
    };
  });

  res.json({ habits: result, today });
}

export async function createHabit(req: Request, res: Response) {
  const { userId } = req.auth!;
  const { name, description } = createHabitSchema.parse(req.body);

  const habit = await prisma.habit.create({
    data: { userId, name, description },
  });

  res.status(201).json({ habit });
}

export async function getHabit(req: Request, res: Response) {
  const { userId, timezone } = req.auth!;
  const habit = await assertOwnedHabit(req.params.id, userId);
  const today = todayInTimezone(timezone);

  const checkIns = await prisma.checkIn.findMany({
    where: { habitId: habit.id },
    orderBy: { localDate: 'asc' },
  });

  const { currentStreak, longestStreak } = calculateStreaks(
    checkIns.map((c: (typeof checkIns)[number]) => c.localDate),
    today
  );

  res.json({
    habit: {
      id: habit.id,
      name: habit.name,
      description: habit.description,
      createdAt: habit.createdAt,
    },
    checkIns: checkIns.map((c: (typeof checkIns)[number]) => ({
      id: c.id,
      localDate: c.localDate,
      createdAt: c.createdAt,
    })),
    currentStreak,
    longestStreak,
    today,
  });
}

export async function deleteHabit(req: Request, res: Response) {
  const { userId } = req.auth!;
  const habit = await assertOwnedHabit(req.params.id, userId);
  await prisma.habit.delete({ where: { id: habit.id } });
  res.status(204).send();
}
