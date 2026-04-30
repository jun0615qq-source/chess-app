import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Trophy, Star, Flame, TrendingUp } from 'lucide-react';
import api from '../utils/api';
import { getTier } from '../utils/tier';
import { User, Badge } from '../types';

interface ProfileData extends User {
  tier: string;
  badges: Badge[];
  stats: { wins: number; losses: number; draws: number };
  ratingHistory: { before: number; after: number; change: number; createdAt: string }[];
}

export const ProfilePage = () => {
  const { studentId } = useParams<{ studentId: string }>();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/api/profile/${studentId}`)
      .then((res) => setProfile(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [studentId]);

  if (loading) return <div className="flex items-center justify-center h-64">로딩 중...</div>;
  if (!profile) return <div className="text-center py-8 text-gray-500">사용자를 찾을 수 없습니다.</div>;

  const tier = getTier(profile.rating);
  const totalGames = profile.stats.wins + profile.stats.losses + profile.stats.draws;
  const winRate = totalGames > 0 ? Math.round((profile.stats.wins / totalGames) * 100) : 0;

  const BADGE_LABELS: Record<string, string> = {
    tournament_win: '🏆 토너먼트 우승',
    league_win: '🥇 리그 우승',
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
      {/* 프로필 헤더 */}
      <div className="card flex items-center gap-4">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-2xl flex-shrink-0"
          style={{ background: tier.color }}
        >
          {profile.name[0]}
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{profile.name}</h1>
          <p className="text-gray-500 text-sm">{profile.studentId}</p>
          <div className="flex items-center gap-3 mt-1">
            <span className="font-bold text-lg" style={{ color: tier.color }}>
              {tier.name} {profile.rating}
            </span>
            {profile.puzzleStreak! > 0 && (
              <span className="flex items-center gap-1 text-orange-500 text-sm">
                <Flame size={14} /> {profile.puzzleStreak}일 연속
              </span>
            )}
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-500">퍼즐 포인트</p>
          <p className="text-xl font-bold text-purple-600">{profile.puzzlePoints || 0}</p>
        </div>
      </div>

      {/* 전적 통계 */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: '전체', value: totalGames, color: 'text-gray-700 dark:text-gray-300' },
          { label: '승', value: profile.stats.wins, color: 'text-green-600' },
          { label: '무', value: profile.stats.draws, color: 'text-yellow-600' },
          { label: '패', value: profile.stats.losses, color: 'text-red-600' },
        ].map(({ label, value, color }) => (
          <div key={label} className="card text-center p-3">
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-gray-500">{label}</p>
          </div>
        ))}
      </div>

      {/* 승률 바 */}
      {totalGames > 0 && (
        <div className="card">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-green-600 font-medium">승 {profile.stats.wins}</span>
            <span className="font-bold">{winRate}% 승률</span>
            <span className="text-red-600 font-medium">패 {profile.stats.losses}</span>
          </div>
          <div className="flex rounded-full overflow-hidden h-3">
            <div className="bg-green-500" style={{ width: `${winRate}%` }} />
            <div className="bg-yellow-400" style={{ width: `${totalGames > 0 ? (profile.stats.draws / totalGames) * 100 : 0}%` }} />
            <div className="bg-red-500 flex-1" />
          </div>
        </div>
      )}

      {/* 뱃지 */}
      {profile.badges?.length > 0 && (
        <div className="card">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <Trophy size={16} /> 뱃지
          </h3>
          <div className="flex flex-wrap gap-2">
            {profile.badges.map((badge) => (
              <span
                key={badge.id}
                className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 text-xs font-medium px-3 py-1 rounded-full"
              >
                {BADGE_LABELS[badge.type] || badge.type}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 레이팅 변동 히스토리 */}
      {profile.ratingHistory?.length > 0 && (
        <div className="card">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <TrendingUp size={16} /> 최근 레이팅 변동
          </h3>
          <div className="space-y-1">
            {profile.ratingHistory.slice(-10).reverse().map((h, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-gray-500 text-xs">
                  {new Date(h.createdAt).toLocaleDateString('ko-KR')}
                </span>
                <span>{h.after}</span>
                <span className={h.change > 0 ? 'text-green-500' : h.change < 0 ? 'text-red-500' : 'text-gray-400'}>
                  {h.change > 0 ? `+${h.change}` : h.change}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
