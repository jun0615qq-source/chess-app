import { Server, Socket } from 'socket.io';
import { Chess } from 'chess.js';
import prisma from '../config/prisma';

interface TeamPlayer {
  userId: number;
  name: string;
  socketId: string;
  rating: number;
}

interface TeamRoom {
  hostId: number;
  playersPerTeam: 2 | 3 | 4;
  timeControl: string;
  whiteTeam: TeamPlayer[];
  blackTeam: TeamPlayer[];
  status: 'waiting' | 'ongoing' | 'finished';
  chess: Chess;
  fen: string;
  currentColor: 'w' | 'b';
  whitePlayerIndex: number;
  blackPlayerIndex: number;
  whiteTimeMs: number;
  blackTimeMs: number;
  lastMoveAt: number;
  gameId: number | null;
  clockInterval: ReturnType<typeof setInterval> | null;
  disconnectTimer: ReturnType<typeof setTimeout> | null;
}

function parseTimeMs(timeControl: string): number {
  if (timeControl === 'unlimited') return Infinity;
  const minutes = parseInt(timeControl.split('+')[0]);
  return minutes * 60 * 1000;
}

function sanitizeTeam(team: TeamPlayer[]) {
  return team.map(({ userId, name, rating }) => ({ userId, name, rating }));
}

function getRoomState(room: TeamRoom) {
  return {
    whiteTeam: sanitizeTeam(room.whiteTeam),
    blackTeam: sanitizeTeam(room.blackTeam),
    playersPerTeam: room.playersPerTeam,
    status: room.status,
    timeControl: room.timeControl,
  };
}

const teamRooms = new Map<string, TeamRoom>();

function endGame(
  io: Server,
  roomId: string,
  room: TeamRoom,
  result: 'white' | 'black' | 'draw',
  reason: string,
) {
  if (room.status === 'finished') return;
  room.status = 'finished';
  if (room.clockInterval) { clearInterval(room.clockInterval); room.clockInterval = null; }
  if (room.disconnectTimer) { clearTimeout(room.disconnectTimer); room.disconnectTimer = null; }

  io.to(`team:${roomId}`).emit('team_game_over', { result, reason });

  if (room.gameId) {
    prisma.game.update({
      where: { id: room.gameId },
      data: { result, pgn: room.chess.pgn() },
    }).catch(console.error);
  }

  setTimeout(() => teamRooms.delete(roomId), 5 * 60 * 1000);
}

