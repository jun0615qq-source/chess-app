import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../config/prisma';
import { AuthRequest } from '../middleware/auth';

const router = Router();

const createSchema = z.object({
  name: z.string().min(1).max(50),
  timeControl: z.string(),
});

// POST /api/leagues - 리그 생성
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const result = createSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ message: '입력값 오류' });
    return;
  }

  const { name, timeControl } = result.data;

  try {
    const league = await prisma.league.create({
      data: {
        name, timeControl,
        hostId: req.user!.id,
        participants: {
          create: { userId: req.user!.id },
        },
      },
      include: { participants: true },
    });
    res.status(201).json(league);
  } catch {
    res.status(500).json({ message: '서버 오류' });
  }
});

// GET /api/leagues/:id - 리그 조회
router.get('/:id', async (req, res: Response): Promise<void> => {
  const id = parseInt(req.params.id);
  try {
    const league = await prisma.league.findUnique({
      where: { id },
      include: {
        participants: {
          include: { league: false },
        },
        games: {
          include: {
            white: { select: { id: true, name: true, rating: true } },
            black: { select: { id: true, name: true, rating: true } },
          },
        },
      },
    });
    if (!league) {
      res.status(404).json({ message: '리그를 찾을 수 없습니다.' });
      return;
    }
    res.json(league);
  } catch {
    res.status(500).json({ message: '서버 오류' });
  }
});

// POST /api/leagues/:id/join - 리그 참가
router.post('/:id/join', async (req: AuthRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params.id);
  try {
    const league = await prisma.league.findUnique({
      where: { id },
      include: { participants: true },
    });
    if (!league) {
      res.status(404).json({ message: '리그를 찾을 수 없습니다.' });
      return;
    }
    if (league.status !== 'waiting') {
      res.status(400).json({ message: '이미 시작된 리그입니다.' });
      return;
    }
    if (league.participants.length >= 16) {
      res.status(400).json({ message: '최대 참가 인원(16명)을 초과했습니다.' });
      return;
    }

    await prisma.leagueParticipant.create({
      data: { leagueId: id, userId: req.user!.id },
    });
    res.json({ message: '참가 완료' });
  } catch {
    res.status(500).json({ message: '서버 오류' });
  }
});

// POST /api/leagues/:id/transfer-host - 방장 권한 양도
router.post('/:id/transfer-host', async (req: AuthRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params.id);
  const { newHostId } = req.body;

  try {
    const league = await prisma.league.findUnique({ where: { id } });
    if (!league) {
      res.status(404).json({ message: '리그를 찾을 수 없습니다.' });
      return;
    }
    if (league.hostId !== req.user!.id) {
      res.status(403).json({ message: '방장만 권한을 양도할 수 있습니다.' });
      return;
    }

    await prisma.league.update({ where: { id }, data: { hostId: newHostId } });
    res.json({ message: '방장 권한이 양도되었습니다.' });
  } catch {
    res.status(500).json({ message: '서버 오류' });
  }
});

export default router;
