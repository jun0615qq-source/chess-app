import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { getSocket, connectSocket } from '../utils/socket';
import { getTimeControlLabel } from '../utils/tier';
import clsx from 'clsx';

const TIME_CONTROLS = ['1+0', '3+0', '5+0', '10+0', 'unlimited'];
const TEAM_SIZES: (2 | 3 | 4)[] = [2, 3, 4];

export const TeamCreatePage = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [playersPerTeam, setPlayersPerTeam] = useState<2 | 3 | 4>(2);
  const [timeControl, setTimeControl] = useState('5+0');

  const handleCreate = () => {
    if (!user) { navigate('/login'); return; }

    connectSocket();
    const socket = getSocket();
    const roomId = Math.random().toString(36).slice(2, 9);

    socket.emit('team_room_create', { roomId, playersPerTeam, timeControl });
    navigate(`/team/${roomId}`, { state: { isHost: true, playersPerTeam, timeControl } });
  };

  return (
    <div className="max-w-md mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <Users size={24} /> 팀 게임 만들기
      </h1>

      <div className="card space-y-6">
        <div>
          <p className="text-sm font-semibold mb-3 text-gray-600 dark:text-gray-400">팀 인원</p>
          <div className="grid grid-cols-3 gap-2">
            {TEAM_SIZES.map((size) => (
              <button
                key={size}
                onClick={() => setPlayersPerTeam(size)}
                className={clsx(
                  'py-4 rounded-xl font-bold text-lg transition-all',
                  playersPerTeam === size
                    ? 'bg-blue-600 text-white shadow-lg scale-105'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                )}
              >
                {size}vs{size}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold mb-3 text-gray-600 dark:text-gray-400">시간 제한</p>
          <div className="grid grid-cols-5 gap-1">
            {TIME_CONTROLS.map((tc) => (
              <button
                key={tc}
                onClick={() => setTimeControl(tc)}
                className={clsx(
                  'py-2 rounded-lg text-xs font-semibold transition-colors',
                  timeControl === tc
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                )}
              >
                {getTimeControlLabel(tc)}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleCreate}
          className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold text-lg transition-colors"
        >
          방 만들기
        </button>
      </div>
    </div>
  );
};
