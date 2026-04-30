import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Users, Play, UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';
import { getSocket, connectSocket } from '../utils/socket';
import { useAuthStore } from '../store/authStore';
import api from '../utils/api';
import { Tournament } from '../types';

export const TournamentPage = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [bracket, setBracket] = useState<{ round: number; matches: [number, number][] }[]>([]);
  const [participants, setParticipants] = useState<{ userId: number; seed: number }[]>([]);
  const socket = getSocket();

  useEffect(() => {
    connectSocket();
    if (id) {
      api.get(`/api/tournaments/${id}`).then((res) => {
        setTournament(res.data);
      });
      socket.emit('tournament_join_room', { tournamentId: parseInt(id) });
    }

    socket.on('tournament_started', (data: {
      tournamentId: number;
      bracket: typeof bracket;
      participants: typeof participants;
    }) => {
      setBracket(data.bracket);
      setParticipants(data.participants);
      toast.success('토너먼트가 시작되었습니다!');
    });

    return () => {
      socket.off('tournament_started');
    };
  }, [id, socket]);

  const handleJoin = async () => {
    try {
      await api.post(`/api/tournaments/${id}/join`);
      toast.success('참가 완료!');
      const res = await api.get(`/api/tournaments/${id}`);
      setTournament(res.data);
    } catch (err: any) {
      toast.error(err.response?.data?.message || '참가 실패');
    }
  };

  const handleStart = () => {
    socket.emit('tournament_start', { tournamentId: parseInt(id!) });
  };

  if (!tournament) return <div className="flex items-center justify-center h-64">로딩 중...</div>;

  const isHost = tournament.hostId === user?.id;
  const isParticipant = tournament.participants.some((p) => p.userId === user?.id);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">{tournament.name}</h1>
          <p className="text-sm text-gray-500">
            {tournament.format === 'single_elim' ? '싱글 엘리미네이션' : '더블 엘리미네이션'} ·{' '}
            {tournament.timeControl} · {tournament.participants.length}명 참가
          </p>
        </div>
        <div className="flex gap-2">
          {!isParticipant && tournament.status === 'waiting' && (
            <button onClick={handleJoin} className="btn-primary flex items-center gap-1">
              <UserPlus size={16} /> 참가
            </button>
          )}
          {isHost && tournament.status === 'waiting' && tournament.participants.length >= 4 && (
            <button onClick={handleStart} className="btn-primary flex items-center gap-1">
              <Play size={16} /> 시작
            </button>
          )}
        </div>
      </div>

      {/* 참가자 목록 */}
      <div className="card mb-4">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <Users size={16} /> 참가자 ({tournament.participants.length}명)
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {tournament.participants.map((p) => (
            <div key={p.id} className="bg-gray-50 dark:bg-gray-700 rounded-lg px-3 py-2 text-sm">
              <p className="font-medium">유저 #{p.userId}</p>
              {p.seed && <p className="text-xs text-gray-500">시드 #{p.seed}</p>}
            </div>
          ))}
        </div>
      </div>

      {/* 대진표 */}
      {bracket.length > 0 && (
        <div className="card">
          <h3 className="font-semibold mb-4">대진표</h3>
          <div className="flex gap-4 overflow-x-auto">
            {bracket.map((round) => (
              <div key={round.round} className="flex-shrink-0">
                <p className="text-xs text-gray-500 mb-2 font-semibold">{round.round}라운드</p>
                <div className="space-y-4">
                  {round.matches.map(([p1, p2], matchIdx) => (
                    <div key={matchIdx} className="w-36 border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
                      <div className="px-3 py-1.5 bg-white dark:bg-gray-700 text-sm border-b border-gray-100 dark:border-gray-600">
                        #{p1}
                      </div>
                      <div className="px-3 py-1.5 bg-white dark:bg-gray-700 text-sm">
                        #{p2}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tournament.status === 'waiting' && bracket.length === 0 && (
        <div className="card text-center py-8">
          <p className="text-gray-500">
            {isHost
              ? `최소 4명이 참가하면 토너먼트를 시작할 수 있습니다. (현재 ${tournament.participants.length}명)`
              : '방장이 토너먼트를 시작하기를 기다리고 있습니다.'}
          </p>
        </div>
      )}
    </div>
  );
};
