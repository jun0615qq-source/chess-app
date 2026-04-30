import rateLimit from 'express-rate-limit';

// 로그인 시도 분당 10회 제한
export const loginLimiter = rateLimit({
  windowMs: 60 * 1000, // 1분
  max: 10,
  message: { message: '너무 많은 로그인 시도입니다. 1분 후 다시 시도해주세요.' },
  standardHeaders: true,
  legacyHeaders: false,
});
