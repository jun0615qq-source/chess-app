import { Router, Response } from 'express';
import prisma from '../config/prisma';
import { getTier } from '../utils/rating';

const router = Router();

// GET /api/profile/:studentId - 유저 프로필 조회
router.get('/:studentId', async (req, res: Response): Promise<void> => {
  const { studentId } = req.params;

  try {
    const user = await prisma.user.findUnique({
      where: { studentId },
      select: {
        id: true, studentId: true, name: true, role: true,
        rating: true, teamRating: true, puzzlePoints: true,
        puzzleStreak: true, createdAt: true,
        badges: true,
        ratingHistory: {
          orderBy: { createdAt: 'asc' },
          take: 100,
          select: { before: true, after: true, change: true, createdAt: true },
        },
      },
    });

    if (!user) {
      res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
      return;
    }

    // 게임 전적 집계
    const [wins, losses, draws] = await Promise.all([
      prisma.game.count({
        where: {
          result: { not: null },
          OR: [
            { whiteId: user.id, result: 'white' },
            { blackId: user.id, result: 'black' },
          ],
        },
      }),
      prisma.game.count({
        where: {
          result: { not: null },
          OR: [
            { whiteId: user.id, result: 'black' },
            { blackId: user.id, result: 'white' },
          ],
        },
      }),
      prisma.game.count({
        where: {
          result: 'draw',
          OR: [{ whiteId: user.id }, { blackId: user.id }],
        },
      }),
    ]);

    res.json({
      ...user,
      tier: getTier(user.rating),
      stats: { wins, losses, draws },
    });
  } catch {
    res.status(500).json({ message: '서버 오류' });
  }
});

export default router;
