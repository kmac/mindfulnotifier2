import { MAX_BACKGROUND_TASK_HISTORY, MAX_DEBUG_INFO, BACKGROUND_TASK_INTERVAL_MINUTES, MIN_NOTIFICATION_BUFFER } from '@/constants/scheduleConstants';
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';

export type ColorScheme = 'light' | 'dark' | 'auto';

export interface PreferencesState {
  isEnabled: boolean;
  notificationsGranted: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  colorScheme: ColorScheme;
  backgroundImageEnabled: boolean;
  debugInfoEnabled: boolean;
  debugInfo: string[];
  lastBufferReplenishTime: number | null; // timestamp
  backgroundTaskRunHistory: number[]; // Array of timestamps when background task ran
  backgroundTaskIntervalMinutes: number;
  minNotificationBuffer: number;
}

const initialState: PreferencesState = {
  isEnabled: false,
  notificationsGranted: false,
  soundEnabled: true,
  vibrationEnabled: true,
  colorScheme: 'auto',
  backgroundImageEnabled: true,
  debugInfoEnabled: false,
  debugInfo: [],
  lastBufferReplenishTime: null,
  backgroundTaskRunHistory: [],
  backgroundTaskIntervalMinutes: BACKGROUND_TASK_INTERVAL_MINUTES,
  minNotificationBuffer: MIN_NOTIFICATION_BUFFER,
};

/**
 * Async thunk to clear debug info and background task data
 * Clears both Redux state and AsyncStorage
 */
export const clearDebugInfoAsync = createAsyncThunk(
  'preferences/clearDebugInfo',
  async () => {
    // Import here to avoid circular dependency
    const { clearBackgroundTaskData } = await import('@/services/backgroundTaskService');
    await clearBackgroundTaskData();
  }
);

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
    setBackgroundImageEnabled: (state, action: PayloadAction<boolean>) => {
      state.backgroundImageEnabled = action.payload;
    },
    setDebugInfoEnabled: (state, action: PayloadAction<boolean>) => {
      state.debugInfoEnabled = action.payload;
    },
    addDebugInfo: (state, action: PayloadAction<string>) => {
      // Keep only the last N debug messages to prevent unbounded growth
      state.debugInfo.push(action.payload);
      if (state.debugInfo.length > MAX_DEBUG_INFO) {
        state.debugInfo = state.debugInfo.slice(-MAX_DEBUG_INFO);
      }
    },
    clearDebugInfo: (state) => {
      state.debugInfo = [];
      state.backgroundTaskRunHistory = [];
    },
    setLastBufferReplenishTime: (state, action: PayloadAction<number>) => {
      state.lastBufferReplenishTime = action.payload;
    },
    addBackgroundTaskRun: (state, action: PayloadAction<number>) => {
      // Only add if this timestamp doesn't already exist (deduplication)
      if (!state.backgroundTaskRunHistory.includes(action.payload)) {
        state.backgroundTaskRunHistory.push(action.payload);
        // Keep only the last N run timestamps
        if (state.backgroundTaskRunHistory.length > MAX_BACKGROUND_TASK_HISTORY) {
          state.backgroundTaskRunHistory = state.backgroundTaskRunHistory.slice(-MAX_BACKGROUND_TASK_HISTORY);
        }
      }
    },
    setBackgroundTaskIntervalMinutes: (state, action: PayloadAction<number>) => {
      state.backgroundTaskIntervalMinutes = action.payload;
    },
    setMinNotificationBuffer: (state, action: PayloadAction<number>) => {
      state.minNotificationBuffer = action.payload;
    },
    resetPreferences: () => initialState,
  },
  extraReducers: (builder) => {
    builder.addCase(clearDebugInfoAsync.fulfilled, (state) => {
      // Clear Redux state when AsyncStorage clear is complete
      state.debugInfo = [];
      state.backgroundTaskRunHistory = [];
    });
  },
});

export const {
  setEnabled,
  setNotificationsGranted,
  setSoundEnabled,
  setVibrationEnabled,
  setColorScheme,
  setBackgroundImageEnabled,
  setDebugInfoEnabled,
  addDebugInfo,
  clearDebugInfo,
  setLastBufferReplenishTime,
  addBackgroundTaskRun,
  setBackgroundTaskIntervalMinutes,
  setMinNotificationBuffer,
  resetPreferences,
} = preferencesSlice.actions;

export default preferencesSlice.reducer;
