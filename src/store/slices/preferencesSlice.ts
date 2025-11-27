import { MAX_BACKGROUND_TASK_HISTORY, MAX_DEBUG_INFO, BACKGROUND_TASK_INTERVAL_MINUTES, MIN_NOTIFICATION_BUFFER } from '@/src/constants/scheduleConstants';
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
  backgroundTaskRunHistory: [],
  backgroundTaskIntervalMinutes: BACKGROUND_TASK_INTERVAL_MINUTES,
  minNotificationBuffer: MIN_NOTIFICATION_BUFFER,
};

/**
 * Async thunk to clear debug info and background task data
 * Clears AsyncStorage debug logs and background task history
 */
export const clearDebugInfoAsync = createAsyncThunk(
  'preferences/clearDebugInfo',
  async () => {
    // Import here to avoid circular dependency
    const { clearBackgroundTaskData } = await import('@/src/services/backgroundTaskService');
    const { clearDebugLogs } = await import('@/src/utils/debug');
    await Promise.all([
      clearBackgroundTaskData(),
      clearDebugLogs(),
    ]);
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
    clearDebugInfo: (state) => {
      state.backgroundTaskRunHistory = [];
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
  clearDebugInfo,
  setBackgroundTaskIntervalMinutes,
  setMinNotificationBuffer,
  resetPreferences,
} = preferencesSlice.actions;

export default preferencesSlice.reducer;
