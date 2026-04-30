// 비속어 필터 - 금지 단어를 *로 치환

const BANNED_WORDS: string[] = [
  '씨발', '시발', '개새끼', '병신', '미친놈', '존나', '좆', '보지', '자지',
  'fuck', 'shit', 'bitch', 'asshole', 'bastard',
];

// 금지 단어를 *로 치환
export const filterProfanity = (text: string): string => {
  let filtered = text;
  for (const word of BANNED_WORDS) {
    const regex = new RegExp(word, 'gi');
    filtered = filtered.replace(regex, '*'.repeat(word.length));
  }
  return filtered;
};
