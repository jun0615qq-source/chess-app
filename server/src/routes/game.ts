import { Router, Response } from 'express';
import prisma from '../config/prisma';
import { AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/games - 진행 중인 게임 목록 (홈 화면용)
router.get('/active', async (_req, res: Response): Promise<void> => {
  try {
    const games = await prisma.game.findMany({
      where: { result: null },
      include: {
        white: { select: { id: true, name: true, rating: true } },
        black: { select: { id: true, name: true, rating: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    res.json(games);
  } catch {
    res.status(500).json({ message: '서버 오류' });
  }
});

// GET /api/games/:id - 특정 게임 조회
router.get('/:id', async (req, res: Response): Promise<void> => {
  const gameId = parseInt(req.params.id);
  try {
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        white: { select: { id: true, name: true, studentId: true, rating: true } },
        black: { select: { id: true, name: true, studentId: true, rating: true } },
        ratingChanges: true,
      },
    });
    if (!game) {
      res.status(404).json({ message: '게임을 찾을 수 없습니다.' });
      return;
    }
    res.json(game);
  } catch {
    res.status(500).json({ message: '서버 오류' });
  }
});

// GET /api/games/user/:userId - 특정 유저의 게임 기록
router.get('/user/:userId', async (req, res: Response): Promise<void> => {
  const userId = parseInt(req.params.userId);
  const page = parseInt(req.query.page as string) || 1;
  const limit = 20;

  try {
    const [games, total] = await Promise.all([
      prisma.game.findMany({
        where: {
          OR: [{ whiteId: userId }, { blackId: userId }],
          result: { not: null },
        },
        include: {
          white: { select: { id: true, name: true, rating: true } },
          black: { select: { id: true, name: true, rating: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.game.count({
        where: {
          OR: [{ whiteId: userId }, { blackId: userId }],
          result: { not: null },
        },
      }),
    ]);

    res.json({ games, total, page, totalPages: Math.ceil(total / limit) });
  } catch {
    res.status(500).json({ message: '서버 오류' });
  }
});

export default router;
