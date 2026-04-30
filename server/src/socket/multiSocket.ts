import { Server, Socket } from 'socket.io';
import { Chess } from 'chess.js';
import prisma from '../config/prisma';
import { calculateRatingChange } from '../utils/rating';

// 1대다 방 상태
interface MultiBoard {
  chess: Chess;
  challengerId: number;
  gameId: number;
  whiteTime: number;
  blackTime: number;
  lastMoveTime: number;
  finished: boolean;
}

interface MultiRoom {
  hostId: number;
  timeControl: number;
  boards: MultiBoard[]; // 인덱스 = 보드 번호
  currentFocusIndex: number;
}

const multiRooms = new Map<string, MultiRoom>();

const parseTC = (tc: string): number => {
  const map: Record<string, number> = { '1+0': 60, '3+0': 180, '5+0': 300, '10+0': 600 };
  return map[tc] || 300;
};

export const setupMultiSocket = (io: Server, socket: Socket): void => {
  const userId: number = socket.data.user.id;

  // 1대다 방 생성
  socket.on('multi_room_create', ({ roomId, timeControl }: { roomId: string; timeControl: string }) => {
    if (multiRooms.has(roomId)) return;
    multiRooms.set(roomId, {
      hostId: userId,
      timeControl: parseTC(timeControl),
      boards: [],
      currentFocusIndex: 0,
    });
    socket.join(`multi:${roomId}`);
    socket.emit('multi_room_created', { roomId });
  });

  // 도전자 방 참가
  socket.on('multi_room_join', async ({ roomId }: { roomId: string }) => {
    const room = multiRooms.get(roomId);
    if (!room) return;
    if (room.boards.length >= 8) {
      socket.emit('multi_room_full');
      return;
    }
    if (room.hostId === userId) return;

    // 게임 생성
    const game = await prisma.game.create({
      data: {
        whiteId: room.hostId, // 방장이 항상 백
        blackId: userId,
        timeControl: room.timeControl.toString(),
        gameMode: 'multi',
      },
    });

    const board: MultiBoard = {
      chess: new Chess(),
      challengerId: userId,
      gameId: game.id,
      whiteTime: room.timeControl,
      blackTime: room.timeControl,
      lastMoveTime: Date.now(),
      finished: false,
    };

    const boardIndex = room.boards.length;
    room.boards.push(board);

    socket.join(`multi:${roomId}`);
    socket.join(`game:${game.id}`);

    // 방장에게 새 도전자 알림
    io.to(`multi:${roomId}`).emit('multi_challenger_joined', {
      boardIndex,
      gameId: game.id,
      challengerId: userId,
    });
  });

  // 1대다 이동
  socket.on('multi_move', async ({ roomId, boardIndex, from, to, promotion }: {
    roomId: string; boardIndex: number; from: string; to: string; promotion?: string;
  }) => {
    const room = multiRooms.get(roomId);
    if (!room) return;

    const board = room.boards[boardIndex];
    if (!board || board.finished) return;

    const isHost = room.hostId === userId;
    const isChallenger = board.challengerId === userId;
    const isWhiteTurn = board.chess.turn() === 'w';

    // 차례 확인 (방장=백, 도전자=흑)
    if ((isWhiteTurn && !isHost) || (!isWhiteTurn && !isChallenger)) return;

    const moveResult = board.chess.move({ from, to, promotion: promotion || 'q' });
    if (!moveResult) {
      socket.emit('invalid_move', { boardIndex });
      return;
    }

    // 시간 업데이트
    const elapsed = (Date.now() - board.lastMoveTime) / 1000;
    if (isWhiteTurn) board.whiteTime = Math.max(0, board.whiteTime - elapsed);
    else board.blackTime = Math.max(0, board.blackTime - elapsed);
    board.lastMoveTime = Date.now();

    await prisma.game.update({ where: { id: board.gameId }, data: { pgn: board.chess.pgn() } });

    io.to(`multi:${roomId}`).emit('multi_move', {
      boardIndex, from, to, promotion,
      san: moveResult.san,
      fen: board.chess.fen(),
    });

    // 게임 종료 확인
    if (board.chess.isGameOver()) {
      board.finished = true;
      const result = board.chess.isCheckmate()
        ? (board.chess.turn() === 'w' ? 'black' : 'white')
        : 'draw';
      await finishMultiBoard(io, room, board, result, 'checkmate');
    }

    // 방장이 수를 뒀으면 다음 보드로 포커스 이동
    if (isHost) {
      const nextIndex = findNextBoard(room, boardIndex);
      room.currentFocusIndex = nextIndex;
      io.to(`multi:${roomId}`).emit('multi_focus_change', { boardIndex: nextIndex });
    }
  });
};

// 다음 활성 보드 찾기
const findNextBoard = (room: MultiRoom, current: number): number => {
  const len = room.boards.length;
  for (let i = 1; i <= len; i++) {
    const idx = (current + i) % len;
    if (!room.boards[idx].finished) return idx;
  }
  return current;
};

// 1대다 게임 종료 처리
const finishMultiBoard = async (
  io: Server,
  room: MultiRoom,
  board: MultiBoard,
  result: 'white' | 'black' | 'draw',
  reason: string
): Promise<void> => {
  const [hostUser, challengerUser] = await Promise.all([
    prisma.user.findUnique({ where: { id: room.hostId } }),
    prisma.user.findUnique({ where: { id: board.challengerId } }),
  ]);
  if (!hostUser || !challengerUser) return;

  const hostScore = result === 'white' ? 1 : result === 'draw' ? 0.5 : 0;
  const challengerScore = 1 - hostScore;

  const hostCalc = calculateRatingChange(hostUser.rating, challengerUser.rating, hostScore);
  const challengerCalc = calculateRatingChange(challengerUser.rating, hostUser.rating, challengerScore);

  await prisma.$transaction([
    prisma.game.update({ where: { id: board.gameId }, data: { result, reason } }),
    prisma.user.update({ where: { id: room.hostId }, data: { rating: hostCalc.newRating } }),
    prisma.user.update({ where: { id: board.challengerId }, data: { rating: challengerCalc.newRating } }),
    prisma.ratingHistory.createMany({
      data: [
        { userId: room.hostId, gameId: board.gameId, before: hostUser.rating, after: hostCalc.newRating, change: hostCalc.change, gap: hostCalc.gap, multiplier: hostCalc.multiplier },
        { userId: board.challengerId, gameId: board.gameId, before: challengerUser.rating, after: challengerCalc.newRating, change: challengerCalc.change, gap: challengerCalc.gap, multiplier: challengerCalc.multiplier },
      ],
    }),
  ]);

  io.to(`game:${board.gameId}`).emit('game_over', {
    result, reason,
    whiteRating: { before: hostUser.rating, after: hostCalc.newRating, change: hostCalc.change },
    blackRating: { before: challengerUser.rating, after: challengerCalc.newRating, change: challengerCalc.change },
  });
};
