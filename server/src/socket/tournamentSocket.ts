import { Server, Socket } from 'socket.io';
import prisma from '../config/prisma';

export const setupTournamentSocket = (io: Server, socket: Socket): void => {
  const userId: number = socket.data.user.id;

  // 토너먼트 방 참가 (소켓 룸)
  socket.on('tournament_join_room', ({ tournamentId }: { tournamentId: number }) => {
    socket.join(`tournament:${tournamentId}`);
  });

  // 토너먼트 시작 (방장)
  socket.on('tournament_start', async ({ tournamentId }: { tournamentId: number }) => {
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: { participants: { include: { tournament: false } } },
    });

    if (!tournament || tournament.hostId !== userId) return;
    if (tournament.status !== 'waiting') return;

    const participants = tournament.participants;
    if (participants.length < 4) {
      socket.emit('tournament_error', { message: '최소 4명이 필요합니다.' });
      return;
    }

    // 시드 배정 (레이팅 순 또는 랜덤)
    const users = await prisma.user.findMany({
      where: { id: { in: participants.map((p) => p.userId) } },
      orderBy: { rating: 'desc' },
    });

    const seeds = users.map((u, i) => ({ userId: u.id, seed: i + 1 }));

    await prisma.$transaction([
      prisma.tournament.update({ where: { id: tournamentId }, data: { status: 'ongoing' } }),
      ...seeds.map((s) =>
        prisma.tournamentParticipant.updateMany({
          where: { tournamentId, userId: s.userId },
          data: { seed: s.seed },
        })
      ),
    ]);

    // 1라운드 대진 생성 (싱글 엘리미네이션)
    const bracket = createBracket(seeds.map((s) => s.userId));

    io.to(`tournament:${tournamentId}`).emit('tournament_started', {
      tournamentId,
      bracket,
      participants: seeds,
    });
  });

  // 토너먼트 라운드 완료 알림
  socket.on('tournament_round_complete', ({ tournamentId, roundResults }: {
    tournamentId: number;
    roundResults: { gameId: number; winner: number }[];
  }) => {
    io.to(`tournament:${tournamentId}`).emit('tournament_round_complete', { roundResults });
  });

  // 리그 방 참가
  socket.on('league_join_room', ({ leagueId }: { leagueId: number }) => {
    socket.join(`league:${leagueId}`);
  });

  // 리그 시작 (방장)
  socket.on('league_start', async ({ leagueId }: { leagueId: number }) => {
    const league = await prisma.league.findUnique({
      where: { id: leagueId },
      include: { participants: true },
    });

    if (!league || league.hostId !== userId) return;
    if (league.status !== 'waiting') return;

    const participants = league.participants;
    if (participants.length < 4) {
      socket.emit('league_error', { message: '최소 4명이 필요합니다.' });
      return;
    }

    // 라운드 로빈 게임 생성
    const games = [];
    for (let i = 0; i < participants.length; i++) {
      for (let j = i + 1; j < participants.length; j++) {
        games.push({
          whiteId: participants[i].userId,
          blackId: participants[j].userId,
          timeControl: league.timeControl,
          gameMode: 'league',
          leagueId,
        });
      }
    }

    await prisma.$transaction([
      prisma.league.update({ where: { id: leagueId }, data: { status: 'ongoing' } }),
      prisma.game.createMany({ data: games }),
    ]);

    io.to(`league:${leagueId}`).emit('league_started', { leagueId });
  });

  // 리그 매치 결과 업데이트
  socket.on('league_match_result', async ({ leagueId, gameId, result }: {
    leagueId: number; gameId: number; result: 'white' | 'black' | 'draw';
  }) => {
    const game = await prisma.game.findUnique({ where: { id: gameId } });
    if (!game) return;

    // 리그 참가자 점수 업데이트
    if (result === 'white') {
      await prisma.leagueParticipant.updateMany({
        where: { leagueId, userId: game.whiteId },
        data: { wins: { increment: 1 }, points: { increment: 3 } },
      });
      await prisma.leagueParticipant.updateMany({
        where: { leagueId, userId: game.blackId },
        data: { losses: { increment: 1 } },
      });
    } else if (result === 'black') {
      await prisma.leagueParticipant.updateMany({
        where: { leagueId, userId: game.blackId },
        data: { wins: { increment: 1 }, points: { increment: 3 } },
      });
      await prisma.leagueParticipant.updateMany({
        where: { leagueId, userId: game.whiteId },
        data: { losses: { increment: 1 } },
      });
    } else {
      await prisma.leagueParticipant.updateMany({
        where: { leagueId, userId: { in: [game.whiteId, game.blackId] } },
        data: { draws: { increment: 1 }, points: { increment: 1 } },
      });
    }

    const updated = await prisma.leagueParticipant.findMany({
      where: { leagueId },
      orderBy: { points: 'desc' },
    });

    io.to(`league:${leagueId}`).emit('league_match_result', { gameId, result, standings: updated });
  });

  // 방장 권한 양도 (소켓 알림)
  socket.on('host_transfer', ({ roomId, newHostId }: { roomId: string; newHostId: number }) => {
    io.to(roomId).emit('host_transfer', { newHostId });
  });
};

// 싱글 엘리미네이션 대진표 생성
const createBracket = (playerIds: number[]): { round: number; matches: [number, number][] }[] => {
  const bracket = [];
  let remaining = [...playerIds];
  let round = 1;

  while (remaining.length > 1) {
    const matches: [number, number][] = [];
    for (let i = 0; i < remaining.length; i += 2) {
      if (remaining[i + 1] !== undefined) {
        matches.push([remaining[i], remaining[i + 1]]);
      }
    }
    bracket.push({ round, matches });
    // 다음 라운드는 승자들로 구성 (실제 결과 반영 전 플레이스홀더)
    remaining = remaining.filter((_, idx) => idx % 2 === 0);
    round++;
  }

  return bracket;
};
