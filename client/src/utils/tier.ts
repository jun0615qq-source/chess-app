// 티어 관련 유틸리티

export const getTier = (rating: number) => {
  if (rating < 1200) return { name: '브론즈', color: '#cd7f32', key: 'bronze' };
  if (rating < 1400) return { name: '실버', color: '#c0c0c0', key: 'silver' };
  if (rating < 1600) return { name: '골드', color: '#ffd700', key: 'gold' };
  if (rating < 1800) return { name: '플래티넘', color: '#e5e4e2', key: 'platinum' };
  return { name: '다이아', color: '#b9f2ff', key: 'diamond' };
};

export const formatTime = (seconds: number): string => {
  if (!isFinite(seconds)) return '∞';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
};

export const getTimeControlLabel = (tc: string): string => {
  const map: Record<string, string> = {
    '1+0': '1분', '3+0': '3분', '5+0': '5분',
    '10+0': '10분', unlimited: '무제한',
  };
  return map[tc] || tc;
};
