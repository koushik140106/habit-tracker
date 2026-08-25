import bcrypt from 'bcryptjs';
import { Request, Response } from 'express';
import jwt, { SignOptions } from 'jsonwebtoken';
import { prisma } from '../config/db';
import { AppError } from '../middleware/errorHandler';
import { loginSchema, registerSchema } from '../validators/schemas';

const SALT_ROUNDS = 12;

function signToken(userId: string, timezone: string): string {
  const options: SignOptions = {
    expiresIn: (process.env.JWT_EXPIRES_IN ?? '7d') as SignOptions['expiresIn'],
  };
  return jwt.sign({ userId, timezone }, process.env.JWT_SECRET as string, options);
}

export async function register(req: Request, res: Response) {
  const { email, password, timezone } = registerSchema.parse(req.body);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new AppError(409, 'EMAIL_TAKEN', 'An account with this email already exists.');
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await prisma.user.create({
    data: { email, passwordHash, timezone },
  });

  const token = signToken(user.id, user.timezone);
  res.status(201).json({
    token,
    user: { id: user.id, email: user.email, timezone: user.timezone },
  });
}

export async function login(req: Request, res: Response) {
  const { email, password } = loginSchema.parse(req.body);

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
  }

  const token = signToken(user.id, user.timezone);
  res.json({
    token,
    user: { id: user.id, email: user.email, timezone: user.timezone },
  });
}
