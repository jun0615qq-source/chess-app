import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('시드 데이터 생성 시작...');

  // 관리자 계정 생성
  const adminPassword = await bcrypt.hash('admin1234', 12);
  const admin = await prisma.user.upsert({
    where: { studentId: 'admin' },
    update: {},
    create: {
      studentId: 'admin',
      name: '관리자',
      password: adminPassword,
      role: 'admin',
      rating: 2000,
    },
  });
  console.log(`관리자 계정 생성: ${admin.name}`);

  // 테스트 학생 계정 생성
  const studentPassword = await bcrypt.hash('test1234', 12);
  for (let i = 1; i <= 5; i++) {
    const student = await prisma.user.upsert({
      where: { studentId: `2024${String(i).padStart(3, '0')}` },
      update: {},
      create: {
        studentId: `2024${String(i).padStart(3, '0')}`,
        name: `학생${i}`,
        password: studentPassword,
        rating: 1200 + i * 50,
      },
    });
    console.log(`학생 계정 생성: ${student.name} (레이팅: ${student.rating})`);
  }

  console.log('시드 데이터 생성 완료!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
