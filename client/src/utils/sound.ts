// 효과음 재생 유틸리티
// Web Audio API를 사용해 별도 파일 없이 효과음 생성

let audioContext: AudioContext | null = null;

const getAudioContext = (): AudioContext => {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
};

const playTone = (frequency: number, duration: number, type: OscillatorType = 'sine', volume = 0.3): void => {
  try {
    const ctx = getAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);
    gainNode.gain.setValueAtTime(volume, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + duration);
  } catch {}
};

export const sounds = {
  move: () => playTone(440, 0.1, 'triangle', 0.2),
  capture: () => {
    playTone(300, 0.05, 'sawtooth', 0.3);
    setTimeout(() => playTone(250, 0.1, 'sawtooth', 0.2), 50);
  },
  check: () => {
    playTone(600, 0.1, 'square', 0.3);
    setTimeout(() => playTone(500, 0.15, 'square', 0.3), 100);
  },
  gameEnd: () => {
    playTone(440, 0.2, 'sine', 0.3);
    setTimeout(() => playTone(550, 0.2, 'sine', 0.3), 200);
    setTimeout(() => playTone(660, 0.4, 'sine', 0.3), 400);
  },
  illegal: () => playTone(200, 0.2, 'square', 0.2),
};
