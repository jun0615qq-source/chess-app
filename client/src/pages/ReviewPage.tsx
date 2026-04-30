import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Chess } from 'chess.js';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { ChessBoard } from '../components/board/ChessBoard';
import { MoveList } from '../components/board/MoveList';
import { EvalBar } from '../components/board/EvalBar';
import api from '../utils/api';
import { Game, AnalyzedMove, MoveClassification } from '../types';

// centipawn 차이에 따른 수 분류
const classifyMove = (scoreBefore: number, scoreAfter: number, isWhiteTurn: boolean): MoveClassification => {
  const before = isWhiteTurn ? scoreBefore : -scoreBefore;
  const after = isWhiteTurn ? scoreAfter : -scoreAfter;
  const loss = before - after;

  if (loss <= 0) return 'best';
  if (loss <= 10) return 'excellent';
  if (loss <= 25) return 'good';
  if (loss <= 50) return 'inaccuracy';
  if (loss <= 100) return 'mistake';
  return 'blunder';
};

const CLASSIFICATION_LABELS: Record<MoveClassification, { ko: string; color: string; symbol: string }> = {
  best:       { ko: '최선수', color: 'text-green-500',  symbol: '★' },
  excellent:  { ko: '우수',   color: 'text-teal-400',   symbol: '✓✓' },
  good:       { ko: '양호',   color: 'text-blue-400',   symbol: '✓' },
  inaccuracy: { ko: '부정확', color: 'text-yellow-400', symbol: '?!' },
  mistake:    { ko: '실수',   color: 'text-orange-400', symbol: '?' },
  blunder:    { ko: '대실수', color: 'text-red-400',    symbol: '??' },
};

