import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface SoundState {
  selectedSound: string;
}

const initialState: SoundState = {
  selectedSound: 'zenbell_1.mp3',
};

const soundSlice = createSlice({
  name: 'sound',
  initialState,
  reducers: {
    setSelectedSound: (state, action: PayloadAction<string>) => {
      state.selectedSound = action.payload;
    },
    resetSound: () => initialState,
  },
});

export const {
  setSelectedSound,
  resetSound,
} = soundSlice.actions;

export default soundSlice.reducer;
