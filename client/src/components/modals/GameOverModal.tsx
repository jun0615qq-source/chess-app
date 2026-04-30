import { Link } from 'react-router-dom';
import { Trophy, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import clsx from 'clsx';

interface RatingChange {
  before: number;
  after: number;
  change: number;
}

interface GameOverModalProps {
  result: 'white' | 'black' | 'draw';
  reason: string;
  playerColor: 'white' | 'black';
  whiteRating: RatingChange;
  blackRating: RatingChange;
  gameId: number;
  onClose: () => void;
}

const REASON_LABELS: Record<string, string> = {
  checkmate: '체크메이트',
  resign: '기권',
  timeout: '시간 초과',
  agreement: '합의 무승부',
  stalemate: '스테일메이트',
  insufficient: '기물 부족',
  repetition: '3회 반복',
  fifty_move: '50수 규칙',
};

export const GameOverModal = ({
  result,
  reason,
  playerColor,
  whiteRating,
  blackRating,
  gameId,
  onClose,
}: GameOverModalProps) => {
  const isWin = result === playerColor;
  const isDraw = result === 'draw';
  const myRating = playerColor === 'white' ? whiteRating : blackRating;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 animate-fade-in">
      <div className="card max-w-sm w-full mx-4 animate-slide-up">
        {/* 결과 헤더 */}
        <div className={clsx(
          'text-center py-4 rounded-lg mb-4',
          isWin && 'bg-green-100 dark:bg-green-900/30',
          !isWin && !isDraw && 'bg-red-100 dark:bg-red-900/30',
          isDraw && 'bg-gray-100 dark:bg-gray-700',
        )}>
          <div className="text-4xl mb-1">
            {isWin ? '🏆' : isDraw ? '🤝' : '😔'}
          </div>
          <h2 className={clsx(
            'text-2xl font-bold',
            isWin && 'text-green-700 dark:text-green-400',
            !isWin && !isDraw && 'text-red-700 dark:text-red-400',
            isDraw && 'text-gray-600 dark:text-gray-300',
          )}>
            {isWin ? '승리!' : isDraw ? '무승부' : '패배'}
          </h2>
          <p className="text-sm text-gray-500 mt-1">{REASON_LABELS[reason] || reason}</p>
        </div>

        {/* 레이팅 변동 */}
        <div className="flex gap-3 mb-4">
          <RatingCard label="백" ratingChange={whiteRating} />
          <RatingCard label="흑" ratingChange={blackRating} />
        </div>

        {/* 내 레이팅 강조 */}
        <div className={clsx(
          'text-center p-3 rounded-lg mb-4',
          myRating.change > 0 ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'
        )}>
          <p className="text-sm text-gray-500">내 레이팅</p>
          <p className="text-xl font-bold">{myRating.after}</p>
          <p className={clsx(
            'text-sm font-semibold',
            myRating.change > 0 ? 'text-green-600' : myRating.change < 0 ? 'text-red-600' : 'text-gray-500'
          )}>
            {myRating.change > 0 ? `+${myRating.change}` : myRating.change === 0 ? '±0' : myRating.change}
          </p>
        </div>

        {/* 버튼 */}
        <div className="flex gap-2">
          <button onClick={onClose} className="btn-secondary flex-1">
            닫기
          </button>
          <Link to={`/review/${gameId}`} className="btn-primary flex-1 text-center">
            분석 보기
          </Link>
        </div>
      </div>
    </div>
  );
};

const RatingCard = ({ label, ratingChange }: { label: string; ratingChange: RatingChange }) => (
  <div className="flex-1 bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-center">
    <p className="text-xs text-gray-500 mb-1">{label}</p>
    <p className="font-bold">{ratingChange.after}</p>
    <p className={clsx(
      'text-xs font-semibold flex items-center justify-center gap-0.5',
      ratingChange.change > 0 ? 'text-green-500' : ratingChange.change < 0 ? 'text-red-500' : 'text-gray-400'
    )}>
      {ratingChange.change > 0
        ? <TrendingUp size={12} />
        : ratingChange.change < 0
        ? <TrendingDown size={12} />
        : <Minus size={12} />
      }
      {ratingChange.change > 0 ? `+${ratingChange.change}` : ratingChange.change}
    </p>
  </div>
);
