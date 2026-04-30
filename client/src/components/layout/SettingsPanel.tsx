import { useSettingsStore } from '../../store/settingsStore';
import clsx from 'clsx';

// 설정 패널 (홈 화면 또는 모달에서 사용)
export const SettingsPanel = () => {
  const {
    boardTheme, setBoardTheme,
    pieceTheme, setPieceTheme,
    soundEnabled, toggleSound,
  } = useSettingsStore();

  const boardThemes = [
    { key: 'green' as const, label: '녹색', light: '#eeeed2', dark: '#769656' },
    { key: 'brown' as const, label: '갈색', light: '#f0d9b5', dark: '#b58863' },
    { key: 'blue' as const, label: '파란색', light: '#dee3e6', dark: '#8ca2ad' },
  ];

  return (
    <div className="space-y-4">
      {/* 보드 색상 */}
      <div>
        <p className="text-sm font-semibold mb-2">보드 색상</p>
        <div className="flex gap-2">
          {boardThemes.map((theme) => (
            <button
              key={theme.key}
              onClick={() => setBoardTheme(theme.key)}
              className={clsx(
                'flex flex-col items-center gap-1 p-2 rounded-lg border-2 transition-colors',
                boardTheme === theme.key
                  ? 'border-blue-500'
                  : 'border-transparent hover:border-gray-300'
              )}
            >
              {/* 미니 보드 프리뷰 */}
              <div className="grid grid-cols-4 w-12 h-12 rounded overflow-hidden">
                {Array.from({ length: 16 }).map((_, i) => (
                  <div
                    key={i}
                    style={{
                      background:
                        (Math.floor(i / 4) + i) % 2 === 0 ? theme.light : theme.dark,
                    }}
                  />
                ))}
              </div>
              <span className="text-xs">{theme.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 기물 테마 */}
      <div>
        <p className="text-sm font-semibold mb-2">기물 테마</p>
        <div className="flex gap-2">
          {(['standard', 'classic'] as const).map((theme) => (
            <button
              key={theme}
              onClick={() => setPieceTheme(theme)}
              className={clsx(
                'px-4 py-2 rounded-lg border-2 text-sm transition-colors',
                pieceTheme === theme
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-600'
                  : 'border-gray-200 dark:border-gray-600 hover:border-gray-400'
              )}
            >
              {theme === 'standard' ? '기본' : '클래식'}
            </button>
          ))}
        </div>
      </div>

      {/* 효과음 */}
      <div>
        <label className="flex items-center gap-3 cursor-pointer">
          <div
            className={clsx(
              'w-10 h-6 rounded-full transition-colors relative',
              soundEnabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
            )}
            onClick={toggleSound}
          >
            <div
              className={clsx(
                'absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform',
                soundEnabled ? 'translate-x-5' : 'translate-x-1'
              )}
            />
          </div>
          <span className="text-sm font-medium">효과음</span>
        </label>
      </div>
    </div>
  );
};
