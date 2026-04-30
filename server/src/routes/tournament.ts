import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../config/prisma';
import { AuthRequest } from '../middleware/auth';

const router = Router();

const createSchema = z.object({
  name: z.string().min(1).max(50),
  format: z.enum(['single_elim', 'double_elim']),
  timeControl: z.string(),
  seedType: z.enum(['rating', 'random']).default('random'),
});

// POST /api/tournaments - 토너먼트 생성
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const result = createSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ message: '입력값 오류', errors: result.error.errors });
    return;
  }

  const { name, format, timeControl } = result.data;

  try {
    const tournament = await prisma.tournament.create({
      data: {
        name, format, timeControl,
        hostId: req.user!.id,
        participants: {
          create: { userId: req.user!.id }, // 방장 자동 참가
        },
      },
      include: { participants: true },
    });
    res.status(201).json(tournament);
  } catch {
    res.status(500).json({ message: '서버 오류' });
  }
});

// GET /api/tournaments/:id - 토너먼트 조회
router.get('/:id', async (req, res: Response): Promise<void> => {
  const id = parseInt(req.params.id);
  try {
    const tournament = await prisma.tournament.findUnique({
      where: { id },
      include: {
        participants: {
          include: { tournament: false },
        },
        games: {
          include: {
            white: { select: { id: true, name: true, rating: true } },
            black: { select: { id: true, name: true, rating: true } },
          },
        },
      },
    });
    if (!tournament) {
      res.status(404).json({ message: '토너먼트를 찾을 수 없습니다.' });
      return;
    }
    res.json(tournament);
  } catch {
    res.status(500).json({ message: '서버 오류' });
  }
});

// POST /api/tournaments/:id/join - 토너먼트 참가
router.post('/:id/join', async (req: AuthRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params.id);
  const userId = req.user!.id;

  try {
    const tournament = await prisma.tournament.findUnique({
      where: { id },
      include: { participants: true },
    });
    if (!tournament) {
      res.status(404).json({ message: '토너먼트를 찾을 수 없습니다.' });
      return;
    }
    if (tournament.status !== 'waiting') {
      res.status(400).json({ message: '이미 시작된 토너먼트입니다.' });
      return;
    }

    await prisma.tournamentParticipant.create({
      data: { tournamentId: id, userId },
    });

    res.json({ message: '참가 완료' });
  } catch {
    res.status(500).json({ message: '서버 오류' });
  }
});

// POST /api/tournaments/:id/transfer-host - 방장 권한 양도
router.post('/:id/transfer-host', async (req: AuthRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params.id);
  const { newHostId } = req.body;

  try {
    const tournament = await prisma.tournament.findUnique({ where: { id } });
    if (!tournament) {
      res.status(404).json({ message: '토너먼트를 찾을 수 없습니다.' });
      return;
    }
    if (tournament.hostId !== req.user!.id) {
      res.status(403).json({ message: '방장만 권한을 양도할 수 있습니다.' });
      return;
    }

    await prisma.tournament.update({ where: { id }, data: { hostId: newHostId } });
    res.json({ message: '방장 권한이 양도되었습니다.' });
  } catch {
    res.status(500).json({ message: '서버 오류' });
  }
});

export default router;
