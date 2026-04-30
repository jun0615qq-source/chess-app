// 수정된 Elo 레이팅 계산 모듈

// K-factor: 레이팅 구간에 따라 변동 속도 결정
const getKFactor = (rating: number): number => {
  if (rating < 1400) return 40;
  if (rating < 1800) return 20;
  return 10;
};

// 레이팅 차이에 따른 배율 결정
const getMultiplier = (gap: number): number => {
  if (gap < 100) return 1.0;
  if (gap < 200) return 1.2;
  if (gap < 300) return 1.5;
  if (gap < 400) return 1.8;
  return 2.2;
};

// 기댓값 계산 (Elo 공식)
const getExpected = (myRating: number, opponentRating: number): number => {
  return 1 / (1 + Math.pow(10, (opponentRating - myRating) / 400));
};

export interface RatingResult {
  newRating: number;
  change: number;
  gap: number;
  multiplier: number;
}

// 게임 결과에 따른 레이팅 변동 계산
// score: 1=승리, 0.5=무승부, 0=패배
export const calculateRatingChange = (
  myRating: number,
  opponentRating: number,
  score: number
): RatingResult => {
  const k = getKFactor(myRating);
  const expected = getExpected(myRating, opponentRating);
  const gap = Math.abs(myRating - opponentRating);
  const multiplier = getMultiplier(gap);

  const baseChange = k * (score - expected);
  const adjustedChange = Math.round(baseChange * multiplier);

  const newRating = Math.max(100, myRating + adjustedChange); // 최소 레이팅 100

  return {
    newRating,
    change: adjustedChange,
    gap,
    multiplier,
  };
};

// 티어 이름 반환
export const getTier = (rating: number): string => {
  if (rating < 1200) return 'bronze';
  if (rating < 1400) return 'silver';
  if (rating < 1600) return 'gold';
  if (rating < 1800) return 'platinum';
  return 'diamond';
};

// 티어 한국어 이름
export const getTierKorean = (rating: number): string => {
  if (rating < 1200) return '브론즈';
  if (rating < 1400) return '실버';
  if (rating < 1600) return '골드';
  if (rating < 1800) return '플래티넘';
  return '다이아';
};
