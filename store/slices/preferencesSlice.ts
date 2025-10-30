import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface PreferencesState {
  isEnabled: boolean;
  notificationsGranted: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
}

const initialState: PreferencesState = {
  isEnabled: false,
  notificationsGranted: false,
  soundEnabled: true,
  vibrationEnabled: true,
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
    resetPreferences: () => initialState,
  },
});

export const {
  setEnabled,
  setNotificationsGranted,
  setSoundEnabled,
  setVibrationEnabled,
  resetPreferences,
} = preferencesSlice.actions;

export default preferencesSlice.reducer;
