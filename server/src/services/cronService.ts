import cron from 'node-cron';
import prisma from '../config/prisma';

// 기본 퍼즐 시드 데이터 (Lichess CSV 없을 경우 사용)
const DEFAULT_PUZZLES = [
  { fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4', solution: '["Ng5", "d5", "exd5", "Na5", "Bb5+", "c6", "dxc6", "bxc6", "Be2"]', difficulty: 'easy', theme: '핀' },
  { fen: '6k1/pp4pp/2p5/2bp4/5pP1/P1PB1P1P/1P6/3K4 b - - 0 1', solution: '["f3", "Be2", "f2", "Bxf2", "d4"]', difficulty: 'medium', theme: '폰 프로모션' },
  { fen: '4r1k1/pp3ppp/2p5/8/3Q4/1P4P1/P4P1P/3R2K1 w - - 0 1', solution: '["Qd8+", "Rxd8", "Rxd8#"]', difficulty: 'easy', theme: '백랭크메이트' },
  { fen: 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1', solution: '["Nxe6", "Qh4", "Nxg7+", "Kd8", "Bc4"]', difficulty: 'hard', theme: '포크' },
  { fen: '5r1k/pp4pp/4p3/2R3Q1/3n4/2q4r/P1P2PPP/1R4K1 b - - 0 1', solution: '["Rxh2", "Kxh2", "Qh3+", "Kg1", "Rh8#"]', difficulty: 'hard', theme: '희생' },
  { fen: '8/8/8/8/2k5/8/2K1Q3/8 w - - 0 1', solution: '["Qe4+", "Kb5", "Qb4+", "Ka6", "Qa4#"]', difficulty: 'easy', theme: '엔드게임' },
  { fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3', solution: '["Bb5", "a6", "Bxc6", "dxc6", "Nxe5"]', difficulty: 'medium', theme: '스큐어' },
  { fen: '3r1rk1/1pp2ppp/p7/4Pb2/8/1BP5/PP3PPP/R4RK1 b - - 0 1', solution: '["Bxc2", "Rxc2", "Rd1", "Rxd1", "Rxd1+"]', difficulty: 'medium', theme: '이중 공격' },
  { fen: 'r2q1rk1/4bppp/p2p1n2/np2p3/3PP3/2P1BN2/PP2BPPP/R2Q1RK1 b - - 0 1', solution: '["Nxd4", "cxd4", "Nxd4", "Bxd4", "exd4"]', difficulty: 'hard', theme: '조합' },
  { fen: '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1', solution: '["Ra8+", "Kh7", "Ra7", "Kg6", "Rxf7"]', difficulty: 'easy', theme: '루크 엔드게임' },
  { fen: '4k3/R7/8/8/8/8/8/4K3 w - - 0 1', solution: '["Ra8#"]', difficulty: 'easy', theme: '메이트인1' },
  { fen: 'r1bq1rk1/ppp2ppp/2np1n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQK2R w KQ - 4 7', solution: '["Bxf7+", "Rxf7", "Ng5", "Rf8", "Qh5"]', difficulty: 'hard', theme: '희생' },
  { fen: '8/8/8/5k2/8/5K2/8/5R2 w - - 0 1', solution: '["Rf5+", "Ke6", "Re5+", "Kd6", "Re1"]', difficulty: 'medium', theme: '루크 엔드게임' },
  { fen: 'r2qkb1r/ppp2ppp/2n1pn2/3p4/3P4/2N1PN2/PPP2PPP/R1BQKB1R w KQkq - 2 6', solution: '["Bb5", "Bd7", "Bxc6", "Bxc6", "Ne5"]', difficulty: 'medium', theme: '교환 이득' },
  { fen: '1k6/pp6/8/8/8/8/PP6/1K4R1 w - - 0 1', solution: '["Rg8+", "Ka7", "Ra8+", "Kxa8", "b4"]', difficulty: 'hard', theme: '조합' },
  { fen: 'r3r1k1/pp3ppp/2p5/8/3Q4/8/PPP2PPP/R3R1K1 w - - 0 1', solution: '["Qd8", "Rxd8", "Rxd8", "Rxd8", "Rxd8#"]', difficulty: 'medium', theme: '백랭크' },
  { fen: '6k1/R7/6K1/8/8/8/8/8 w - - 0 1', solution: '["Ra8+", "Kh7", "Ra7+", "Kg8", "Rg7#"]', difficulty: 'easy', theme: '메이트인3' },
  { fen: 'r1bqkb1r/pp3ppp/2np1n2/4p3/2BPP3/2N2N2/PPP2PPP/R1BQK2R b KQkq - 0 6', solution: '["Nxd4", "Nxd4", "exd4", "Bxd4", "Qxd4"]', difficulty: 'hard', theme: '핀 깨기' },
  { fen: '8/8/8/4k3/4P3/4K3/8/8 w - - 0 1', solution: '["Kd3", "Kd5", "e5", "Ke6", "Ke4"]', difficulty: 'medium', theme: '킹 엔드게임' },
  { fen: 'r1bq1rk1/ppp2ppp/2n2n2/3p4/1bBPP3/2N2N2/PPP2PPP/R1BQ1RK1 b - - 0 7', solution: '["Nxe4", "Nxe4", "dxe4", "Bxc3", "bxc3"]', difficulty: 'hard', theme: '조합' },
];

// 매일 자정 퍼즐 자동 등록
export const setupCronJobs = (): void => {
  cron.schedule('0 0 * * *', async () => {
    console.log('일일 퍼즐 등록 시작...');
    await registerDailyPuzzle();
  });

  // 서버 시작 시 오늘 퍼즐 없으면 즉시 등록
  registerDailyPuzzle().catch(console.error);
};

const registerDailyPuzzle = async (): Promise<void> => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // 이미 오늘 퍼즐이 있으면 스킵
  const existing = await prisma.puzzle.findFirst({
    where: { date: { gte: today, lt: tomorrow } },
  });
  if (existing) return;

  // 최근 사용한 퍼즐 제외하고 무작위 선택
  const usedCount = await prisma.puzzle.count();
  const pool = DEFAULT_PUZZLES;
  const randomIndex = Math.floor(Math.random() * pool.length);
  const selected = pool[randomIndex];

  try {
    await prisma.puzzle.create({
      data: {
        date: today,
        fen: selected.fen,
        solution: selected.solution,
        difficulty: selected.difficulty,
        theme: selected.theme,
      },
    });
    console.log(`오늘의 퍼즐 등록 완료: ${selected.theme} (${selected.difficulty})`);
  } catch (error) {
    console.error('퍼즐 등록 오류:', error);
  }
};
