import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Chess } from 'chess.js';
import { Flag, Home } from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { ChessBoard } from '../components/board/ChessBoard';
import { MoveList } from '../components/board/MoveList';
import { useAuthStore } from '../store/authStore';
import { getSocket, connectSocket } from '../utils/socket';
import { formatTime, getTimeControlLabel } from '../utils/tier';

interface TeamPlayer {
  userId: number;
  name: string;
  rating: number;
}

const INITIAL_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

// ─── Sub-components ───────────────────────────────────────────────────────────

interface TeamLobbyPanelProps {
  label: string;
  side: 'white' | 'black';
  team: TeamPlayer[];
  playersPerTeam: number;
  mySide: 'white' | 'black' | null;
  myUserId?: number;
  onJoin: () => void;
}

const TeamLobbyPanel = ({ label, side, team, playersPerTeam, mySide, myUserId, onJoin }: TeamLobbyPanelProps) => {
  const isMySide = mySide === side;
  const isFull = team.length >= playersPerTeam;
  const amHere = team.some((p) => p.userId === myUserId);

  return (
    <div className={clsx('card p-4', isMySide && 'ring-2 ring-blue-500')}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold">{label}</h3>
        <span className="text-sm text-gray-400">{team.length}/{playersPerTeam}</span>
      </div>
      <div className="space-y-2 mb-3">
        {Array.from({ length: playersPerTeam }).map((_, i) => (
          <div
            key={i}
            className={clsx(
              'p-2 rounded text-sm',
              team[i]
                ? 'bg-gray-100 dark:bg-gray-700'
                : 'bg-gray-50 dark:bg-gray-800 border border-dashed border-gray-300 dark:border-gray-600'
            )}
          >
            {team[i] ? (
              <span className={team[i].userId === myUserId ? 'font-bold text-blue-600 dark:text-blue-400' : ''}>
                {team[i].name}
              </span>
            ) : (
              <span className="text-gray-400 text-xs">빈 자리</span>
            )}
          </div>
        ))}
      </div>
      {amHere ? (
        <p className="text-center text-xs text-blue-500 font-medium">참가 중</p>
      ) : isFull ? (
        <p className="text-center text-xs text-gray-400">팀이 가득 찼습니다</p>
      ) : (
        <button
          onClick={onJoin}
          className={clsx(
            'w-full py-2 rounded-lg text-sm font-semibold transition-colors border-2',
            side === 'white'
              ? 'bg-white text-gray-900 border-gray-300 hover:border-gray-500'
              : 'bg-gray-900 text-white border-gray-700 hover:border-gray-500'
          )}
        >
          참가
        </button>
      )}
    </div>
  );
};

interface TeamPanelProps {
  label: string;
  color: 'white' | 'black';
  team: TeamPlayer[];
  activeIndex: number;
  timeMs: number;
  isActive: boolean;
}

const TeamPanel = ({ label, color, team, activeIndex, timeMs, isActive }: TeamPanelProps) => (
  <div className={clsx(
    'rounded-lg p-3 transition-colors',
    isActive
      ? 'bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900'
      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
  )}>
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center gap-2">
        <div className={clsx(
          'w-4 h-4 rounded-full border-2',
          color === 'white' ? 'bg-white border-gray-300' : 'bg-gray-900 border-gray-600'
        )} />
        <span className="font-semibold text-sm">{label}</span>
      </div>
      <span className={clsx(
        'font-mono text-xl font-bold',
        isActive && isFinite(timeMs) && timeMs < 30000 && 'text-red-500 animate-pulse'
      )}>
        {formatTime(timeMs / 1000)}
      </span>
    </div>
    <div className="flex gap-1 flex-wrap">
      {team.map((player, i) => (
        <div
          key={player.userId}
          className={clsx(
            'flex-1 min-w-0 text-center py-1 px-2 rounded text-xs font-medium truncate',
            i === activeIndex && isActive
              ? 'bg-green-500 text-white'
              : 'bg-gray-200 dark:bg-gray-600 opacity-70'
          )}
          title={player.name}
        >
          {player.name}
          {i === activeIndex && isActive && ' ▶'}
        </div>
      ))}
    </div>
  </div>
);

