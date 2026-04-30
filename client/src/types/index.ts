// 공통 타입 정의

export interface User {
  id: number;
  studentId: string;
  name: string;
  role: 'student' | 'admin';
  rating: number;
  teamRating?: number;
  puzzlePoints?: number;
  puzzleStreak?: number;
  createdAt?: string;
}

export interface Game {
  id: number;
  white: User;
  black: User;
  whiteId: number;
  blackId: number;
  pgn: string;
  result: 'white' | 'black' | 'draw' | null;
  reason: string | null;
  timeControl: string;
  gameMode: string;
  createdAt: string;
  ratingChanges?: RatingHistory[];
}

export interface RatingHistory {
  id: number;
  userId: number;
  gameId: number;
  before: number;
  after: number;
  change: number;
  gap: number;
  multiplier: number;
  createdAt: string;
}

export interface Puzzle {
  id: number;
  date: string;
  fen: string;
  solution?: string[];
  difficulty: 'easy' | 'medium' | 'hard';
  theme: string;
}

export interface PuzzleResult {
  id: number;
  userId: number;
  puzzleId: number;
  solved: boolean;
  attempts: number;
  pointsEarned: number;
  createdAt: string;
}

export interface Tournament {
  id: number;
  name: string;
  hostId: number;
  format: 'single_elim' | 'double_elim';
  timeControl: string;
  status: 'waiting' | 'ongoing' | 'finished';
  participants: TournamentParticipant[];
  games: Game[];
  createdAt: string;
}

export interface TournamentParticipant {
  id: number;
  tournamentId: number;
  userId: number;
  seed: number | null;
  eliminated: boolean;
}

export interface League {
  id: number;
  name: string;
  hostId: number;
  timeControl: string;
  status: 'waiting' | 'ongoing' | 'finished';
  participants: LeagueParticipant[];
  games: Game[];
  createdAt: string;
}

export interface LeagueParticipant {
  id: number;
  leagueId: number;
  userId: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
}

export interface Badge {
  id: number;
  userId: number;
  type: 'tournament_win' | 'league_win';
  sourceId: number;
  createdAt: string;
}

// 게임 상태 (클라이언트)
export interface GameState {
  fen: string;
  pgn: string;
  whiteTime: number;
  blackTime: number;
  turn: 'w' | 'b';
  result?: 'white' | 'black' | 'draw';
  reason?: string;
}

// 수 분류 (게임 리뷰)
export type MoveClassification =
  | 'best' | 'excellent' | 'good'
  | 'inaccuracy' | 'mistake' | 'blunder';

export interface AnalyzedMove {
  san: string;
  fen: string;
  classification: MoveClassification;
  scoreBefore: number;
  scoreAfter: number;
  bestMove?: string;
  bestScore?: number;
}

// 테마/설정
export type BoardTheme = 'green' | 'brown' | 'blue';
export type PieceTheme = 'standard' | 'classic';
