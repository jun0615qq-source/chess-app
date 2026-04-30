import { Server, Socket } from 'socket.io';
import { Chess } from 'chess.js';
import prisma from '../config/prisma';
import { calculateRatingChange } from '../utils/rating';

// 진행 중인 게임 상태 메모리 관리
interface GameState {
  chess: Chess;
  whiteId: number;
  blackId: number;
  timeControl: number; // 초 단위
  whiteTime: number;
  blackTime: number;
  currentTurn: 'w' | 'b';
  lastMoveTime: number;
  timerInterval?: NodeJS.Timeout;
  premove?: { from: string; to: string; promotion?: string; playerId: number };
  drawOffer?: number; // 무승부 제안한 유저 ID
}

const activeGames = new Map<number, GameState>();

// 시간 제어 문자열을 초로 변환
const parseTimeControl = (tc: string): number => {
  const map: Record<string, number> = {
    '1+0': 60, '3+0': 180, '5+0': 300, '10+0': 600, unlimited: Infinity,
  };
  return map[tc] || 300;
};

export const setupGameSocket = (io: Server, socket: Socket): void => {
  const userId = socket.data.user.id;

  // 매치메이킹 큐 (간단한 구현)
  const matchmakingQueue: { userId: number; rating: number; timeControl: string; socketId: string }[] = [];

  // 게임 방 입장 (직접 초대 혹은 매치메이킹으로 생성된 게임)
  socket.on('game_join', async ({ gameId }: { gameId: number }) => {
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        white: { select: { id: true, name: true, rating: true } },
        black: { select: { id: true, name: true, rating: true } },
      },
    });

    if (!game) return;

    // 플레이어인지 확인
    const isPlayer = game.whiteId === userId || game.blackId === userId;
    if (!isPlayer) return;

    socket.join(`game:${gameId}`);

    // 게임 상태 초기화 (아직 없는 경우)
    if (!activeGames.has(gameId)) {
      const tc = parseTimeControl(game.timeControl);
      const chess = new Chess();
      if (game.pgn) chess.loadPgn(game.pgn);

      const state: GameState = {
        chess,
        whiteId: game.whiteId,
        blackId: game.blackId,
        timeControl: tc,
        whiteTime: tc,
        blackTime: tc,
        currentTurn: chess.turn(),
        lastMoveTime: Date.now(),
      };
      activeGames.set(gameId, state);
      startTimer(io, gameId, state);
    }

    const state = activeGames.get(gameId)!;
    socket.emit('game_state', {
      fen: state.chess.fen(),
      pgn: state.chess.pgn(),
      whiteTime: state.whiteTime,
      blackTime: state.blackTime,
      turn: state.currentTurn,
    });
  });

  // 기물 이동 처리
  socket.on('move', async ({ gameId, from, to, promotion }: {
    gameId: number; from: string; to: string; promotion?: string;
  }) => {
    const state = activeGames.get(gameId);
    if (!state) return;

    // 현재 차례 확인
    const isWhiteTurn = state.currentTurn === 'w';
    const isMyTurn = isWhiteTurn ? state.whiteId === userId : state.blackId === userId;
    if (!isMyTurn) return;

    // 서버에서 chess.js로 합법성 재검증
    const moveResult = state.chess.move({ from, to, promotion: promotion || 'q' });
    if (!moveResult) {
      socket.emit('invalid_move', { from, to });
      return;
    }

    // 시간 업데이트
    const elapsed = (Date.now() - state.lastMoveTime) / 1000;
    if (isWhiteTurn) {
      state.whiteTime = Math.max(0, state.whiteTime - elapsed);
    } else {
      state.blackTime = Math.max(0, state.blackTime - elapsed);
    }
    state.lastMoveTime = Date.now();
    state.currentTurn = state.chess.turn();

    // PGN 저장
    await prisma.game.update({
      where: { id: gameId },
      data: { pgn: state.chess.pgn() },
    });

    // 모든 플레이어/관전자에게 브로드캐스트
    io.to(`game:${gameId}`).emit('move', {
      from, to, promotion,
      san: moveResult.san,
      fen: state.chess.fen(),
      pgn: state.chess.pgn(),
    });

    io.to(`spectate:${gameId}`).emit('move', {
      from, to, promotion,
      san: moveResult.san,
      fen: state.chess.fen(),
    });

    // 게임 종료 조건 확인
    if (state.chess.isGameOver()) {
      await handleGameOver(io, gameId, state, determineResult(state.chess));
      return;
    }

    // 미리두기 처리
    if (state.premove && state.premove.playerId !== userId) {
      const pm = state.premove;
      const pmResult = state.chess.move({ from: pm.from, to: pm.to, promotion: pm.promotion || 'q' });
      if (pmResult) {
        state.currentTurn = state.chess.turn();
        await prisma.game.update({ where: { id: gameId }, data: { pgn: state.chess.pgn() } });
        io.to(`game:${gameId}`).emit('move', {
          from: pm.from, to: pm.to, promotion: pm.promotion,
          san: pmResult.san, fen: state.chess.fen(), pgn: state.chess.pgn(),
        });
      }
      state.premove = undefined;
    }
  });

  // 미리두기 등록
  socket.on('premove', ({ gameId, from, to, promotion }: {
    gameId: number; from: string; to: string; promotion?: string;
  }) => {
    const state = activeGames.get(gameId);
    if (!state) return;
    state.premove = { from, to, promotion, playerId: userId };
    socket.emit('premove_set', { from, to });
  });

  // 미리두기 취소
  socket.on('premove_cancel', ({ gameId }: { gameId: number }) => {
    const state = activeGames.get(gameId);
    if (!state) return;
    state.premove = undefined;
    socket.emit('premove_cancelled');
  });

  // 기권
  socket.on('resign', async ({ gameId }: { gameId: number }) => {
    const state = activeGames.get(gameId);
    if (!state) return;
    if (state.whiteId !== userId && state.blackId !== userId) return;

    const winner = state.whiteId === userId ? 'black' : 'white';
    await handleGameOver(io, gameId, state, winner, 'resign');
  });

  // 무승부 제안
  socket.on('draw_offer', ({ gameId }: { gameId: number }) => {
    const state = activeGames.get(gameId);
    if (!state) return;
    state.drawOffer = userId;
    // 상대방에게 무승부 제안 전송
    socket.to(`game:${gameId}`).emit('draw_offer');
  });

  // 무승부 수락
  socket.on('draw_accept', async ({ gameId }: { gameId: number }) => {
    const state = activeGames.get(gameId);
    if (!state || !state.drawOffer || state.drawOffer === userId) return;
    await handleGameOver(io, gameId, state, 'draw', 'agreement');
  });

  // 무승부 거절
  socket.on('draw_decline', ({ gameId }: { gameId: number }) => {
    const state = activeGames.get(gameId);
    if (!state) return;
    state.drawOffer = undefined;
    socket.to(`game:${gameId}`).emit('draw_declined');
  });

  // 매치메이킹 참가
  socket.on('matchmaking_join', async ({ timeControl }: { timeControl: string }) => {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return;

    // 같은 시간 제어 옵션의 대기자 찾기 (레이팅 200 이내 우선)
    const idx = matchmakingQueue.findIndex(
      (q) => q.timeControl === timeControl && Math.abs(q.rating - user.rating) <= 300
    );

    if (idx !== -1) {
      const opponent = matchmakingQueue.splice(idx, 1)[0];
      const isWhite = Math.random() < 0.5;

      const game = await prisma.game.create({
        data: {
          whiteId: isWhite ? userId : opponent.userId,
          blackId: isWhite ? opponent.userId : userId,
          timeControl,
          gameMode: 'standard',
        },
      });

      // 양쪽에 게임 시작 알림
      io.to(socket.id).emit('game_start', { gameId: game.id, color: isWhite ? 'white' : 'black' });
      io.to(opponent.socketId).emit('game_start', { gameId: game.id, color: isWhite ? 'black' : 'white' });
    } else {
      matchmakingQueue.push({ userId, rating: user.rating, timeControl, socketId: socket.id });
      socket.emit('matchmaking_waiting');
    }
  });

  // 매치메이킹 취소
  socket.on('matchmaking_cancel', () => {
    const idx = matchmakingQueue.findIndex((q) => q.userId === userId);
    if (idx !== -1) matchmakingQueue.splice(idx, 1);
    socket.emit('matchmaking_cancelled');
  });
};

