import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Chess } from 'chess.js';
import { Flag, Handshake, RotateCcw, FlipVertical } from 'lucide-react';
import toast from 'react-hot-toast';
import { ChessBoard } from '../components/board/ChessBoard';
import { GameTimer } from '../components/board/GameTimer';
import { MoveList } from '../components/board/MoveList';
import { GameOverModal } from '../components/modals/GameOverModal';
import { SpectatorChat } from '../components/chat/SpectatorChat';
import { useAuthStore } from '../store/authStore';
import { useSettingsStore } from '../store/settingsStore';
import { getSocket, connectSocket } from '../utils/socket';
import { sounds } from '../utils/sound';
import api from '../utils/api';
import { Game } from '../types';

interface GameOverData {
  result: 'white' | 'black' | 'draw';
  reason: string;
  whiteRating: { before: number; after: number; change: number };
  blackRating: { before: number; after: number; change: number };
}

export const GamePage = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const { soundEnabled } = useSettingsStore();
  const navigate = useNavigate();
  const gameId = parseInt(id!);

  const [game, setGame] = useState<Game | null>(null);
  const [fen, setFen] = useState('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  const [chess] = useState(() => new Chess());
  const [moves, setMoves] = useState<{ san: string }[]>([]);
  const [whiteTime, setWhiteTime] = useState(300);
  const [blackTime, setBlackTime] = useState(300);
  const [currentTurn, setCurrentTurn] = useState<'w' | 'b'>('w');
  const [orientation, setOrientation] = useState<'white' | 'black'>('white');
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | undefined>();
  const [premove, setPremove] = useState<{ from: string; to: string } | undefined>();
  const [gameOver, setGameOver] = useState<GameOverData | null>(null);
  const [spectatorCount, setSpectatorCount] = useState(0);
  const [isSpectator, setIsSpectator] = useState(false);
  const [drawOffered, setDrawOffered] = useState(false);
  const [reviewIndex, setReviewIndex] = useState(-1); // -1 = 현재 수

  const socket = getSocket();

  // 게임 정보 로드
  useEffect(() => {
    const fetchGame = async () => {
      try {
        const res = await api.get(`/api/games/${gameId}`);
        const g: Game = res.data;
        setGame(g);

        const isPlayer = g.whiteId === user?.id || g.blackId === user?.id;
        setIsSpectator(!isPlayer);

        if (g.blackId === user?.id) setOrientation('black');

        if (g.pgn) {
          chess.loadPgn(g.pgn);
          const history = chess.history({ verbose: true });
          setMoves(history.map((m) => ({ san: m.san })));
          setFen(chess.fen());
          setCurrentTurn(chess.turn());
        }
      } catch {
        toast.error('게임을 불러올 수 없습니다.');
        navigate('/');
      }
    };

    fetchGame();
  }, [gameId, user, navigate]);

  // 소켓 연결 및 이벤트 등록
  useEffect(() => {
    connectSocket();

    if (isSpectator) {
      socket.emit('spectate_join', { gameId });
    } else {
      socket.emit('game_join', { gameId });
    }

    // 상대방 이동 수신
    socket.on('move', ({ from, to, san, fen: newFen, pgn }: {
      from: string; to: string; san: string; fen: string; pgn?: string;
    }) => {
      chess.load(newFen);
      setFen(newFen);
      setLastMove({ from, to });
      setMoves((prev) => [...prev, { san }]);
      setCurrentTurn(chess.turn());
      setPremove(undefined);

      if (soundEnabled) {
        if (chess.inCheck()) sounds.check();
        else if (san.includes('x')) sounds.capture();
        else sounds.move();
      }
    });

    // 타이머 업데이트
    socket.on('time_update', ({ whiteTime: wt, blackTime: bt }: { whiteTime: number; blackTime: number }) => {
      setWhiteTime(wt);
      setBlackTime(bt);
    });

    // 게임 종료
    socket.on('game_over', (data: GameOverData) => {
      setGameOver(data);
      if (soundEnabled) sounds.gameEnd();
    });

    // 무승부 제안 수신
    socket.on('draw_offer', () => {
      setDrawOffered(true);
      toast('상대방이 무승부를 제안했습니다.', { icon: '🤝' });
    });

    socket.on('draw_declined', () => {
      toast.error('무승부가 거절되었습니다.');
    });

    // 관전자 수 업데이트
    socket.on('spectate_count_update', ({ count }: { count: number }) => {
      setSpectatorCount(count);
    });

    // 게임 상태 초기화 수신
    socket.on('game_state', ({ fen: f, pgn, whiteTime: wt, blackTime: bt, turn }: {
      fen: string; pgn: string; whiteTime: number; blackTime: number; turn: 'w' | 'b';
    }) => {
      chess.loadPgn(pgn || '');
      setFen(f);
      setMoves(chess.history({ verbose: true }).map((m) => ({ san: m.san })));
      setWhiteTime(wt);
      setBlackTime(bt);
      setCurrentTurn(turn);
    });

    return () => {
      if (isSpectator) socket.emit('spectate_leave', { gameId });
      socket.off('move');
      socket.off('time_update');
      socket.off('game_over');
      socket.off('draw_offer');
      socket.off('draw_declined');
      socket.off('spectate_count_update');
      socket.off('game_state');
    };
  }, [gameId, isSpectator, socket, chess, soundEnabled]);

  // 이동 처리 (서버로 전송 후 서버 검증)
  const handleMove = useCallback((from: string, to: string, promotion?: string): boolean => {
    if (!game || gameOver || isSpectator) return false;
    if (reviewIndex !== -1) return false; // 리뷰 모드에서는 이동 불가

    const myColor = game.whiteId === user?.id ? 'w' : 'b';
    if (currentTurn !== myColor) {
      // 차례가 아닐 때 미리두기 등록
      setPremove({ from, to });
      socket.emit('premove', { gameId, from, to, promotion });
      return true;
    }

    // 서버에 이동 전송
    socket.emit('move', { gameId, from, to, promotion });

    // 낙관적 업데이트 (서버 응답 전 즉시 반영)
    try {
      const tempChess = new Chess(fen);
      const result = tempChess.move({ from, to, promotion: promotion || 'q' });
      if (result) {
        setFen(tempChess.fen());
        setLastMove({ from, to });
        setMoves((prev) => [...prev, { san: result.san }]);
        setCurrentTurn(tempChess.turn());
      }
    } catch {}

    return true;
  }, [game, gameOver, isSpectator, reviewIndex, currentTurn, user, fen, gameId, socket]);

  // 기권
  const handleResign = () => {
    if (window.confirm('정말 기권하시겠습니까?')) {
      socket.emit('resign', { gameId });
    }
  };

  // 무승부 제안
  const handleDrawOffer = () => {
    socket.emit('draw_offer', { gameId });
    toast.success('무승부를 제안했습니다.');
  };

  // 무승부 수락
  const handleDrawAccept = () => {
    socket.emit('draw_accept', { gameId });
    setDrawOffered(false);
  };

  // 기보 클릭 시 리뷰 모드
  const handleMoveClick = useCallback((index: number) => {
    if (index === moves.length - 1) {
      setReviewIndex(-1);
      setFen(chess.fen());
      return;
    }
    setReviewIndex(index);
    const tempChess = new Chess();
    const allMoves = chess.history({ verbose: true });
    for (let i = 0; i <= index; i++) {
      tempChess.move(allMoves[i]);
    }
    setFen(tempChess.fen());
  }, [moves.length, chess]);

  // 리뷰 모드 키보드 탐색
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (reviewIndex === -1 && e.key === 'ArrowLeft') {
        handleMoveClick(moves.length - 2);
      } else if (reviewIndex !== -1) {
        if (e.key === 'ArrowLeft') handleMoveClick(Math.max(0, reviewIndex - 1));
        if (e.key === 'ArrowRight') handleMoveClick(Math.min(moves.length - 1, reviewIndex + 1));
        if (e.key === 'Escape') { setReviewIndex(-1); setFen(chess.fen()); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [reviewIndex, moves.length, handleMoveClick, chess]);

  if (!game) return <div className="flex items-center justify-center h-screen">로딩 중...</div>;

  const playerColor = game.whiteId === user?.id ? 'white' : 'black';
  const topPlayer = orientation === 'white' ? game.black : game.white;
  const bottomPlayer = orientation === 'white' ? game.white : game.black;
  const topTime = orientation === 'white' ? blackTime : whiteTime;
  const bottomTime = orientation === 'white' ? whiteTime : blackTime;

  return (
    <div className="max-w-6xl mx-auto px-4 py-4">
      <div className="flex gap-4 items-start">
        {/* 게임 보드 영역 */}
        <div className="flex flex-col gap-2" style={{ minWidth: 480 }}>
          {/* 상단 플레이어 (상대방) */}
          <GameTimer
            time={topTime}
            isActive={currentTurn === (orientation === 'white' ? 'b' : 'w')}
            color={orientation === 'white' ? 'black' : 'white'}
            playerName={topPlayer.name}
            rating={topPlayer.rating}
          />

          {/* 체스 보드 */}
          <ChessBoard
            fen={fen}
            orientation={orientation}
            onMove={handleMove}
            disabled={isSpectator || !!gameOver}
            lastMove={lastMove}
            premove={premove}
            reviewMode={reviewIndex !== -1}
            boardWidth={480}
          />

          {/* 하단 플레이어 (나) */}
          <GameTimer
            time={bottomTime}
            isActive={currentTurn === (orientation === 'white' ? 'w' : 'b')}
            color={orientation}
            playerName={bottomPlayer.name}
            rating={bottomPlayer.rating}
          />

          {/* 게임 컨트롤 버튼 */}
          {!isSpectator && !gameOver && (
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => setOrientation((prev) => prev === 'white' ? 'black' : 'white')}
                className="btn-secondary text-sm py-1.5 px-3 flex items-center gap-1"
              >
                <FlipVertical size={14} /> 뒤집기
              </button>
              <button onClick={handleDrawOffer} className="btn-secondary text-sm py-1.5 px-3 flex items-center gap-1">
                <Handshake size={14} /> 무승부
              </button>
              <button onClick={handleResign} className="btn-danger text-sm py-1.5 px-3 flex items-center gap-1">
                <Flag size={14} /> 기권
              </button>
            </div>
          )}

          {/* 무승부 제안 수락/거절 */}
          {drawOffered && !isSpectator && (
            <div className="card p-3 text-center">
              <p className="text-sm mb-2 font-medium">무승부를 수락하시겠습니까?</p>
              <div className="flex gap-2 justify-center">
                <button onClick={handleDrawAccept} className="btn-primary text-sm py-1 px-3">수락</button>
                <button
                  onClick={() => { socket.emit('draw_decline', { gameId }); setDrawOffered(false); }}
                  className="btn-danger text-sm py-1 px-3"
                >
                  거절
                </button>
              </div>
            </div>
          )}

          {/* 리뷰 모드 안내 */}
          {reviewIndex !== -1 && (
            <div className="text-center text-xs text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 rounded p-2">
              리뷰 모드 | ← → 키로 탐색 | ESC로 현재 수로 돌아오기
            </div>
          )}
        </div>

        {/* 우측 패널 */}
        <div className="flex flex-col gap-3 flex-1" style={{ minWidth: 200 }}>
          {/* 기보 패널 */}
          <div className="card flex-1" style={{ maxHeight: 400, minHeight: 200 }}>
            <MoveList
              moves={moves}
              currentMoveIndex={reviewIndex === -1 ? moves.length - 1 : reviewIndex}
              onMoveClick={handleMoveClick}
              pgn={chess.pgn()}
            />
          </div>

          {/* 관전 모드: 채팅 */}
          {isSpectator && (
            <SpectatorChat gameId={gameId} spectatorCount={spectatorCount} />
          )}
        </div>
      </div>

      {/* 게임 종료 모달 */}
      {gameOver && (
        <GameOverModal
          result={gameOver.result}
          reason={gameOver.reason}
          playerColor={playerColor}
          whiteRating={gameOver.whiteRating}
          blackRating={gameOver.blackRating}
          gameId={gameId}
          onClose={() => setGameOver(null)}
        />
      )}
    </div>
  );
};
