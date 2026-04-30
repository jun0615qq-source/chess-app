import { Server, Socket } from 'socket.io';
import { filterProfanity } from '../utils/profanityFilter';

// 관전자 수 추적
const spectatorCounts = new Map<number, Set<number>>();
// 채팅 도배 방지: 유저별 마지막 메시지 시간
const lastChatTime = new Map<number, number>();

export const setupSpectatorSocket = (io: Server, socket: Socket): void => {
  const userId: number = socket.data.user.id;
  const userName: string = socket.data.user.name || socket.data.user.studentId;

  // 관전 방 입장
  socket.on('spectate_join', ({ gameId }: { gameId: number }) => {
    socket.join(`spectate:${gameId}`);

    if (!spectatorCounts.has(gameId)) {
      spectatorCounts.set(gameId, new Set());
    }
    spectatorCounts.get(gameId)!.add(userId);

    const count = spectatorCounts.get(gameId)!.size;
    io.to(`spectate:${gameId}`).emit('spectate_count_update', { count });
    io.to(`game:${gameId}`).emit('spectate_count_update', { count });
  });

  // 관전 방 퇴장
  socket.on('spectate_leave', ({ gameId }: { gameId: number }) => {
    socket.leave(`spectate:${gameId}`);

    spectatorCounts.get(gameId)?.delete(userId);
    const count = spectatorCounts.get(gameId)?.size || 0;

    io.to(`spectate:${gameId}`).emit('spectate_count_update', { count });
    io.to(`game:${gameId}`).emit('spectate_count_update', { count });
  });

  // 관전자 채팅 전송
  socket.on('spectate_chat_send', ({ gameId, message }: { gameId: number; message: string }) => {
    // 도배 방지: 3초 이내 재전송 차단
    const now = Date.now();
    const last = lastChatTime.get(userId) || 0;
    if (now - last < 3000) {
      socket.emit('chat_error', { message: '3초 후에 다시 채팅할 수 있습니다.' });
      return;
    }
    lastChatTime.set(userId, now);

    // 메시지 길이 제한 및 비속어 필터
    const trimmed = message.slice(0, 200);
    const filtered = filterProfanity(trimmed);

    // 관전자 룸에만 브로드캐스트 (플레이어 룸 제외)
    io.to(`spectate:${gameId}`).emit('spectate_chat_receive', {
      userId,
      name: userName,
      message: filtered,
      timestamp: now,
    });
  });

  // 소켓 연결 해제 시 관전 방에서 자동 제거
  socket.on('disconnect', () => {
    spectatorCounts.forEach((set, gameId) => {
      if (set.has(userId)) {
        set.delete(userId);
        const count = set.size;
        io.to(`spectate:${gameId}`).emit('spectate_count_update', { count });
        io.to(`game:${gameId}`).emit('spectate_count_update', { count });
      }
    });
  });
};