// 게임 종료 처리 (레이팅 계산 포함)
const handleGameOver = async (
  io: Server,
  gameId: number,
  state: GameState,
  result: 'white' | 'black' | 'draw',
  reason: string = 'checkmate'
): Promise<void> => {
  if (state.timerInterval) clearInterval(state.timerInterval);
  activeGames.delete(gameId);

  // 레이팅 계산
  const [whiteUser, blackUser] = await Promise.all([
    prisma.user.findUnique({ where: { id: state.whiteId } }),
    prisma.user.findUnique({ where: { id: state.blackId } }),
  ]);

  if (!whiteUser || !blackUser) return;

  const whiteScore = result === 'white' ? 1 : result === 'draw' ? 0.5 : 0;
  const blackScore = 1 - whiteScore;

  const whiteCalc = calculateRatingChange(whiteUser.rating, blackUser.rating, whiteScore);
  const blackCalc = calculateRatingChange(blackUser.rating, whiteUser.rating, blackScore);

  // 트랜잭션으로 레이팅 업데이트 및 히스토리 기록
  await prisma.$transaction([
    prisma.game.update({
      where: { id: gameId },
      data: { result, reason, pgn: state.chess.pgn() },
    }),
    prisma.user.update({
      where: { id: state.whiteId },
      data: { rating: whiteCalc.newRating },
    }),
    prisma.user.update({
      where: { id: state.blackId },
      data: { rating: blackCalc.newRating },
    }),
    prisma.ratingHistory.create({
      data: {
        userId: state.whiteId, gameId,
        before: whiteUser.rating, after: whiteCalc.newRating,
        change: whiteCalc.change, gap: whiteCalc.gap, multiplier: whiteCalc.multiplier,
      },
    }),
    prisma.ratingHistory.create({
      data: {
        userId: state.blackId, gameId,
        before: blackUser.rating, after: blackCalc.newRating,
        change: blackCalc.change, gap: blackCalc.gap, multiplier: blackCalc.multiplier,
      },
    }),
  ]);

  // 결과 브로드캐스트
  io.to(`game:${gameId}`).emit('game_over', {
    result, reason,
    whiteRating: { before: whiteUser.rating, after: whiteCalc.newRating, change: whiteCalc.change },
    blackRating: { before: blackUser.rating, after: blackCalc.newRating, change: blackCalc.change },
  });

  io.to(`spectate:${gameId}`).emit('game_over', { result, reason });
};

