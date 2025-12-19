import { MIN_NOTIFICATION_BUFFER } from '@/src/constants/scheduleConstants';
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import Colors from "@/src/ui/styles/colors";

export type ColorScheme = 'light' | 'dark' | 'auto';
export type Color = keyof typeof Colors.light | 'random';


export interface PreferencesState {
  isEnabled: boolean;
  notificationsGranted: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  colorScheme: ColorScheme;
  color: Color;
  backgroundImageEnabled: boolean;
  debugInfoEnabled: boolean;
  backgroundTaskRunHistory: number[]; // Array of timestamps when background task ran
  minNotificationBuffer: number;
  foregroundServiceEnabled: boolean; // Android foreground service to prevent app from being killed
}

const initialState: PreferencesState = {
  isEnabled: false,
  notificationsGranted: false,
  soundEnabled: true,
  vibrationEnabled: true,
  colorScheme: 'auto',
  color: 'default',
  backgroundImageEnabled: true,
  debugInfoEnabled: false,
  backgroundTaskRunHistory: [],
  minNotificationBuffer: MIN_NOTIFICATION_BUFFER,
  foregroundServiceEnabled: false, // Opt-in, disabled by default
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
    setColor: (state, action: PayloadAction<Color>) => {
      state.color = action.payload;
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
    setMinNotificationBuffer: (state, action: PayloadAction<number>) => {
      state.minNotificationBuffer = action.payload;
    },
    setForegroundServiceEnabled: (state, action: PayloadAction<boolean>) => {
      state.foregroundServiceEnabled = action.payload;
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
  setColor,
  setBackgroundImageEnabled,
  setDebugInfoEnabled,
  clearDebugInfo,
  setMinNotificationBuffer,
  setForegroundServiceEnabled,
  resetPreferences,
} = preferencesSlice.actions;

export default preferencesSlice.reducer;
