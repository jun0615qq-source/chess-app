import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Trophy, Puzzle, Users } from 'lucide-react';
import api from '../utils/api';
import { getTier } from '../utils/tier';
import clsx from 'clsx';

type Tab = 'rating' | 'team' | 'puzzle';

interface UserEntry {
  id: number;
  studentId: string;
  name: string;
  rating?: number;
  puzzlePoints?: number;
  puzzleStreak?: number;
  _count?: { gamesAsWhite: number; gamesAsBlack: number };
}

interface TeamEntry {
  id: number;
  name: string;
  rating: number;
  members: { user: { id: number; name: string } }[];
}

export const LeaderboardPage = () => {
  const [tab, setTab] = useState<Tab>('rating');
  const [users, setUsers] = useState<UserEntry[]>([]);
  const [teams, setTeams] = useState<TeamEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const endpoints: Record<Tab, string> = {
      rating: '/api/leaderboard',
      team: '/api/leaderboard/team',
      puzzle: '/api/leaderboard/puzzle',
    };

    api.get(endpoints[tab]).then((res) => {
      if (tab === 'team') setTeams(res.data);
      else setUsers(res.data);
    }).finally(() => setLoading(false));
  }, [tab]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-4">랭킹</h1>

      {/* 탭 */}
      <div className="flex gap-1 mb-4 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
        {([
          { key: 'rating', label: '개인 레이팅', icon: <Trophy size={14} /> },
          { key: 'team', label: '팀 레이팅', icon: <Users size={14} /> },
          { key: 'puzzle', label: '퍼즐 포인트', icon: <Puzzle size={14} /> },
        ] as { key: Tab; label: string; icon: React.ReactNode }[]).map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={clsx(
              'flex-1 flex items-center justify-center gap-1.5 py-2 rounded text-sm font-medium transition-colors',
              tab === key
                ? 'bg-white dark:bg-gray-700 shadow text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            )}
          >
            {icon} {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-400">로딩 중...</div>
      ) : (
        <div className="card overflow-hidden p-0">
          {tab === 'team' ? (
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="text-left py-3 px-4">순위</th>
                  <th className="text-left py-3 px-4">팀</th>
                  <th className="text-right py-3 px-4">레이팅</th>
                  <th className="text-right py-3 px-4">인원</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {teams.map((team, i) => (
                  <tr key={team.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="py-3 px-4">
                      <RankBadge rank={i + 1} />
                    </td>
                    <td className="py-3 px-4 font-medium">{team.name}</td>
                    <td className="py-3 px-4 text-right font-bold">{team.rating}</td>
                    <td className="py-3 px-4 text-right text-gray-500 text-sm">{team.members.length}명</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="text-left py-3 px-4">순위</th>
                  <th className="text-left py-3 px-4">이름</th>
                  <th className="text-right py-3 px-4">{tab === 'puzzle' ? '포인트' : '레이팅'}</th>
                  {tab === 'puzzle' && <th className="text-right py-3 px-4">스트릭</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {users.map((u, i) => {
                  const tier = u.rating ? getTier(u.rating) : null;
                  return (
                    <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="py-3 px-4">
                        <RankBadge rank={i + 1} />
                      </td>
                      <td className="py-3 px-4">
                        <Link
                          to={`/profile/${u.studentId}`}
                          className="font-medium hover:text-blue-600 transition-colors"
                        >
                          {u.name}
                        </Link>
                        {tier && (
                          <span className="ml-2 text-xs" style={{ color: tier.color }}>{tier.name}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-bold">
                        {tab === 'puzzle' ? u.puzzlePoints : u.rating}
                      </td>
                      {tab === 'puzzle' && (
                        <td className="py-3 px-4 text-right text-sm text-orange-500">
                          🔥 {u.puzzleStreak}일
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
};

const RankBadge = ({ rank }: { rank: number }) => {
  if (rank === 1) return <span className="text-xl">🥇</span>;
  if (rank === 2) return <span className="text-xl">🥈</span>;
  if (rank === 3) return <span className="text-xl">🥉</span>;
  return <span className="text-gray-500 font-medium text-sm">{rank}</span>;
};
