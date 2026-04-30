import { Server, Socket } from 'socket.io';
import { verifySocketToken } from '../middleware/auth';
import { setupGameSocket } from './gameSocket';
import { setupSpectatorSocket } from './spectatorSocket';
import { setupMultiSocket } from './multiSocket';
import { setupTeamSocket } from './teamSocket';
import { setupTournamentSocket } from './tournamentSocket';

// 소켓 핸들러 전체 초기화
export const setupSocketHandlers = (io: Server): void => {
  // JWT 인증 미들웨어 (소켓 연결 시 검증)
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      next(new Error('인증 토큰이 없습니다.'));
      return;
    }

    const user = verifySocketToken(token);
    if (!user) {
      next(new Error('유효하지 않은 토큰입니다.'));
      return;
    }

    socket.data.user = user;
    next();
  });

  io.on('connection', (socket: Socket) => {
    console.log(`소켓 연결: ${socket.data.user?.name} (${socket.id})`);

    // 각 기능별 소켓 이벤트 등록
    setupGameSocket(io, socket);
    setupSpectatorSocket(io, socket);
    setupMultiSocket(io, socket);
    setupTeamSocket(io, socket);
    setupTournamentSocket(io, socket);

    socket.on('disconnect', () => {
      console.log(`소켓 연결 해제: ${socket.data.user?.name} (${socket.id})`);
    });
  });
};
