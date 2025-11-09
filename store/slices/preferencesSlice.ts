import { MAX_BACKGROUND_TASK_HISTORY } from '@/constants/scheduleConstants';
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type ColorScheme = 'light' | 'dark' | 'auto';

export interface PreferencesState {
  isEnabled: boolean;
  notificationsGranted: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  colorScheme: ColorScheme;
  debugInfoEnabled: boolean;
  debugInfo: string[];
  lastBufferReplenishTime: number | null; // timestamp
  backgroundTaskRunHistory: number[]; // Array of timestamps when background task ran
}

const initialState: PreferencesState = {
  isEnabled: false,
  notificationsGranted: false,
  soundEnabled: true,
  vibrationEnabled: true,
  colorScheme: 'auto',
  debugInfoEnabled: false,
  debugInfo: [],
  lastBufferReplenishTime: null,
  backgroundTaskRunHistory: [],
};

const preferencesSlice = createSlice({
  name: 'preferences',
  initialState,
  reducers: {
    setEnabled: (state, action: PayloadAction<boolean>) => {
      state.isEnabled = action.payload;
    },
    setNotificationsGranted: (state, action: PayloadAction<boolean>) => {
      state.notificationsGranted = action.payload;
    },
    setSoundEnabled: (state, action: PayloadAction<boolean>) => {
      state.soundEnabled = action.payload;
    },
    setVibrationEnabled: (state, action: PayloadAction<boolean>) => {
      state.vibrationEnabled = action.payload;
    },
    setColorScheme: (state, action: PayloadAction<ColorScheme>) => {
      state.colorScheme = action.payload;
    },
    setDebugInfoEnabled: (state, action: PayloadAction<boolean>) => {
      state.debugInfoEnabled = action.payload;
    },
    addDebugInfo: (state, action: PayloadAction<string>) => {
      // Keep only the last N debug messages to prevent unbounded growth
      const MAX_DEBUG_INFO = 100;
      state.debugInfo.push(action.payload);
      if (state.debugInfo.length > MAX_DEBUG_INFO) {
        state.debugInfo = state.debugInfo.slice(-MAX_DEBUG_INFO);
      }
    },
    clearDebugInfo: (state) => {
      state.debugInfo = [];
    },
    setLastBufferReplenishTime: (state, action: PayloadAction<number>) => {
      state.lastBufferReplenishTime = action.payload;
    },
    addBackgroundTaskRun: (state, action: PayloadAction<number>) => {
      // Keep only the last N run timestamps
      state.backgroundTaskRunHistory.push(action.payload);
      if (state.backgroundTaskRunHistory.length > MAX_BACKGROUND_TASK_HISTORY) {
        state.backgroundTaskRunHistory = state.backgroundTaskRunHistory.slice(-MAX_BACKGROUND_TASK_HISTORY);
      }
    },
    resetPreferences: () => initialState,
  },
});

export const {
  setEnabled,
  setNotificationsGranted,
  setSoundEnabled,
  setVibrationEnabled,
  setColorScheme,
  setDebugInfoEnabled,
  addDebugInfo,
  clearDebugInfo,
  setLastBufferReplenishTime,
  addBackgroundTaskRun,
  resetPreferences,
} = preferencesSlice.actions;

export default preferencesSlice.reducer;
