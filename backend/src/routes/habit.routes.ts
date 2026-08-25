import { Router } from 'express';
import { createHabit, deleteHabit, getHabit, listHabits } from '../controllers/habit.controller';
import { createCheckIn, deleteCheckIn } from '../controllers/checkin.controller';
import { requireAuth } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

router.use(requireAuth);

router.get('/', asyncHandler(listHabits));
router.post('/', asyncHandler(createHabit));
router.get('/:id', asyncHandler(getHabit));
router.delete('/:id', asyncHandler(deleteHabit));

router.post('/:id/checkins', asyncHandler(createCheckIn));
router.delete('/:id/checkins/:checkInId', asyncHandler(deleteCheckIn));

export default router;
