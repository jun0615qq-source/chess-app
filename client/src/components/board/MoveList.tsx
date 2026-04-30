import { useRef, useEffect } from 'react';
import { Download } from 'lucide-react';
import clsx from 'clsx';
import { MoveClassification } from '../../types';

// 수 분류 아이콘/색상
const CLASSIFICATION_STYLES: Record<MoveClassification, { label: string; color: string; symbol: string }> = {
  best:      { label: '최선수', color: 'text-green-500',  symbol: '★' },
  excellent: { label: '우수',   color: 'text-teal-500',   symbol: '✓✓' },
  good:      { label: '양호',   color: 'text-blue-500',   symbol: '✓' },
  inaccuracy:{ label: '부정확', color: 'text-yellow-500', symbol: '?!' },
  mistake:   { label: '실수',   color: 'text-orange-500', symbol: '?' },
  blunder:   { label: '대실수', color: 'text-red-500',    symbol: '??' },
};

interface Move {
  san: string;
  classification?: MoveClassification;
}

interface MoveListProps {
  moves: Move[];
  currentMoveIndex: number;
  onMoveClick?: (index: number) => void;
  pgn?: string;
  showClassification?: boolean;
}

export const MoveList = ({
  moves,
  currentMoveIndex,
  onMoveClick,
  pgn,
  showClassification = false,
}: MoveListProps) => {
  const currentRef = useRef<HTMLButtonElement>(null);

  // 현재 수로 자동 스크롤
  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [currentMoveIndex]);

  // PGN 다운로드
  const downloadPgn = () => {
    if (!pgn) return;
    const blob = new Blob([pgn], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `game_${Date.now()}.pgn`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 기보를 2수씩 묶어서 표시
  const movePairs: { white?: Move; black?: Move; pairIndex: number }[] = [];
  for (let i = 0; i < moves.length; i += 2) {
    movePairs.push({ white: moves[i], black: moves[i + 1], pairIndex: i });
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-2 px-1">
        <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400">기보</h3>
        {pgn && (
          <button
            onClick={downloadPgn}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 transition-colors"
            title="PGN 다운로드"
          >
            <Download size={14} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto font-mono text-sm">
        {movePairs.length === 0 ? (
          <p className="text-gray-400 text-xs text-center mt-4">게임이 시작되면 기보가 표시됩니다.</p>
        ) : (
          <div className="grid" style={{ gridTemplateColumns: '2rem 1fr 1fr' }}>
            {movePairs.map(({ white, black, pairIndex }) => (
              <>
                {/* 수 번호 */}
                <span
                  key={`num-${pairIndex}`}
                  className="text-gray-400 text-xs flex items-center py-0.5 px-1"
                >
                  {pairIndex / 2 + 1}.
                </span>

                {/* 백 수 */}
                <MoveButton
                  key={`w-${pairIndex}`}
                  move={white}
                  index={pairIndex}
                  isActive={currentMoveIndex === pairIndex}
                  onClick={onMoveClick}
                  showClassification={showClassification}
                  ref={currentMoveIndex === pairIndex ? currentRef : undefined}
                />

                {/* 흑 수 */}
                <MoveButton
                  key={`b-${pairIndex}`}
                  move={black}
                  index={pairIndex + 1}
                  isActive={currentMoveIndex === pairIndex + 1}
                  onClick={onMoveClick}
                  showClassification={showClassification}
                  ref={currentMoveIndex === pairIndex + 1 ? currentRef : undefined}
                />
              </>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

import { forwardRef } from 'react';

const MoveButton = forwardRef<HTMLButtonElement, {
  move?: Move;
  index: number;
  isActive: boolean;
  onClick?: (index: number) => void;
  showClassification: boolean;
}>(({ move, index, isActive, onClick, showClassification }, ref) => {
  if (!move) return <div />;

  const cls = move.classification ? CLASSIFICATION_STYLES[move.classification] : null;

  return (
    <button
      ref={ref}
      onClick={() => onClick?.(index)}
      className={clsx(
        'text-left py-0.5 px-2 rounded transition-colors text-sm',
        isActive
          ? 'bg-blue-600 text-white font-semibold'
          : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200',
        !onClick && 'cursor-default'
      )}
    >
      {move.san}
      {showClassification && cls && (
        <span className={clsx('ml-1 text-xs', cls.color)}>{cls.symbol}</span>
      )}
    </button>
  );
});
