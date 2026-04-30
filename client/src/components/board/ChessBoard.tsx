import { useState, useCallback, useEffect } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess, Move } from 'chess.js';
import { Square } from 'react-chessboard/dist/chessboard/types';
import { useSettingsStore } from '../../store/settingsStore';
import { sounds } from '../../utils/sound';

interface ChessBoardProps {
  fen: string;
  orientation?: 'white' | 'black';
  onMove?: (from: string, to: string, promotion?: string) => boolean;
  disabled?: boolean;
  showCoordinates?: boolean;
  lastMove?: { from: string; to: string };
  premove?: { from: string; to: string };
  checkSquare?: string;
  reviewMode?: boolean;
  boardWidth?: number;
}

const BOARD_COLORS = {
  green: { light: '#eeeed2', dark: '#769656' },
  brown: { light: '#f0d9b5', dark: '#b58863' },
  blue:  { light: '#dee3e6', dark: '#8ca2ad' },
};

const DEFAULT_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export const ChessBoard = ({
  fen,
  orientation = 'white',
  onMove,
  disabled = false,
  showCoordinates = true,
  lastMove,
  premove,
  checkSquare,
  reviewMode = false,
  boardWidth = 480,
}: ChessBoardProps) => {
  const { boardTheme, soundEnabled } = useSettingsStore();
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [optionSquares, setOptionSquares] = useState<Record<string, React.CSSProperties>>({});
  const [chess] = useState(() => new Chess());

  // 안전한 FEN (빈 문자열 방어)
  const safeFen = fen && fen.trim().length > 0 ? fen : DEFAULT_FEN;

  useEffect(() => {
    try { chess.load(safeFen); } catch {}
    setSelectedSquare(null);
    setOptionSquares({});
  }, [safeFen, chess]);

  // 합법적 이동 가능 칸 계산
  const getMoveOptions = useCallback((square: string): Record<string, React.CSSProperties> => {
    try {
      const tempChess = new Chess(safeFen);
      const moves = tempChess.moves({ square: square as Square, verbose: true }) as Move[];
      if (!moves.length) return {};

      const squares: Record<string, React.CSSProperties> = {};
      moves.forEach((move) => {
        squares[move.to] = {
          background: tempChess.get(move.to as Square)
            ? 'radial-gradient(circle, rgba(255,0,0,0.4) 85%, transparent 85%)'
            : 'radial-gradient(circle, rgba(0,0,0,0.15) 30%, transparent 30%)',
          borderRadius: '50%',
        };
      });
      squares[square] = { background: 'rgba(255, 255, 0, 0.4)' };
      return squares;
    } catch {
      return {};
    }
  }, [safeFen]);

  // 칸 클릭
  const onSquareClick = useCallback((square: string) => {
    if (disabled || reviewMode) return;

    // 선택 해제
    if (selectedSquare === square) {
      setSelectedSquare(null);
      setOptionSquares({});
      return;
    }

    // 이동 시도
    if (selectedSquare && optionSquares[square]) {
      try {
        const tempChess = new Chess(safeFen);
        const piece = tempChess.get(selectedSquare as Square);
        const isPromotion =
          piece?.type === 'p' &&
          ((piece.color === 'w' && square[1] === '8') ||
           (piece.color === 'b' && square[1] === '1'));

        if (onMove) {
          const success = onMove(selectedSquare, square, isPromotion ? 'q' : undefined);
          if (success && soundEnabled) sounds.move();
        }
      } catch {}
      setSelectedSquare(null);
      setOptionSquares({});
      return;
    }

    // 기물 선택
    try {
      const tempChess = new Chess(safeFen);
      const piece = tempChess.get(square as Square);
      if (piece) {
        setSelectedSquare(square);
        setOptionSquares(getMoveOptions(square));
      } else {
        setSelectedSquare(null);
        setOptionSquares({});
      }
    } catch {}
  }, [disabled, reviewMode, selectedSquare, optionSquares, safeFen, onMove, getMoveOptions, soundEnabled]);

  // 드래그 앤 드롭
  const onPieceDrop = useCallback((sourceSquare: string, targetSquare: string): boolean => {
    if (disabled || reviewMode) return false;

    try {
      const tempChess = new Chess(safeFen);
      const piece = tempChess.get(sourceSquare as Square);
      const isPromotion =
        piece?.type === 'p' &&
        ((piece.color === 'w' && targetSquare[1] === '8') ||
         (piece.color === 'b' && targetSquare[1] === '1'));

      if (onMove) {
        const success = onMove(sourceSquare, targetSquare, isPromotion ? 'q' : undefined);
        if (success && soundEnabled) sounds.move();
        setSelectedSquare(null);
        setOptionSquares({});
        return success;
      }
    } catch {}
    return false;
  }, [disabled, reviewMode, safeFen, onMove, soundEnabled]);

  // 커스텀 하이라이트 합산
  const customSquareStyles: Record<string, React.CSSProperties> = { ...optionSquares };

  if (lastMove) {
    customSquareStyles[lastMove.from] = { background: 'rgba(155, 199, 0, 0.41)' };
    customSquareStyles[lastMove.to]   = { background: 'rgba(155, 199, 0, 0.41)' };
  }
  if (premove) {
    customSquareStyles[premove.from] = { background: 'rgba(128, 0, 255, 0.4)' };
    customSquareStyles[premove.to]   = { background: 'rgba(128, 0, 255, 0.3)' };
  }
  if (checkSquare) {
    customSquareStyles[checkSquare] = {
      background: 'radial-gradient(circle, rgba(255,0,0,0.8) 40%, rgba(255,100,0,0.5) 70%, transparent 100%)',
    };
  }

  const colors = BOARD_COLORS[boardTheme];

  return (
    <div style={{ width: boardWidth }}>
      <Chessboard
        position={safeFen}
        boardWidth={boardWidth}
        onSquareClick={onSquareClick}
        onPieceDrop={onPieceDrop}
        boardOrientation={orientation}
        showBoardNotation={showCoordinates}
        customBoardStyle={{
          borderRadius: '4px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        }}
        customDarkSquareStyle={{ backgroundColor: colors.dark }}
        customLightSquareStyle={{ backgroundColor: colors.light }}
        customSquareStyles={customSquareStyles}
        arePiecesDraggable={!disabled && !reviewMode}
      />
    </div>
  );
};
