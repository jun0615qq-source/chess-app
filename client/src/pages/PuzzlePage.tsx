import { useState, useEffect, useCallback } from 'react';
import { Chess } from 'chess.js';
import { CheckCircle, XCircle, Eye } from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { ChessBoard } from '../components/board/ChessBoard';
import { sounds } from '../utils/sound';
import { useSettingsStore } from '../store/settingsStore';
import api from '../utils/api';
import { Puzzle, PuzzleResult } from '../types';

const POINTS: Record<string, number> = { easy: 5, medium: 10, hard: 20 };
const DIFF_LABELS: Record<string, string> = { easy: '쉬움', medium: '보통', hard: '어려움' };
const MAX_WRONG = 3;
const DEFAULT_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export const PuzzlePage = () => {
  const { soundEnabled } = useSettingsStore();

  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [myResult, setMyResult] = useState<PuzzleResult | null>(null);
  const [chess] = useState(() => new Chess());
  const [fen, setFen] = useState(DEFAULT_FEN);
  const [solution, setSolution] = useState<string[]>([]);
  const [moveIndex, setMoveIndex] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [solved, setSolved] = useState(false);
  const [showSolution, setShowSolution] = useState(false);
  const [shake, setShake] = useState(false);
  const [orientation, setOrientation] = useState<'white' | 'black'>('white');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPuzzle = async () => {
      try {
        const res = await api.get('/api/puzzles/today');
        const { puzzle: p, myResult: mr } = res.data;
        setPuzzle(p);
        setMyResult(mr || null);

        // solution 항상 세팅
        const sol: string[] = Array.isArray(p.solution) ? p.solution : [];
        setSolution(sol);

        // FEN 로드
        try {
          chess.load(p.fen);
          setFen(p.fen);
        } catch {
          setFen(DEFAULT_FEN);
        }

        if (mr) {
          // 이미 풀었으면 결과만 표시
          setSolved(mr.solved);
          if (mr.solved) setShowSolution(true);
        } else {
          // 보드 방향: 두는 쪽 기준
          setOrientation(chess.turn() === 'w' ? 'white' : 'black');
        }
      } catch {
        toast.error('퍼즐을 불러올 수 없습니다.');
      } finally {
        setLoading(false);
      }
    };
    fetchPuzzle();
  }, [chess]);

  const handleMove = useCallback((from: string, to: string, promotion?: string): boolean => {
    if (!puzzle || solved || showSolution || myResult) return false;
    if (solution.length === 0) return false;

    try {
      const tempChess = new Chess(fen);
      const move = tempChess.move({ from, to, promotion: promotion || 'q' });
      if (!move) return false;

      const expectedSan = solution[moveIndex];
      if (!expectedSan) return false;

      // SAN 또는 UCI(e2e4) 형식으로 비교
      const uci = `${from}${to}${promotion || ''}`;
      const isCorrect = move.san === expectedSan || uci === expectedSan;

      if (isCorrect) {
        // 정답 수 적용
        chess.load(fen);
        chess.move({ from, to, promotion: promotion || 'q' });
        setFen(chess.fen());
        if (soundEnabled) sounds.move();

        const nextIndex = moveIndex + 1;

        if (nextIndex >= solution.length) {
          // 모든 수 완료 - 성공
          setSolved(true);
          setShowSolution(true);
          if (soundEnabled) sounds.gameEnd();
          submitPuzzle(true);
        } else {
          setMoveIndex(nextIndex);
          // 상대방 응수 자동 재생
          setTimeout(() => {
            const opponentSan = solution[nextIndex];
            if (opponentSan) {
              try {
                chess.move(opponentSan);
                setFen(chess.fen());
                setMoveIndex(nextIndex + 1);
                if (soundEnabled) sounds.move();
              } catch {}
            }
          }, 500);
        }
        return true;
      } else {
        // 오답
        if (soundEnabled) sounds.illegal();
        setShake(true);
        setTimeout(() => setShake(false), 600);
        const newWrong = wrongCount + 1;
        setWrongCount(newWrong);
        if (newWrong >= MAX_WRONG) {
          toast.error('3회 오답! 정답 공개 버튼이 활성화되었습니다.');
        }
        return false;
      }
    } catch {
      return false;
    }
  }, [puzzle, solved, showSolution, myResult, solution, moveIndex, fen, chess, soundEnabled, wrongCount]);

  const submitPuzzle = async (success: boolean) => {
    if (!puzzle) return;
    try {
      await api.post(`/api/puzzles/${puzzle.id}/submit`, {
        solved: success,
        attempts: wrongCount + 1,
      });
    } catch {}
  };

  const handleRevealSolution = async () => {
    if (!puzzle) return;
    setShowSolution(true);
    await submitPuzzle(false);
    // 정답 수 순차 재생
    chess.load(puzzle.fen);
    setFen(chess.fen());
    let idx = 0;
    const playNext = () => {
      if (idx >= solution.length) return;
      try {
        chess.move(solution[idx]);
        setFen(chess.fen());
        idx++;
        setTimeout(playNext, 700);
      } catch {}
    };
    setTimeout(playNext, 400);
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-4">
        <h1 className="text-xl font-bold mb-4">일일 퍼즐</h1>
        <div className="flex gap-4 items-start">
          {/* 보드 플레이스홀더 */}
          <div className="flex-shrink-0 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"
            style={{ width: 480, height: 480 }} />
          <div className="flex-1 card">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-2" />
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-2/3" />
          </div>
        </div>
      </div>
    );
  }

  if (!puzzle) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 text-center">
        <p className="text-gray-500">오늘의 퍼즐이 준비되지 않았습니다.</p>
      </div>
    );
  }

  const today = new Date(puzzle.date).toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  const isDisabled = solved || !!myResult || showSolution;

  return (
    <div className="max-w-5xl mx-auto px-4 py-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold">일일 퍼즐</h1>
          <p className="text-sm text-gray-500">{today} · #{puzzle.id}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={clsx(
            'text-xs font-bold px-2 py-1 rounded-full',
            puzzle.difficulty === 'easy' && 'bg-green-100 text-green-700',
            puzzle.difficulty === 'medium' && 'bg-yellow-100 text-yellow-700',
            puzzle.difficulty === 'hard' && 'bg-red-100 text-red-700',
          )}>
            {DIFF_LABELS[puzzle.difficulty] ?? puzzle.difficulty}
          </span>
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">
            {puzzle.theme}
          </span>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-start">
        {/* 체스 보드 */}
        <div className={clsx('flex-shrink-0', shake && 'animate-shake')}>
          <ChessBoard
            fen={fen}
            orientation={orientation}
            onMove={handleMove}
            disabled={isDisabled}
            boardWidth={480}
          />
        </div>

        {/* 우측 패널 */}
        <div className="flex-1 flex flex-col gap-3 min-w-0">
          {/* 풀이 안내 */}
          {!isDisabled && (
            <div className="card">
              <h3 className="font-semibold mb-1">
                {orientation === 'white' ? '⬜ 백이 두세요' : '⬛ 흑이 두세요'}
              </h3>
              <p className="text-sm text-gray-500">최선의 수를 찾아보세요!</p>
              <p className="text-sm text-red-500 mt-2">오답: {wrongCount}/{MAX_WRONG}</p>
            </div>
          )}

          {/* 정답 공개 버튼 */}
          {wrongCount >= MAX_WRONG && !solved && !showSolution && !myResult && (
            <button
              onClick={handleRevealSolution}
              className="btn-secondary flex items-center gap-2 justify-center"
            >
              <Eye size={16} /> 정답 보기
            </button>
          )}

          {/* 성공/실패 결과 */}
          {(solved || showSolution) && (
            <div className={clsx(
              'card border-2',
              solved ? 'border-green-500' : 'border-red-400',
            )}>
              <div className="flex items-center gap-2 mb-2">
                {solved
                  ? <CheckCircle className="text-green-500" size={20} />
                  : <XCircle className="text-red-500" size={20} />
                }
                <h3 className="font-bold text-lg">{solved ? '정답!' : '오답'}</h3>
              </div>
              {solved && (
                <p className="text-green-600 font-semibold mb-2">
                  +{POINTS[puzzle.difficulty] ?? 0}점 획득
                </p>
              )}
              <p className="text-sm text-gray-500 mb-1">정답 수:</p>
              <div className="flex gap-1 flex-wrap">
                {solution.map((san, i) => (
                  <span
                    key={i}
                    className="font-mono text-sm bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded"
                  >
                    {Math.floor(i / 2) + 1}{i % 2 === 0 ? '.' : '...'} {san}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 이미 오늘 풀었을 때 */}
          {myResult && !solved && !showSolution && (
            <div className="card border-2 border-gray-300">
              <p className="font-medium mb-1">오늘의 퍼즐을 이미 완료했습니다.</p>
              <p className="text-sm text-gray-500">
                결과: {myResult.solved ? '✅ 성공' : '❌ 실패'} · 획득 포인트: {myResult.pointsEarned}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