export const setupTeamSocket = (io: Server, socket: Socket): void => {
  const userId: number = socket.data.user.id;
  const userName: string = socket.data.user.name;
  const userRating: number = socket.data.user.rating || 1200;

  // 방 생성
  socket.on('team_room_create', ({ roomId, playersPerTeam, timeControl }: {
    roomId: string; playersPerTeam: 2 | 3 | 4; timeControl: string;
  }) => {
    if (teamRooms.has(roomId)) {
      const room = teamRooms.get(roomId)!;
      socket.join(`team:${roomId}`);
      socket.emit('team_room_created', { roomId });
      socket.emit('team_room_updated', getRoomState(room));
      return;
    }

    const timeMs = parseTimeMs(timeControl);
    const room: TeamRoom = {
      hostId: userId,
      playersPerTeam,
      timeControl,
      whiteTeam: [],
      blackTeam: [],
      status: 'waiting',
      chess: new Chess(),
      fen: new Chess().fen(),
      currentColor: 'w',
      whitePlayerIndex: 0,
      blackPlayerIndex: 0,
      whiteTimeMs: timeMs,
      blackTimeMs: timeMs,
      lastMoveAt: 0,
      gameId: null,
      clockInterval: null,
      disconnectTimer: null,
    };
    teamRooms.set(roomId, room);
    socket.join(`team:${roomId}`);
    socket.emit('team_room_created', { roomId });
    socket.emit('team_room_updated', getRoomState(room));
  });

  // 방 상태 조회 (참가/재연결)
  socket.on('team_room_get', ({ roomId }: { roomId: string }) => {
    const room = teamRooms.get(roomId);
    if (!room) {
      socket.emit('team_error', { message: '방을 찾을 수 없습니다.' });
      return;
    }

    // 재연결 시 socketId 갱신
    const tryReconnect = (team: TeamPlayer[]) => {
      const p = team.find((pl) => pl.userId === userId);
      if (p) {
        if (room.disconnectTimer) {
          clearTimeout(room.disconnectTimer);
          room.disconnectTimer = null;
          io.to(`team:${roomId}`).emit('team_player_reconnected', { name: p.name });
        }
        p.socketId = socket.id;
        return true;
      }
      return false;
    };
    tryReconnect(room.whiteTeam);
    tryReconnect(room.blackTeam);

    socket.join(`team:${roomId}`);
    socket.emit('team_room_updated', getRoomState(room));

    if (room.status === 'ongoing') {
      socket.emit('team_started', {
        fen: room.fen,
        whiteTeam: sanitizeTeam(room.whiteTeam),
        blackTeam: sanitizeTeam(room.blackTeam),
        currentColor: room.currentColor,
        whitePlayerIndex: room.whitePlayerIndex,
        blackPlayerIndex: room.blackPlayerIndex,
        whiteTimeMs: room.whiteTimeMs,
        blackTimeMs: room.blackTimeMs,
        gameId: room.gameId,
        moves: room.chess.history(),
      });
    }
  });

  // 팀 참가
  socket.on('team_room_join', ({ roomId, side }: { roomId: string; side: 'white' | 'black' }) => {
    const room = teamRooms.get(roomId);
    if (!room || room.status !== 'waiting') {
      socket.emit('team_error', { message: '방에 참가할 수 없습니다.' });
      return;
    }

    const thisTeam = side === 'white' ? room.whiteTeam : room.blackTeam;
    const existing = thisTeam.find((p) => p.userId === userId);
    if (existing) {
      existing.socketId = socket.id;
      socket.join(`team:${roomId}`);
      io.to(`team:${roomId}`).emit('team_room_updated', getRoomState(room));
      return;
    }

    room.whiteTeam = room.whiteTeam.filter((p) => p.userId !== userId);
    room.blackTeam = room.blackTeam.filter((p) => p.userId !== userId);

    const target = side === 'white' ? room.whiteTeam : room.blackTeam;
    if (target.length >= room.playersPerTeam) {
      socket.emit('team_error', { message: '팀이 가득 찼습니다.' });
      return;
    }

    target.push({ userId, name: userName, socketId: socket.id, rating: userRating });
    socket.join(`team:${roomId}`);
    io.to(`team:${roomId}`).emit('team_room_updated', getRoomState(room));
  });

  // 게임 시작 (방장)
  socket.on('team_start', async ({ roomId }: { roomId: string }) => {
    const room = teamRooms.get(roomId);
    if (!room || room.hostId !== userId || room.status !== 'waiting') return;
    if (room.whiteTeam.length !== room.playersPerTeam || room.blackTeam.length !== room.playersPerTeam) {
      socket.emit('team_error', { message: '양팀 인원이 채워지지 않았습니다.' });
      return;
    }

    room.status = 'ongoing';
    room.lastMoveAt = Date.now();

    try {
      const game = await prisma.game.create({
        data: {
          whiteId: room.whiteTeam[0].userId,
          blackId: room.blackTeam[0].userId,
          timeControl: room.timeControl,
          gameMode: 'team',
        },
      });
      room.gameId = game.id;
    } catch (e) {
      console.error('팀 게임 DB 생성 실패:', e);
    }

    if (isFinite(room.whiteTimeMs)) {
      room.clockInterval = setInterval(() => {
        if (room.status !== 'ongoing') return;
        const elapsed = Date.now() - room.lastMoveAt;
        const wMs = room.currentColor === 'w' ? Math.max(0, room.whiteTimeMs - elapsed) : room.whiteTimeMs;
        const bMs = room.currentColor === 'b' ? Math.max(0, room.blackTimeMs - elapsed) : room.blackTimeMs;

        if ((room.currentColor === 'w' && wMs <= 0) || (room.currentColor === 'b' && bMs <= 0)) {
          endGame(io, roomId, room, room.currentColor === 'w' ? 'black' : 'white', '시간 초과');
          return;
        }
        io.to(`team:${roomId}`).emit('team_time_update', { whiteTimeMs: wMs, blackTimeMs: bMs });
      }, 1000);
    }

    io.to(`team:${roomId}`).emit('team_started', {
      fen: room.fen,
      whiteTeam: sanitizeTeam(room.whiteTeam),
      blackTeam: sanitizeTeam(room.blackTeam),
      currentColor: room.currentColor,
      whitePlayerIndex: room.whitePlayerIndex,
      blackPlayerIndex: room.blackPlayerIndex,
      whiteTimeMs: room.whiteTimeMs,
      blackTimeMs: room.blackTimeMs,
      gameId: room.gameId,
      moves: [],
    });
  });

  // 말 이동
  socket.on('team_move', ({ roomId, from, to, promotion }: {
    roomId: string; from: string; to: string; promotion?: string;
  }) => {
    const room = teamRooms.get(roomId);
    if (!room || room.status !== 'ongoing') return;

    const currentTeam = room.currentColor === 'w' ? room.whiteTeam : room.blackTeam;
    const currentIdx = room.currentColor === 'w' ? room.whitePlayerIndex : room.blackPlayerIndex;
    const currentPlayer = currentTeam[currentIdx];

    if (!currentPlayer || currentPlayer.socketId !== socket.id) {
      socket.emit('team_error', { message: '지금은 당신의 차례가 아닙니다.' });
      return;
    }

    let moveResult;
    try {
      moveResult = room.chess.move({ from, to, promotion: promotion || 'q' });
    } catch {
      socket.emit('team_error', { message: '유효하지 않은 이동입니다.' });
      return;
    }

    const elapsed = Date.now() - room.lastMoveAt;
    if (room.currentColor === 'w') {
      room.whiteTimeMs = Math.max(0, room.whiteTimeMs - elapsed);
      room.whitePlayerIndex = (room.whitePlayerIndex + 1) % room.playersPerTeam;
    } else {
      room.blackTimeMs = Math.max(0, room.blackTimeMs - elapsed);
      room.blackPlayerIndex = (room.blackPlayerIndex + 1) % room.playersPerTeam;
    }

    room.currentColor = room.currentColor === 'w' ? 'b' : 'w';
    room.fen = room.chess.fen();
    room.lastMoveAt = Date.now();

    io.to(`team:${roomId}`).emit('team_state_update', {
      fen: room.fen,
      san: moveResult.san,
      from,
      to,
      currentColor: room.currentColor,
      whitePlayerIndex: room.whitePlayerIndex,
      blackPlayerIndex: room.blackPlayerIndex,
      whiteTimeMs: room.whiteTimeMs,
      blackTimeMs: room.blackTimeMs,
    });

    if (room.chess.isGameOver()) {
      let result: 'white' | 'black' | 'draw' = 'draw';
      let reason = '무승부';
      if (room.chess.isCheckmate()) {
        // currentColor is now the side that's in checkmate
        result = room.currentColor === 'w' ? 'black' : 'white';
        reason = '체크메이트';
      } else if (room.chess.isStalemate()) {
        reason = '스테일메이트';
      } else if (room.chess.isInsufficientMaterial()) {
        reason = '기물 부족';
      } else if (room.chess.isThreefoldRepetition()) {
        reason = '3회 반복';
      }
      endGame(io, roomId, room, result, reason);
    }
  });

  // 기권 (현재 차례 플레이어만)
  socket.on('team_resign', ({ roomId }: { roomId: string }) => {
    const room = teamRooms.get(roomId);
    if (!room || room.status !== 'ongoing') return;

    const currentTeam = room.currentColor === 'w' ? room.whiteTeam : room.blackTeam;
    const currentIdx = room.currentColor === 'w' ? room.whitePlayerIndex : room.blackPlayerIndex;
    const currentPlayer = currentTeam[currentIdx];

    if (!currentPlayer || currentPlayer.socketId !== socket.id) return;
    endGame(io, roomId, room, room.currentColor === 'w' ? 'black' : 'white', '기권');
  });

  // 연결 끊김: 현재 차례 플레이어면 60초 후 기권
  socket.on('disconnect', () => {
    for (const [roomId, room] of teamRooms.entries()) {
      if (room.status !== 'ongoing') continue;

      const currentTeam = room.currentColor === 'w' ? room.whiteTeam : room.blackTeam;
      const currentIdx = room.currentColor === 'w' ? room.whitePlayerIndex : room.blackPlayerIndex;
      const currentPlayer = currentTeam[currentIdx];

      if (currentPlayer?.socketId === socket.id) {
        room.disconnectTimer = setTimeout(() => {
          if (room.status === 'ongoing') {
            endGame(io, roomId, room, room.currentColor === 'w' ? 'black' : 'white', '연결 끊김');
          }
        }, 60000);

        io.to(`team:${roomId}`).emit('team_player_disconnected', {
          name: currentPlayer.name,
          secondsUntilForfeit: 60,
        });
        break;
      }
    }
  });
};
