import { Link, useNavigate } from 'react-router-dom';
import { Moon, Sun, Trophy, User, LogOut, Home, Puzzle, BarChart2 } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useSettingsStore } from '../../store/settingsStore';
import { getTier } from '../../utils/tier';
import toast from 'react-hot-toast';

export const Navbar = () => {
  const { user, logout } = useAuthStore();
  const { darkMode, toggleDarkMode } = useSettingsStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    toast.success('로그아웃 되었습니다.');
    navigate('/login');
  };

  const tier = user ? getTier(user.rating) : null;

  return (
    <nav className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* 로고 */}
        <Link to="/" className="flex items-center gap-2 font-bold text-xl text-blue-600 dark:text-blue-400">
          ♟️ 학급 체스
        </Link>

        {/* 네비게이션 링크 */}
        {user && (
          <div className="hidden md:flex items-center gap-1">
            <NavLink to="/" icon={<Home size={16} />} label="홈" />
            <NavLink to="/puzzle" icon={<Puzzle size={16} />} label="퍼즐" />
            <NavLink to="/leaderboard" icon={<BarChart2 size={16} />} label="랭킹" />
          </div>
        )}

        {/* 우측 메뉴 */}
        <div className="flex items-center gap-3">
          <button
            onClick={toggleDarkMode}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="테마 토글"
          >
            {darkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {user ? (
            <>
              <Link
                to={`/profile/${user.studentId}`}
                className="flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-700 px-3 py-1.5 rounded-lg transition-colors"
              >
                <User size={16} />
                <span className="text-sm font-medium">{user.name}</span>
                {tier && (
                  <span className="text-xs font-bold" style={{ color: tier.color }}>
                    {tier.name}
                  </span>
                )}
                <span className="text-sm text-gray-500">{user.rating}</span>
              </Link>
              <button
                onClick={handleLogout}
                className="p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 transition-colors"
                aria-label="로그아웃"
              >
                <LogOut size={18} />
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Link to="/login" className="btn-secondary text-sm py-1.5 px-3">로그인</Link>
              <Link to="/register" className="btn-primary text-sm py-1.5 px-3">회원가입</Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

const NavLink = ({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) => (
  <Link
    to={to}
    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
  >
    {icon}
    {label}
  </Link>
);
