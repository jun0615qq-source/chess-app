@echo off
echo ========================================
echo  학급 체스 - 개발 서버 시작
echo ========================================

:: PostgreSQL이 로컬에 설치된 경우 사용
:: 설치 안 된 경우: https://www.postgresql.org/download/windows/

:: 서버 .env 파일 확인
if not exist server\.env (
    copy .env.example server\.env
    echo [INFO] server\.env 파일 생성됨
)

echo.
echo [1/2] 서버 시작 중...
start "Chess Server" cmd /k "cd server && npm install && npx prisma generate && npx prisma migrate dev --name init && npm run dev"

timeout /t 5 /nobreak > nul

echo [2/2] 클라이언트 시작 중...
start "Chess Client" cmd /k "cd client && npm run dev"

echo.
echo ========================================
echo  서버:    http://localhost:4000
echo  클라이언트: http://localhost:3000
echo ========================================
pause
