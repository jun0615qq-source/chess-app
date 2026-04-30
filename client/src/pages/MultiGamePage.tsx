import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Chess } from 'chess.js';
import toast from 'react-hot-toast';
import { ChessBoard } from '../components/board/ChessBoard';
import { GameOverModal } from '../components/modals/GameOverModal';
import { useAuthStore } from '../store/authStore';
import { getSocket, connectSocket } from '../utils/socket';
import clsx from 'clsx';

interface BoardState {
  fen: string;
  challengerId: number;
  gameId: number;
  finished: boolean;
  result?: 'white' | 'black' | 'draw';
}

export const MultiGamePage = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const socket = getSocket();

  const [boards, setBoards] = useState<BoardState[]>([]);
  const [focusIndex, setFocusIndex] = useState(0);
  const [isHost, setIsHost] = useState(false);
  const [timeControl, setTimeControl] = useState('5+0');
  const [gameOver, setGameOver] = useState<any>(null);

  useEffect(() => {
    connectSocket();

    // 방 생성 (첫 진입 시 방장)
    socket.emit('multi_room_create', { roomId, timeControl });
    setIsHost(true);

    socket.on('multi_room_created', () => {
      toast.success('1대다 방이 생성되었습니다. 링크를 공유하세요!');
    });

    socket.on('multi_challenger_joined', ({ boardIndex, gameId, challengerId }: {
      boardIndex: number; gameId: number; challengerId: number;
    }) => {
      setBoards((prev) => [
        ...prev,
        {
          fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
          challengerId,
          gameId,
          finished: false,
        },
      ]);
      toast.success(`도전자가 참가했습니다! (보드 #${boardIndex + 1})`);
    });

    socket.on('multi_move', ({ boardIndex, from, to, san, fen }: {
      boardIndex: number; from: string; to: string; san: string; fen: string;
    }) => {
      setBoards((prev) => prev.map((b, i) =>
        i === boardIndex ? { ...b, fen } : b
      ));
    });

    socket.on('multi_focus_change', ({ boardIndex }: { boardIndex: number }) => {
      setFocusIndex(boardIndex);
    });

    socket.on('game_over', (data: any) => {
      setGameOver(data);
    });

    return () => {
      socket.off('multi_room_created');
      socket.off('multi_challenger_joined');
      socket.off('multi_move');
      socket.off('multi_focus_change');
      socket.off('game_over');
    };
  }, [roomId, socket, timeControl]);

  const handleMove = (boardIndex: number) => (from: string, to: string, promotion?: string): boolean => {
    socket.emit('multi_move', { roomId, boardIndex, from, to, promotion });
    return true;
  };

  const currentBoard = boards[focusIndex];

  return (
    <div className="max-w-7xl mx-auto px-4 py-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">1대다 모드</h1>
        <p className="text-sm text-gray-500">보드 {boards.length}개 진행 중</p>
      </div>

      {isHost && boards.length === 0 && (
        <div className="card text-center py-8">
          <p className="text-gray-500 mb-2">도전자를 기다리고 있습니다...</p>
          <p className="text-xs text-gray-400">
            공유 링크: {window.location.href}
          </p>
        </div>
      )}

      <div className="flex gap-4">
        {/* 현재 포커스된 보드 (확대) */}
        {currentBoard && (
          <div className="flex-shrink-0">
            <p className="text-sm font-medium mb-2">보드 #{focusIndex + 1} (현재 차례)</p>
            <ChessBoard
              fen={currentBoard.fen}
              orientation="white"
              onMove={handleMove(focusIndex)}
              disabled={currentBoard.finished}
              boardWidth={480}
            />
          </div>
        )}

        {/* 모든 보드 타일 */}
        <div className="flex-1">
          <p className="text-sm font-medium mb-2">전체 보드</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {boards.map((board, i) => (
              <button
                key={i}
                onClick={() => setFocusIndex(i)}
                className={clsx(
                  'rounded-lg overflow-hidden border-2 transition-colors',
                  focusIndex === i
                    ? 'border-blue-500 shadow-lg'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-400',
                  board.finished && 'opacity-60'
                )}
              >
                <div className="p-1">
                  <ChessBoard
                    fen={board.fen}
                    orientation="white"
                    disabled
                    showCoordinates={false}
                    boardWidth={140}
                  />
                </div>
                <div className="text-xs py-1 text-center bg-gray-50 dark:bg-gray-700">
                  보드 #{i + 1}
                  {board.finished && (
                    <span className="ml-1 text-gray-400">(종료)</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {gameOver && currentBoard && (
        <GameOverModal
          result={gameOver.result}
          reason={gameOver.reason}
          playerColor="white"
          whiteRating={gameOver.whiteRating}
          blackRating={gameOver.blackRating}
          gameId={currentBoard.gameId}
          onClose={() => setGameOver(null)}
        />
      )}
    </div>
  );
};
