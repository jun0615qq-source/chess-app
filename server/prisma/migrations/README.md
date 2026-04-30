# Prisma Migrations

마이그레이션은 `docker-compose up --build` 실행 시 자동으로 적용됩니다.

개발 환경에서 새 마이그레이션 생성:
```
cd server
npx prisma migrate dev --name <migration-name>
```
