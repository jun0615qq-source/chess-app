import { Router, Response } from 'express';
import prisma from '../config/prisma';

const router = Router();

// GET /api/leaderboard - 개인 레이팅 리더보드
router.get('/', async (_req, res: Response): Promise<void> => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { rating: 'desc' },
      take: 50,
      select: {
        id: true, studentId: true, name: true, rating: true,
        _count: { select: { gamesAsWhite: true, gamesAsBlack: true } },
      },
    });
    res.json(users);
  } catch {
    res.status(500).json({ message: '서버 오류' });
  }
});

// GET /api/leaderboard/team - 팀 레이팅 리더보드
router.get('/team', async (_req, res: Response): Promise<void> => {
  try {
    const teams = await prisma.team.findMany({
      orderBy: { rating: 'desc' },
      take: 50,
      include: {
        members: {
          include: { user: { select: { id: true, name: true } } },
        },
      },
    });
    res.json(teams);
  } catch {
    res.status(500).json({ message: '서버 오류' });
  }
});

// GET /api/leaderboard/puzzle - 퍼즐 포인트 리더보드
router.get('/puzzle', async (_req, res: Response): Promise<void> => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { puzzlePoints: 'desc' },
      take: 50,
      select: {
        id: true, studentId: true, name: true,
        puzzlePoints: true, puzzleStreak: true,
      },
    });
    res.json(users);
  } catch {
    res.status(500).json({ message: '서버 오류' });
  }
});

export default router;
