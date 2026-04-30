import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Play, UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';
import { getSocket, connectSocket } from '../utils/socket';
import { useAuthStore } from '../store/authStore';
import api from '../utils/api';
import { League, LeagueParticipant } from '../types';

interface Standing extends LeagueParticipant {
  userName?: string;
}

export const LeaguePage = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const [league, setLeague] = useState<League | null>(null);
  const [standings, setStandings] = useState<Standing[]>([]);
  const socket = getSocket();

  useEffect(() => {
    connectSocket();
    if (id) {
      api.get(`/api/leagues/${id}`).then((res) => {
        setLeague(res.data);
        setStandings(res.data.participants);
      });
      socket.emit('league_join_room', { leagueId: parseInt(id) });
    }

    socket.on('league_match_result', ({ standings: s }: { standings: Standing[] }) => {
      setStandings(s);
    });

    socket.on('league_started', () => {
      toast.success('리그가 시작되었습니다!');
    });

    return () => {
      socket.off('league_match_result');
      socket.off('league_started');
    };
  }, [id, socket]);

  const handleJoin = async () => {
    try {
      await api.post(`/api/leagues/${id}/join`);
      toast.success('참가 완료!');
      const res = await api.get(`/api/leagues/${id}`);
      setLeague(res.data);
    } catch (err: any) {
      toast.error(err.response?.data?.message || '참가 실패');
    }
  };

  const handleStart = () => {
    socket.emit('league_start', { leagueId: parseInt(id!) });
  };

  if (!league) return <div className="flex items-center justify-center h-64">로딩 중...</div>;

  const isHost = league.hostId === user?.id;
  const isParticipant = league.participants.some((p) => p.userId === user?.id);

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">{league.name}</h1>
          <p className="text-sm text-gray-500">
            라운드 로빈 · {league.timeControl} · {league.participants.length}명
          </p>
        </div>
        <div className="flex gap-2">
          {!isParticipant && league.status === 'waiting' && (
            <button onClick={handleJoin} className="btn-primary flex items-center gap-1">
              <UserPlus size={16} /> 참가
            </button>
          )}
          {isHost && league.status === 'waiting' && league.participants.length >= 4 && (
            <button onClick={handleStart} className="btn-primary flex items-center gap-1">
              <Play size={16} /> 시작
            </button>
          )}
        </div>
      </div>

      {/* 리그 테이블 */}
      <div className="card overflow-hidden p-0">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700 text-xs text-gray-500 uppercase">
            <tr>
              <th className="text-left py-3 px-4">순위</th>
              <th className="text-left py-3 px-4">참가자</th>
              <th className="text-center py-3 px-2">승</th>
              <th className="text-center py-3 px-2">무</th>
              <th className="text-center py-3 px-2">패</th>
              <th className="text-right py-3 px-4">포인트</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {standings
              .sort((a, b) => b.points - a.points)
              .map((p, i) => (
                <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="py-3 px-4 font-bold text-gray-500">{i + 1}</td>
                  <td className="py-3 px-4 font-medium">유저 #{p.userId}</td>
                  <td className="py-3 px-2 text-center text-green-600 font-medium">{p.wins}</td>
                  <td className="py-3 px-2 text-center text-yellow-600 font-medium">{p.draws}</td>
                  <td className="py-3 px-2 text-center text-red-600 font-medium">{p.losses}</td>
                  <td className="py-3 px-4 text-right font-bold text-lg">{p.points}</td>
                </tr>
              ))}
          </tbody>
        </table>
        {standings.length === 0 && (
          <p className="text-center py-8 text-gray-400 text-sm">참가자를 기다리고 있습니다.</p>
        )}
      </div>
    </div>
  );
};
