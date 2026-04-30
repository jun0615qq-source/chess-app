import { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Navbar } from './components/layout/Navbar';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { GamePage } from './pages/GamePage';
import { ReviewPage } from './pages/ReviewPage';
import { PuzzlePage } from './pages/PuzzlePage';
import { LeaderboardPage } from './pages/LeaderboardPage';
import { ProfilePage } from './pages/ProfilePage';
import { TournamentPage } from './pages/TournamentPage';
import { LeaguePage } from './pages/LeaguePage';
import { MultiGamePage } from './pages/MultiGamePage';
import { TeamCreatePage } from './pages/TeamCreatePage';
import { TeamGamePage } from './pages/TeamGamePage';
import { useAuthStore } from './store/authStore';
import { useSettingsStore } from './store/settingsStore';
import api from './utils/api';

// 인증 필요 경로 보호
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuthStore();
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

// 이미 로그인된 경우 리다이렉트
const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuthStore();
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
};

// 퍼즐 아카이브 페이지
const PuzzleArchivePage = () => {
  const [puzzles, setPuzzles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/puzzles/archive').then((res) => {
      setPuzzles(res.data);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64">로딩 중...</div>;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-4">퍼즐 아카이브</h1>
      <div className="space-y-2">
        {puzzles.map((p: any) => (
          <div key={p.id} className="card flex items-center justify-between p-4">
            <div>
              <p className="font-medium">{new Date(p.date).toLocaleDateString('ko-KR')}</p>
              <p className="text-xs text-gray-500">{p.theme} · {p.difficulty}</p>
            </div>
            <div>
              {p.results?.[0]
                ? p.results[0].solved
                  ? <span className="text-green-500 font-bold">✓ 성공 (+{p.results[0].pointsEarned}점)</span>
                  : <span className="text-red-500">✗ 실패</span>
                : <span className="text-gray-400 text-sm">미풀이</span>
              }
            </div>
          </div>
        ))}
        {puzzles.length === 0 && (
          <p className="text-center text-gray-400 py-8">퍼즐 기록이 없습니다.</p>
        )}
      </div>
    </div>
  );
};

export default function App() {
  const { darkMode } = useSettingsStore();

  // 다크모드 초기 적용
  useEffect(() => {
    if (darkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [darkMode]);

  return (
    <div className="min-h-screen">
      <Navbar />
      <main>
        <Routes>
          {/* 공개 경로 */}
          <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />

          {/* 인증 필요 경로 */}
          <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
          <Route path="/game/:id" element={<ProtectedRoute><GamePage /></ProtectedRoute>} />
          <Route path="/multi/:roomId" element={<ProtectedRoute><MultiGamePage /></ProtectedRoute>} />
          <Route path="/team/create" element={<ProtectedRoute><TeamCreatePage /></ProtectedRoute>} />
          <Route path="/team/:roomId" element={<ProtectedRoute><TeamGamePage /></ProtectedRoute>} />
          <Route path="/review/:gameId" element={<ProtectedRoute><ReviewPage /></ProtectedRoute>} />
          <Route path="/puzzle" element={<ProtectedRoute><PuzzlePage /></ProtectedRoute>} />
          <Route path="/puzzle/archive" element={<ProtectedRoute><PuzzleArchivePage /></ProtectedRoute>} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="/profile/:studentId" element={<ProfilePage />} />
          <Route path="/tournament/:id" element={<ProtectedRoute><TournamentPage /></ProtectedRoute>} />
          <Route path="/league/:id" element={<ProtectedRoute><LeaguePage /></ProtectedRoute>} />

          {/* 404 리다이렉트 */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
