import clsx from 'clsx';
import { formatTime } from '../../utils/tier';

interface GameTimerProps {
  time: number; // 초
  isActive: boolean; // 현재 이 타이머가 실행 중인지
  color: 'white' | 'black';
  playerName: string;
  rating: number;
}

export const GameTimer = ({ time, isActive, color, playerName, rating }: GameTimerProps) => {
  const isLowTime = time < 30 && isFinite(time);

  return (
    <div
      className={clsx(
        'flex items-center justify-between px-4 py-2 rounded-lg transition-colors',
        isActive
          ? 'bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900 shadow-lg'
          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400',
        color === 'white' && 'border-2 border-white',
        color === 'black' && 'border-2 border-gray-800'
      )}
    >
      <div className="flex items-center gap-2">
        {/* 기물 색상 표시 */}
        <div
          className={clsx(
            'w-5 h-5 rounded-full border-2',
            color === 'white'
              ? 'bg-white border-gray-300'
              : 'bg-gray-900 border-gray-600'
          )}
        />
        <div>
          <p className="font-semibold text-sm leading-none">{playerName}</p>
          <p className="text-xs opacity-70">{rating}</p>
        </div>
      </div>

      {/* 타이머 */}
      <div
        className={clsx(
          'font-mono text-2xl font-bold tracking-tight',
          isLowTime && isActive && 'text-red-500 animate-pulse'
        )}
      >
        {formatTime(time)}
      </div>
    </div>
  );
};
