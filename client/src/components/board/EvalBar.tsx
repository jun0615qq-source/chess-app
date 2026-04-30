// 엔진 평가 막대 컴포넌트 (흑/백 유리함 시각화)

interface EvalBarProps {
  score: number; // centipawn (양수=백 유리, 음수=흑 유리)
  orientation?: 'white' | 'black';
}

const scoreToPercent = (score: number): number => {
  // 점수를 0~100% 사이로 변환 (50% = 균등)
  const capped = Math.max(-1000, Math.min(1000, score));
  return 50 + (capped / 1000) * 40;
};

export const EvalBar = ({ score, orientation = 'white' }: EvalBarProps) => {
  const whitePercent = scoreToPercent(score);
  const blackPercent = 100 - whitePercent;

  const topPercent = orientation === 'white' ? blackPercent : whitePercent;
  const topColor = orientation === 'white' ? '#1a1a1a' : '#f0f0f0';
  const bottomColor = orientation === 'white' ? '#f0f0f0' : '#1a1a1a';

  const displayScore = Math.abs(score) >= 1000
    ? `M${Math.ceil(Math.abs(score) / 100)}`
    : (score > 0 ? '+' : '') + (score / 100).toFixed(1);

  return (
    <div className="flex flex-col items-center gap-1 select-none">
      <span className="text-xs font-mono text-gray-500 dark:text-gray-400 font-bold">
        {displayScore}
      </span>
      <div
        className="w-5 rounded overflow-hidden relative"
        style={{ height: '400px', background: bottomColor }}
      >
        {/* 상단 색상 (불리한 쪽) */}
        <div
          className="absolute top-0 left-0 right-0 transition-all duration-300"
          style={{ height: `${topPercent}%`, background: topColor }}
        />
        {/* 중간선 */}
        <div
          className="absolute left-0 right-0 bg-gray-400"
          style={{ top: '50%', height: '1px' }}
        />
      </div>
    </div>
  );
};
