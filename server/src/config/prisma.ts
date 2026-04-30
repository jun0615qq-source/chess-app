import { PrismaClient } from '@prisma/client';

// 싱글톤 Prisma 클라이언트
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error'] : ['error'],
});

export default prisma;
