import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { setupSocketHandlers } from './socket';
import authRouter from './routes/auth';
import gameRouter from './routes/game';
import puzzleRouter from './routes/puzzle';
import tournamentRouter from './routes/tournament';
import leagueRouter from './routes/league';
import leaderboardRouter from './routes/leaderboard';
import profileRouter from './routes/profile';
import { authMiddleware } from './middleware/auth';
import { setupCronJobs } from './services/cronService';
import { loginLimiter, registerLimiter } from './middleware/rateLimiter';

dotenv.config();

const app = express();
const httpServer = createServer(app);

// 허용 오리진 목록 (쉼표 구분 지원)
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:3000')
  .split(',').map(o => o.trim());

function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  if (/^http:\/\/localhost:\d+$/.test(origin)) return true;
  return false;
}

// Socket.io 설정 - CORS 허용
const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      callback(isAllowedOrigin(origin) ? null : new Error('CORS'), isAllowedOrigin(origin));
    },
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// 미들웨어 설정
app.use(cors({
  origin: (origin, callback) => {
    callback(isAllowedOrigin(origin) ? null : new Error('CORS'), isAllowedOrigin(origin));
  },
  credentials: true,
}));
app.use(express.json());

// 라우터 등록
app.use('/api/auth/login', loginLimiter);
app.use('/api/auth/register', registerLimiter);
app.use('/api/auth', authRouter);
app.use('/api/games', authMiddleware, gameRouter);
app.use('/api/puzzles', authMiddleware, puzzleRouter);
app.use('/api/tournaments', authMiddleware, tournamentRouter);
app.use('/api/leagues', authMiddleware, leagueRouter);
app.use('/api/leaderboard', authMiddleware, leaderboardRouter);
app.use('/api/profile', authMiddleware, profileRouter);

// 헬스체크
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 소켓 핸들러 등록
setupSocketHandlers(io);

// Cron Job 설정 (일일 퍼즐 자동 등록)
setupCronJobs();

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
  console.log(`🚀 서버가 포트 ${PORT}에서 실행 중입니다.`);
});

export { io };
