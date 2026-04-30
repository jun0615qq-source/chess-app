import { Router, Response } from 'express';
import prisma from '../config/prisma';
import { AuthRequest } from '../middleware/auth';

const router = Router();

// 퍼즐 난이도별 포인트
const PUZZLE_POINTS = { easy: 5, medium: 10, hard: 20 };

// GET /api/puzzles/today - 오늘의 퍼즐 조회
router.get('/today', async (req: AuthRequest, res: Response): Promise<void> => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  try {
    const puzzle = await prisma.puzzle.findFirst({
      where: { date: { gte: today, lt: tomorrow } },
    });

    if (!puzzle) {
      res.status(404).json({ message: '오늘의 퍼즐이 없습니다.' });
      return;
    }

    // 내가 이미 풀었는지 확인
    const myResult = await prisma.puzzleResult.findUnique({
      where: { userId_puzzleId: { userId: req.user!.id, puzzleId: puzzle.id } },
    });

    res.json({
      puzzle: {
        ...puzzle,
        solution: JSON.parse(puzzle.solution), // 학급 앱이므로 항상 전달 (클라이언트에서 정답 비교)
      },
      myResult,
    });
  } catch {
    res.status(500).json({ message: '서버 오류' });
  }
});

// POST /api/puzzles/:id/submit - 퍼즐 결과 제출
router.post('/:id/submit', async (req: AuthRequest, res: Response): Promise<void> => {
  const puzzleId = parseInt(req.params.id);
  const { solved, attempts } = req.body;
  const userId = req.user!.id;

  try {
    const puzzle = await prisma.puzzle.findUnique({ where: { id: puzzleId } });
    if (!puzzle) {
      res.status(404).json({ message: '퍼즐을 찾을 수 없습니다.' });
      return;
    }

    // 중복 제출 방지
    const existing = await prisma.puzzleResult.findUnique({
      where: { userId_puzzleId: { userId, puzzleId } },
    });
    if (existing) {
      res.status(409).json({ message: '이미 제출한 퍼즐입니다.' });
      return;
    }

    const difficulty = puzzle.difficulty as 'easy' | 'medium' | 'hard';
    const pointsEarned = solved ? (PUZZLE_POINTS[difficulty] || 0) : 0;

    // 결과 저장 및 유저 포인트/스트릭 업데이트 (트랜잭션)
    await prisma.$transaction(async (tx) => {
      await tx.puzzleResult.create({
        data: { userId, puzzleId, solved, attempts, pointsEarned },
      });

      if (solved) {
        const user = await tx.user.findUnique({ where: { id: userId } });
        if (!user) return;

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        // 스트릭 계산
        let newStreak = user.puzzleStreak;
        if (!user.lastPuzzleDate) {
          newStreak = 1;
        } else {
          const lastDate = new Date(user.lastPuzzleDate);
          lastDate.setHours(0, 0, 0, 0);
          if (lastDate.getTime() === yesterday.getTime()) {
            newStreak = user.puzzleStreak + 1; // 연속 풀이
          } else if (lastDate.getTime() === today.getTime()) {
            newStreak = user.puzzleStreak; // 오늘 이미 품 (변경 없음)
          } else {
            newStreak = 1; // 스트릭 초기화
          }
        }

        await tx.user.update({
          where: { id: userId },
          data: {
            puzzlePoints: { increment: pointsEarned },
            puzzleStreak: newStreak,
            lastPuzzleDate: new Date(),
          },
        });
      }
    });

    res.json({ solved, pointsEarned, solution: JSON.parse(puzzle.solution) });
  } catch {
    res.status(500).json({ message: '서버 오류' });
  }
});

// GET /api/puzzles/archive - 퍼즐 아카이브 (지난 퍼즐 목록)
router.get('/archive', async (req: AuthRequest, res: Response): Promise<void> => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = 20;

  try {
    const puzzles = await prisma.puzzle.findMany({
      orderBy: { date: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        results: {
          where: { userId: req.user!.id },
          select: { solved: true, attempts: true, pointsEarned: true },
        },
      },
    });

    res.json(puzzles);
  } catch {
    res.status(500).json({ message: '서버 오류' });
  }
});

export default router;