// 게임 종료 결과 판단 (chess.js 기반)
const determineResult = (chess: Chess): 'white' | 'black' | 'draw' => {
  if (chess.isCheckmate()) {
    return chess.turn() === 'w' ? 'black' : 'white';
  }
  return 'draw'; // 스테일메이트, 기물 부족 등
};

// 타이머 (500ms 간격 서버 동기화)
const startTimer = (io: Server, gameId: number, state: GameState): void => {
  if (state.timeControl === Infinity) return;

  state.timerInterval = setInterval(async () => {
    const elapsed = (Date.now() - state.lastMoveTime) / 1000;
    const isWhiteTurn = state.currentTurn === 'w';

    const remainingWhite = isWhiteTurn ? state.whiteTime - elapsed : state.whiteTime;
    const remainingBlack = isWhiteTurn ? state.blackTime : state.blackTime - elapsed;

    io.to(`game:${gameId}`).emit('time_update', {
      whiteTime: Math.max(0, remainingWhite),
      blackTime: Math.max(0, remainingBlack),
    });

    // 시간 초과 처리
    if (isWhiteTurn && remainingWhite <= 0) {
      await handleGameOver(io, gameId, state, 'black', 'timeout');
    } else if (!isWhiteTurn && remainingBlack <= 0) {
      await handleGameOver(io, gameId, state, 'white', 'timeout');
    }
  }, 500);
};
