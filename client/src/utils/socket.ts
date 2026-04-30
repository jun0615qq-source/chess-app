import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

// 소켓 인스턴스 생성 (싱글톤)
export const getSocket = (): Socket => {
  if (!socket) {
    const stored = localStorage.getItem('chess-auth');
    const token = stored ? JSON.parse(stored).state?.accessToken : null;

    socket = io(import.meta.env.VITE_SOCKET_URL || '', {
      auth: { token },
      autoConnect: false,
    });
  }
  return socket;
};

// 소켓 연결
export const connectSocket = (): void => {
  const s = getSocket();
  if (!s.connected) s.connect();
};

// 소켓 연결 해제
export const disconnectSocket = (): void => {
  if (socket?.connected) {
    socket.disconnect();
    socket = null;
  }
};

// 토큰 갱신 후 소켓 재연결
export const reconnectSocket = (newToken: string): void => {
  if (socket) {
    socket.auth = { token: newToken };
    socket.disconnect().connect();
  }
};
