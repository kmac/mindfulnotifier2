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
}

const initialState: PreferencesState = {
  isEnabled: false,
  notificationsGranted: false,
  soundEnabled: true,
  vibrationEnabled: true,
  colorScheme: 'auto',
  debugInfoEnabled: false,
  debugInfo: [],
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
      // Keep only the last 50 debug messages to prevent unbounded growth
      const MAX_DEBUG_INFO = 50;
      state.debugInfo.push(action.payload);
      if (state.debugInfo.length > MAX_DEBUG_INFO) {
        state.debugInfo = state.debugInfo.slice(-MAX_DEBUG_INFO);
      }
    },
    clearDebugInfo: (state) => {
      state.debugInfo = [];
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
  resetPreferences,
} = preferencesSlice.actions;

export default preferencesSlice.reducer;
