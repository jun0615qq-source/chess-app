import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { BoardTheme, PieceTheme } from '../types';

interface SettingsState {
  darkMode: boolean;
  boardTheme: BoardTheme;
  pieceTheme: PieceTheme;
  soundEnabled: boolean;
  toggleDarkMode: () => void;
  setBoardTheme: (theme: BoardTheme) => void;
  setPieceTheme: (theme: PieceTheme) => void;
  toggleSound: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      darkMode: false,
      boardTheme: 'green',
      pieceTheme: 'standard',
      soundEnabled: true,

      toggleDarkMode: () =>
        set((state) => {
          const next = !state.darkMode;
          if (next) document.documentElement.classList.add('dark');
          else document.documentElement.classList.remove('dark');
          return { darkMode: next };
        }),

      setBoardTheme: (boardTheme) => set({ boardTheme }),
      setPieceTheme: (pieceTheme) => set({ pieceTheme }),
      toggleSound: () => set((state) => ({ soundEnabled: !state.soundEnabled })),
    }),
    { name: 'chess-settings' }
  )
);