// IndexedDB 캐시 유틸리티
const openDB = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const req = indexedDB.open('chess_analysis', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('analysis', { keyPath: 'key' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = reject;
  });

const saveToCache = async (key: string, data: AnalyzedMove[]): Promise<void> => {
  try {
    const db = await openDB();
    const tx = db.transaction('analysis', 'readwrite');
    tx.objectStore('analysis').put({ key, data, timestamp: Date.now() });
  } catch {}
};

const loadFromCache = async (key: string): Promise<AnalyzedMove[] | null> => {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction('analysis', 'readonly');
      const req = tx.objectStore('analysis').get(key);
      req.onsuccess = () => resolve(req.result?.data ?? null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
};

// Stockfish 워커로 단일 포지션 분석 (Promise 기반)
const analyzePosition = (
  worker: Worker,
  fen: string,
  depth: number
): Promise<{ score: number; bestMove: string }> => {
  return new Promise((resolve) => {
    let bestScore = 0;
    let bestMv = '';
    let settled = false;

    const handler = (e: MessageEvent<string>) => {
      const line: string = e.data;

      if (line.startsWith('bestmove')) {
        if (!settled) {
          settled = true;
          worker.removeEventListener('message', handler);
          resolve({ score: bestScore, bestMove: line.split(' ')[1] ?? '' });
        }
        return;
      }

      // info depth N ... score cp X ... pv MOVE
      if (!line.includes(`depth ${depth}`)) return;

      const cpMatch = line.match(/score cp (-?\d+)/);
      const mateMatch = line.match(/score mate (-?\d+)/);
      const pvMatch = line.match(/ pv (\S+)/);

      if (cpMatch) {
        bestScore = parseInt(cpMatch[1], 10);
        bestMv = pvMatch?.[1] ?? '';
      } else if (mateMatch) {
        const m = parseInt(mateMatch[1], 10);
        bestScore = m > 0 ? 10000 : -10000;
        bestMv = pvMatch?.[1] ?? '';
      }
    };

    worker.addEventListener('message', handler);
    worker.postMessage(`position fen ${fen}`);
    worker.postMessage(`go depth ${depth}`);
  });
};

export const ReviewPage = () => {
  const { gameId } = useParams<{ gameId: string }>();
  const id = parseInt(gameId!);

  const [game, setGame] = useState<Game | null>(null);
  const [analyzedMoves, setAnalyzedMoves] = useState<AnalyzedMove[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [currentScore, setCurrentScore] = useState(0);

  const chessRef = useRef(new Chess());
  const stockfishRef = useRef<Worker | null>(null);

  // 게임 로드
  useEffect(() => {
    api.get(`/api/games/${id}`)
      .then((res) => setGame(res.data))
      .catch(() => toast.error('게임을 불러올 수 없습니다.'));
  }, [id]);

  // Stockfish 분석
  useEffect(() => {
    if (!game?.pgn) return;

    const runAnalysis = async () => {
      const cacheKey = `review_${id}`;
      const cached = await loadFromCache(cacheKey);
      if (cached && cached.length > 0) {
        setAnalyzedMoves(cached);
        chessRef.current.loadPgn(game.pgn);
        setCurrentScore(cached[0]?.scoreAfter ?? 0);
        return;
      }

      setIsAnalyzing(true);

      try {
        // Stockfish Worker 생성
        const worker = new Worker('/stockfish.js');
        stockfishRef.current = worker;

        // 초기화
        await new Promise<void>((res) => {
          const init = (e: MessageEvent<string>) => {
            if (e.data === 'readyok') {
              worker.removeEventListener('message', init);
              res();
            }
          };
          worker.addEventListener('message', init);
          worker.postMessage('uci');
          worker.postMessage('setoption name Threads value 1');
          worker.postMessage('isready');
        });

        chessRef.current.loadPgn(game.pgn);
        const history = chessRef.current.history({ verbose: true });
        const results: AnalyzedMove[] = [];
        const tempChess = new Chess();
        let prevScore = 0;

        for (let i = 0; i < history.length; i++) {
          const fen = tempChess.fen();
          const isWhiteTurn = tempChess.turn() === 'w';

          const { score, bestMove } = await analyzePosition(worker, fen, 18);

          const classification = classifyMove(prevScore, score, isWhiteTurn);

          results.push({
            san: history[i].san,
            fen,
            classification,
            scoreBefore: prevScore,
            scoreAfter: score,
            bestMove,
            bestScore: score,
          });

          tempChess.move(history[i]);
          prevScore = -score; // 다음 플레이어 관점으로 전환

          setAnalysisProgress(Math.round(((i + 1) / history.length) * 100));
        }

        worker.terminate();
        stockfishRef.current = null;

        setAnalyzedMoves(results);
        if (results[0]) setCurrentScore(results[0].scoreAfter);
        await saveToCache(cacheKey, results);
      } catch (err) {
        console.error('Stockfish 분석 오류:', err);
        toast.error('엔진 분석 실패. stockfish.js 파일이 public 폴더에 있는지 확인하세요.');
      } finally {
        setIsAnalyzing(false);
      }
    };

    runAnalysis();

    return () => {
      stockfishRef.current?.terminate();
      stockfishRef.current = null;
    };
  }, [game, id]);

  // 수 이동
  const goToMove = useCallback((index: number) => {
    const clamped = Math.max(0, Math.min(analyzedMoves.length - 1, index));
    setCurrentIndex(clamped);
    const m = analyzedMoves[clamped];
    if (m) setCurrentScore(m.scoreAfter);
  }, [analyzedMoves]);

  // 키보드 탐색
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goToMove(currentIndex - 1);
      if (e.key === 'ArrowRight') goToMove(currentIndex + 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [currentIndex, goToMove]);

  // 정확도 통계
  const stats = analyzedMoves.reduce((acc, m) => {
    acc[m.classification] = (acc[m.classification] || 0) + 1;
    return acc;
  }, {} as Record<MoveClassification, number>);

  const accuracy = analyzedMoves.length > 0
    ? Math.round(
        ((stats.best || 0) + (stats.excellent || 0) + (stats.good || 0))
        / analyzedMoves.length * 100
      )
    : 0;

  const currentFen = analyzedMoves[currentIndex]?.fen
    ?? (game?.pgn ? chessRef.current.fen() : 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');

  return (
    <div className="max-w-6xl mx-auto px-4 py-4">
      <h1 className="text-xl font-bold mb-4">게임 분석</h1>

      {/* 분석 진행 바 */}
      {isAnalyzing && (
        <div className="mb-4">
          <p className="text-sm text-gray-500 mb-1">Stockfish 분석 중... {analysisProgress}%</p>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${analysisProgress}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex gap-4 items-start">
        {/* 좌측: 평가 막대 + 보드 */}
        <div className="flex flex-col gap-2 flex-shrink-0">
          <div className="flex gap-2 items-start">
            <EvalBar score={currentScore} orientation="white" />
            <ChessBoard fen={currentFen} orientation="white" disabled reviewMode boardWidth={480} />
          </div>

          {/* 탐색 버튼 */}
          <div className="flex gap-1 justify-center">
            {[
              { icon: <ChevronsLeft size={16} />, action: () => goToMove(0) },
              { icon: <ChevronLeft size={16} />, action: () => goToMove(currentIndex - 1) },
              { icon: <ChevronRight size={16} />, action: () => goToMove(currentIndex + 1) },
              { icon: <ChevronsRight size={16} />, action: () => goToMove(analyzedMoves.length - 1) },
            ].map((btn, i) => (
              <button key={i} onClick={btn.action} className="btn-secondary p-2">{btn.icon}</button>
            ))}
          </div>

          <p className="text-xs text-center text-gray-400">← → 키로도 탐색 가능</p>
        </div>

        {/* 우측 패널 */}
        <div className="flex-1 flex flex-col gap-3">
          {/* 현재 수 상세 */}
          {analyzedMoves[currentIndex] && (
            <div className="card">
              <h3 className="text-sm font-semibold mb-2">현재 수 분석</h3>
              {(() => {
                const m = analyzedMoves[currentIndex];
                const cls = CLASSIFICATION_LABELS[m.classification];
                return (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-lg">{m.san}</span>
                      <span className={`text-sm font-bold ${cls.color}`}>
                        {cls.symbol} {cls.ko}
                      </span>
                    </div>
                    <div className="text-right text-xs text-gray-500">
                      <p>평가: {(m.scoreAfter / 100).toFixed(2)}</p>
                      {m.bestMove && <p>최선: {m.bestMove}</p>}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* 기보 패널 */}
          <div className="card overflow-hidden" style={{ maxHeight: 320 }}>
            <MoveList
              moves={analyzedMoves.map((m) => ({ san: m.san, classification: m.classification }))}
              currentMoveIndex={currentIndex}
              onMoveClick={goToMove}
              showClassification
            />
          </div>

          {/* 분석 요약 */}
          {!isAnalyzing && analyzedMoves.length > 0 && (
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold">분석 요약</h3>
                <span className="text-2xl font-bold text-blue-600">{accuracy}% 정확도</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(Object.entries(CLASSIFICATION_LABELS) as [MoveClassification, (typeof CLASSIFICATION_LABELS)[MoveClassification]][])
                  .map(([key, cls]) => (
                    <div key={key} className="text-center bg-gray-50 dark:bg-gray-700 rounded-lg py-2">
                      <p className={`text-xl font-bold ${cls.color}`}>{stats[key] || 0}</p>
                      <p className="text-xs text-gray-500">{cls.ko}</p>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
