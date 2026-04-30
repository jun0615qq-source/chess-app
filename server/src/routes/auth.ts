import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import prisma from '../config/prisma';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// 회원가입 입력값 검증 스키마
const registerSchema = z.object({
  studentId: z.string().min(1).max(20),
  name: z.string().min(1).max(20),
  password: z.string().min(8).max(50),
});

// 로그인 입력값 검증 스키마
const loginSchema = z.object({
  studentId: z.string().min(1),
  password: z.string().min(1),
});

// Access Token 생성 (15분)
const generateAccessToken = (user: { id: number; studentId: string; role: string }) => {
  return jwt.sign(
    { id: user.id, studentId: user.studentId, role: user.role },
    process.env.JWT_SECRET!,
    { expiresIn: '15m' }
  );
};

// Refresh Token 생성 (7일)
const generateRefreshToken = (userId: number) => {
  return jwt.sign(
    { userId },
    process.env.JWT_REFRESH_SECRET!,
    { expiresIn: '7d' }
  );
};

// POST /api/auth/register - 회원가입
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  const result = registerSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ message: '입력값이 올바르지 않습니다.', errors: result.error.errors });
    return;
  }

  const { studentId, name, password } = result.data;

  try {
    // 학번 중복 확인
    const existing = await prisma.user.findUnique({ where: { studentId } });
    if (existing) {
      res.status(409).json({ message: '이미 사용 중인 학번입니다.' });
      return;
    }

    const hashed = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { studentId, name, password: hashed },
      select: { id: true, studentId: true, name: true, role: true, rating: true },
    });

    res.status(201).json({ message: '회원가입이 완료되었습니다.', user });
  } catch (error) {
    console.error('회원가입 오류:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// POST /api/auth/login - 로그인
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const result = loginSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ message: '입력값이 올바르지 않습니다.' });
    return;
  }

  const { studentId, password } = result.data;

  try {
    const user = await prisma.user.findUnique({ where: { studentId } });
    if (!user) {
      res.status(401).json({ message: '학번 또는 비밀번호가 올바르지 않습니다.' });
      return;
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      res.status(401).json({ message: '학번 또는 비밀번호가 올바르지 않습니다.' });
      return;
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user.id);

    // Refresh Token DB 저장
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    res.json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        studentId: user.studentId,
        name: user.name,
        role: user.role,
        rating: user.rating,
      },
    });
  } catch (error) {
    console.error('로그인 오류:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// POST /api/auth/refresh - 토큰 갱신
router.post('/refresh', async (req: Request, res: Response): Promise<void> => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    res.status(401).json({ message: 'Refresh Token이 없습니다.' });
    return;
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as { userId: number };

    // DB에서 Refresh Token 확인
    const stored = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });
    if (!stored || stored.expiresAt < new Date()) {
      res.status(401).json({ message: '유효하지 않은 Refresh Token입니다.' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user) {
      res.status(401).json({ message: '사용자를 찾을 수 없습니다.' });
      return;
    }

    // 기존 Refresh Token 삭제 후 새 토큰 발급 (Token Rotation)
    await prisma.refreshToken.delete({ where: { token: refreshToken } });

    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user.id);

    await prisma.refreshToken.create({
      data: {
        token: newRefreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    res.json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
  } catch {
    res.status(401).json({ message: '유효하지 않은 Refresh Token입니다.' });
  }
});

// POST /api/auth/logout - 로그아웃
router.post('/logout', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const { refreshToken } = req.body;
  if (refreshToken) {
    await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
  }
  res.json({ message: '로그아웃 완료' });
});

// GET /api/auth/me - 내 정보 조회
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true, studentId: true, name: true, role: true,
        rating: true, teamRating: true, puzzlePoints: true,
        puzzleStreak: true, createdAt: true,
      },
    });
    if (!user) {
      res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
      return;
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

export default router;