// ─── Main Page ────────────────────────────────────────────────────────────────

export const TeamGamePage = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const socket = getSocket();

  const stateIsHost = location.state?.isHost === true;
  const statePpt = location.state?.playersPerTeam as (2 | 3 | 4) | undefined;
  const stateTc = location.state?.timeControl as string | undefined;

  // Lobby state
  const [status, setStatus] = useState<'waiting' | 'ongoing' | 'finished'>('waiting');
  const [playersPerTeam, setPlayersPerTeam] = useState<number>(statePpt || 2);
  const [timeControl, setTimeControl] = useState<string>(stateTc || '5+0');
  const [whiteTeam, setWhiteTeam] = useState<TeamPlayer[]>([]);
  const [blackTeam, setBlackTeam] = useState<TeamPlayer[]>([]);
  const [isHost, setIsHost] = useState(stateIsHost);
  const [mySide, setMySide] = useState<'white' | 'black' | null>(null);

  // Game state
  const [fen, setFen] = useState(INITIAL_FEN);
  const [moves, setMoves] = useState<{ san: string }[]>([]);
  const [currentColor, setCurrentColor] = useState<'w' | 'b'>('w');
  const [whitePlayerIndex, setWhitePlayerIndex] = useState(0);
  const [blackPlayerIndex, setBlackPlayerIndex] = useState(0);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | undefined>();
  const [gameOver, setGameOver] = useState<{ result: 'white' | 'black' | 'draw'; reason: string } | null>(null);
  const [orientation, setOrientation] = useState<'white' | 'black'>('white');
  const [disconnectWarning, setDisconnectWarning] = useState<string | null>(null);

  // Clock: refs for smooth local countdown
  const whiteTimeMsRef = useRef(Infinity);
  const blackTimeMsRef = useRef(Infinity);
  const currentColorRef = useRef<'w' | 'b'>('w');
  const lastMoveAtRef = useRef(0);
  const [displayWhiteMs, setDisplayWhiteMs] = useState(Infinity);
  const [displayBlackMs, setDisplayBlackMs] = useState(Infinity);

  const chessRef = useRef(new Chess());

  const deriveMySide = useCallback((wt: TeamPlayer[], bt: TeamPlayer[]) => {
    if (wt.some((p) => p.userId === user?.id)) return 'white' as const;
    if (bt.some((p) => p.userId === user?.id)) return 'black' as const;
    return null;
  }, [user]);

  // Local clock tick for smooth display
  useEffect(() => {
    if (status !== 'ongoing' || !isFinite(whiteTimeMsRef.current)) return;
    const interval = setInterval(() => {
      const elapsed = Date.now() - lastMoveAtRef.current;
      if (currentColorRef.current === 'w') {
        setDisplayWhiteMs(Math.max(0, whiteTimeMsRef.current - elapsed));
        setDisplayBlackMs(blackTimeMsRef.current);
      } else {
        setDisplayWhiteMs(whiteTimeMsRef.current);
        setDisplayBlackMs(Math.max(0, blackTimeMsRef.current - elapsed));
      }
    }, 100);
    return () => clearInterval(interval);
  }, [status]);

  useEffect(() => {
    connectSocket();

    if (stateIsHost && statePpt && stateTc) {
      socket.emit('team_room_create', { roomId, playersPerTeam: statePpt, timeControl: stateTc });
    } else {
      socket.emit('team_room_get', { roomId });
    }

    socket.on('team_room_created', () => setIsHost(true));

    socket.on('team_room_updated', (data: {
      whiteTeam: TeamPlayer[]; blackTeam: TeamPlayer[];
      playersPerTeam: number; status: string; timeControl: string;
    }) => {
      setWhiteTeam(data.whiteTeam);
      setBlackTeam(data.blackTeam);
      setPlayersPerTeam(data.playersPerTeam);
      setStatus(data.status as 'waiting' | 'ongoing' | 'finished');
      setTimeControl(data.timeControl);
      setMySide(deriveMySide(data.whiteTeam, data.blackTeam));
    });

    socket.on('team_started', (data: {
      fen: string;
      whiteTeam: TeamPlayer[]; blackTeam: TeamPlayer[];
      currentColor: 'w' | 'b';
      whitePlayerIndex: number; blackPlayerIndex: number;
      whiteTimeMs: number; blackTimeMs: number;
      moves: string[];
    }) => {
      // Replay move history into chess instance
      const chess = new Chess();
      data.moves.forEach((san) => { try { chess.move(san); } catch {} });
      chessRef.current = chess;

      setFen(data.fen);
      setStatus('ongoing');
      setWhiteTeam(data.whiteTeam);
      setBlackTeam(data.blackTeam);
      setMySide(deriveMySide(data.whiteTeam, data.blackTeam));
      setCurrentColor(data.currentColor);
      setWhitePlayerIndex(data.whitePlayerIndex);
      setBlackPlayerIndex(data.blackPlayerIndex);
      setMoves(data.moves.map((san) => ({ san })));
      whiteTimeMsRef.current = data.whiteTimeMs;
      blackTimeMsRef.current = data.blackTimeMs;
      currentColorRef.current = data.currentColor;
      lastMoveAtRef.current = Date.now();
      setDisplayWhiteMs(data.whiteTimeMs);
      setDisplayBlackMs(data.blackTimeMs);
    });

    socket.on('team_state_update', (data: {
      fen: string; san: string; from: string; to: string;
      currentColor: 'w' | 'b';
      whitePlayerIndex: number; blackPlayerIndex: number;
      whiteTimeMs: number; blackTimeMs: number;
    }) => {
      // Apply move to maintain PGN
      try {
        chessRef.current.move(data.san);
      } catch {
        chessRef.current.load(data.fen);
      }

      setFen(data.fen);
      setMoves((prev) => [...prev, { san: data.san }]);
      setLastMove({ from: data.from, to: data.to });
      setCurrentColor(data.currentColor);
      setWhitePlayerIndex(data.whitePlayerIndex);
      setBlackPlayerIndex(data.blackPlayerIndex);
      whiteTimeMsRef.current = data.whiteTimeMs;
      blackTimeMsRef.current = data.blackTimeMs;
      currentColorRef.current = data.currentColor;
      lastMoveAtRef.current = Date.now();
      setDisplayWhiteMs(data.whiteTimeMs);
      setDisplayBlackMs(data.blackTimeMs);
    });

    socket.on('team_time_update', (data: { whiteTimeMs: number; blackTimeMs: number }) => {
      whiteTimeMsRef.current = data.whiteTimeMs;
      blackTimeMsRef.current = data.blackTimeMs;
    });

    socket.on('team_game_over', (data: { result: 'white' | 'black' | 'draw'; reason: string }) => {
      setGameOver(data);
      setStatus('finished');
    });

    socket.on('team_player_disconnected', ({ name, secondsUntilForfeit }: { name: string; secondsUntilForfeit: number }) => {
      setDisconnectWarning(`${name}의 연결이 끊겼습니다. ${secondsUntilForfeit}초 후 기권 처리됩니다.`);
      toast.error(`${name} 연결 끊김`);
    });

    socket.on('team_player_reconnected', ({ name }: { name: string }) => {
      setDisconnectWarning(null);
      toast.success(`${name} 재연결됨`);
    });

    socket.on('team_error', ({ message }: { message: string }) => {
      toast.error(message);
    });

    return () => {
      ['team_room_created', 'team_room_updated', 'team_started', 'team_state_update',
        'team_time_update', 'team_game_over', 'team_player_disconnected',
        'team_player_reconnected', 'team_error'].forEach((e) => socket.off(e));
    };
  }, [roomId, socket, stateIsHost, statePpt, stateTc, deriveMySide]);

  const isMyTurn = useMemo(() => {
    if (status !== 'ongoing' || !!gameOver || !mySide) return false;
    const isMyColor = (mySide === 'white' && currentColor === 'w') || (mySide === 'black' && currentColor === 'b');
    if (!isMyColor) return false;
    const activeIdx = mySide === 'white' ? whitePlayerIndex : blackPlayerIndex;
    const myTeam = mySide === 'white' ? whiteTeam : blackTeam;
    return myTeam[activeIdx]?.userId === user?.id;
  }, [status, gameOver, mySide, currentColor, whitePlayerIndex, blackPlayerIndex, whiteTeam, blackTeam, user]);

  const handleJoin = (side: 'white' | 'black') => {
    socket.emit('team_room_join', { roomId, side });
    setMySide(side);
    if (side === 'black') setOrientation('black');
  };

  const handleMove = useCallback((from: string, to: string, promotion?: string): boolean => {
    if (!isMyTurn) return false;
    socket.emit('team_move', { roomId, from, to, promotion });
    return true;
  }, [isMyTurn, socket, roomId]);

  const handleResign = () => {
    if (!isMyTurn) return;
    if (window.confirm('정말 기권하시겠습니까? (팀 전체가 패배합니다)')) {
      socket.emit('team_resign', { roomId });
    }
  };

  const bothTeamsFull = whiteTeam.length === playersPerTeam && blackTeam.length === playersPerTeam;
  const shareUrl = window.location.href;

  // ─── Lobby ────────────────────────────────────────────────────────────────
  if (status === 'waiting') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold mb-1">팀 게임 대기실</h1>
        <p className="text-sm text-gray-500 mb-4">
          {playersPerTeam}vs{playersPerTeam} · {getTimeControlLabel(timeControl)}
        </p>

        <div className="card mb-4 p-3 flex items-center gap-2">
          <span className="text-xs text-gray-500 flex-1 truncate">{shareUrl}</span>
          <button
            onClick={() => { navigator.clipboard.writeText(shareUrl); toast.success('링크 복사됨'); }}
            className="text-xs text-blue-500 hover:text-blue-600 font-medium whitespace-nowrap"
          >
            복사
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <TeamLobbyPanel
            label="흰팀 (백)"
            side="white"
            team={whiteTeam}
            playersPerTeam={playersPerTeam}
            mySide={mySide}
            myUserId={user?.id}
            onJoin={() => handleJoin('white')}
          />
          <TeamLobbyPanel
            label="검팀 (흑)"
            side="black"
            team={blackTeam}
            playersPerTeam={playersPerTeam}
            mySide={mySide}
            myUserId={user?.id}
            onJoin={() => handleJoin('black')}
          />
        </div>

        {isHost ? (
          <button
            onClick={() => socket.emit('team_start', { roomId })}
            disabled={!bothTeamsFull}
            className={clsx(
              'w-full py-3 rounded-xl font-bold text-lg transition-all',
              bothTeamsFull
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
            )}
          >
            {bothTeamsFull
              ? '게임 시작'
              : `대기 중... (흰팀 ${whiteTeam.length}/${playersPerTeam}, 검팀 ${blackTeam.length}/${playersPerTeam})`}
          </button>
        ) : (
          <p className="text-center text-sm text-gray-400">방장이 게임을 시작하기를 기다리고 있습니다...</p>
        )}
      </div>
    );
  }

  // ─── Game view ────────────────────────────────────────────────────────────
  const topTeam      = orientation === 'white' ? blackTeam : whiteTeam;
  const bottomTeam   = orientation === 'white' ? whiteTeam : blackTeam;
  const topActiveIdx = orientation === 'white' ? blackPlayerIndex : whitePlayerIndex;
  const botActiveIdx = orientation === 'white' ? whitePlayerIndex : blackPlayerIndex;
  const topTimeMs    = orientation === 'white' ? displayBlackMs : displayWhiteMs;
  const botTimeMs    = orientation === 'white' ? displayWhiteMs : displayBlackMs;
  const topIsActive  = orientation === 'white' ? currentColor === 'b' : currentColor === 'w';
  const botIsActive  = orientation === 'white' ? currentColor === 'w' : currentColor === 'b';
  const topLabel     = orientation === 'white' ? '검팀 (흑)' : '흰팀 (백)';
  const botLabel     = orientation === 'white' ? '흰팀 (백)' : '검팀 (흑)';
  const topColor     = orientation === 'white' ? 'black' : 'white';
  const botColor     = orientation === 'white' ? 'white' : 'black';

  const activeName = currentColor === 'w'
    ? whiteTeam[whitePlayerIndex]?.name
    : blackTeam[blackPlayerIndex]?.name;

  return (
    <div className="max-w-6xl mx-auto px-4 py-4">
      {disconnectWarning && (
        <div className="mb-3 p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg text-sm text-red-700 dark:text-red-300">
          {disconnectWarning}
        </div>
      )}

      <div className="flex gap-4 items-start">
        {/* Board column */}
        <div className="flex flex-col gap-2" style={{ minWidth: 480 }}>
          <TeamPanel
            label={topLabel}
            color={topColor as 'white' | 'black'}
            team={topTeam}
            activeIndex={topActiveIdx}
            timeMs={topTimeMs}
            isActive={topIsActive}
          />

          <ChessBoard
            fen={fen}
            orientation={orientation}
            onMove={handleMove}
            disabled={!isMyTurn || !!gameOver}
            lastMove={lastMove}
            boardWidth={480}
          />

          <TeamPanel
            label={botLabel}
            color={botColor as 'white' | 'black'}
            team={bottomTeam}
            activeIndex={botActiveIdx}
            timeMs={botTimeMs}
            isActive={botIsActive}
          />

          {status === 'ongoing' && !gameOver && (
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => setOrientation((p) => p === 'white' ? 'black' : 'white')}
                className="btn-secondary text-sm py-1.5 px-3"
              >
                뒤집기
              </button>
              {isMyTurn && (
                <button onClick={handleResign} className="btn-danger text-sm py-1.5 px-3 flex items-center gap-1">
                  <Flag size={14} /> 기권
                </button>
              )}
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-3 flex-1" style={{ minWidth: 200 }}>
          {/* Turn indicator */}
          {status === 'ongoing' && !gameOver && (
            <div className={clsx(
              'card p-3 text-center font-semibold text-sm',
              isMyTurn
                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                : 'text-gray-500 dark:text-gray-400'
            )}>
              {isMyTurn
                ? '당신의 차례입니다!'
                : `${currentColor === 'w' ? '흰팀' : '검팀'} 차례: ${activeName || ''}`}
            </div>
          )}

          <div className="card flex-1" style={{ maxHeight: 400, minHeight: 200 }}>
            <MoveList
              moves={moves}
              currentMoveIndex={moves.length - 1}
              onMoveClick={() => {}}
              pgn={chessRef.current.pgn()}
            />
          </div>
        </div>
      </div>

      {/* Game over modal */}
      {gameOver && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="card p-8 text-center max-w-sm w-full mx-4">
            <h2 className="text-2xl font-bold mb-2">
              {gameOver.result === 'draw' ? '무승부!'
                : gameOver.result === 'white' ? '흰팀 승리!'
                : '검팀 승리!'}
            </h2>
            <p className="text-gray-500 mb-6">{gameOver.reason}</p>
            <button
              onClick={() => navigate('/')}
              className="btn-primary flex items-center gap-2 mx-auto"
            >
              <Home size={16} /> 홈으로
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
