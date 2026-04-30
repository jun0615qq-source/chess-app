import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Eye, Clock, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/authStore';
import { getSocket, connectSocket } from '../utils/socket';
import { getTier, getTimeControlLabel } from '../utils/tier';
import api from '../utils/api';
import { Game } from '../types';
import clsx from 'clsx';

const TIME_CONTROLS = ['1+0', '3+0', '5+0', '10+0', 'unlimited'];

export const HomePage = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [activeGames, setActiveGames] = useState<Game[]>([]);
  const [selectedTime, setSelectedTime] = useState('5+0');
  const [isMatchmaking, setIsMatchmaking] = useState(false);
  const socket = getSocket();

  useEffect(() => {
    connectSocket();

    // 진행 중인 게임 목록 조회
    api.get('/api/games/active').then((res) => {
      setActiveGames(res.data);
    }).catch(() => {});

    // 매치메이킹 결과 수신
    socket.on('game_start', ({ gameId }: { gameId: number }) => {
      setIsMatchmaking(false);
      navigate(`/game/${gameId}`);
    });

    socket.on('matchmaking_waiting', () => {
      toast.success('상대를 찾고 있습니다...');
    });

    socket.on('matchmaking_cancelled', () => {
      setIsMatchmaking(false);
    });

    return () => {
      socket.off('game_start');
      socket.off('matchmaking_waiting');
      socket.off('matchmaking_cancelled');
    };
  }, [socket, navigate]);

  const handleMatchmaking = () => {
    if (!user) {
      navigate('/login');
      return;
    }
    if (isMatchmaking) {
      socket.emit('matchmaking_cancel');
      setIsMatchmaking(false);
    } else {
      socket.emit('matchmaking_join', { timeControl: selectedTime });
      setIsMatchmaking(true);
    }
  };

  const tier = user ? getTier(user.rating) : null;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* 유저 정보 카드 */}
      {user && (
        <div className="card mb-6 flex items-center gap-4">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg"
            style={{ background: tier?.color || '#666' }}
          >
            {user.name[0]}
          </div>
          <div>
            <p className="font-bold text-lg">{user.name}</p>
            <div className="flex items-center gap-2 text-sm">
              <span style={{ color: tier?.color }}>{tier?.name}</span>
              <span className="text-gray-500">{user.rating}</span>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 매치메이킹 */}
        <div className="card">
          <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
            <Zap size={20} className="text-yellow-500" /> 빠른 게임
          </h2>

          {/* 시간 제어 선택 */}
          <div className="grid grid-cols-5 gap-1 mb-4">
            {TIME_CONTROLS.map((tc) => (
              <button
                key={tc}
                onClick={() => setSelectedTime(tc)}
                className={clsx(
                  'py-2 rounded-lg text-xs font-semibold transition-colors',
                  selectedTime === tc
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                )}
              >
                {getTimeControlLabel(tc)}
              </button>
            ))}
          </div>

          <button
            onClick={handleMatchmaking}
            className={clsx(
              'w-full py-3 rounded-xl font-bold text-lg transition-all',
              isMatchmaking
                ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse'
                : 'bg-green-600 hover:bg-green-700 text-white'
            )}
          >
            {isMatchmaking ? '⏳ 매칭 취소' : '▶ 게임 시작'}
          </button>

          {/* 게임 모드 버튼 */}
          <div className="grid grid-cols-3 gap-2 mt-3">
            <ModeButton
              icon={<Users size={16} />}
              label="1대다"
              onClick={() => navigate('/multi/create')}
            />
            <ModeButton
              icon={<Users size={16} />}
              label="팀 게임"
              onClick={() => navigate('/team/create')}
            />
            <ModeButton
              icon={<Clock size={16} />}
              label="토너먼트"
              onClick={() => navigate('/tournament/create')}
            />
          </div>
        </div>

        {/* 진행 중인 게임 */}
        <div className="card">
          <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
            <Eye size={20} className="text-blue-500" /> 진행 중인 게임
          </h2>
          {activeGames.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">진행 중인 게임이 없습니다.</p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {activeGames.map((game) => (
                <button
                  key={game.id}
                  onClick={() => navigate(`/game/${game.id}`)}
                  className="w-full flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors text-left"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {game.white.name} vs {game.black.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {game.white.rating} vs {game.black.rating} · {getTimeControlLabel(game.timeControl)}
                    </p>
                  </div>
                  <span className="text-xs text-blue-500 flex items-center gap-1">
                    <Eye size={12} /> 관전
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const ModeButton = ({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) => (
  <button
    onClick={onClick}
    className="flex flex-col items-center gap-1 py-3 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg text-xs font-medium transition-colors"
  >
    {icon}
    {label}
  </button>
);
