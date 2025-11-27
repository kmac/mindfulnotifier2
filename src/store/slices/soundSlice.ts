import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface SoundState {
  selectedSound: string;
  customSoundUri: string | null;
  customSoundName: string | null;
}

const initialState: SoundState = {
  selectedSound: 'zenbell_1.mp3',
  customSoundUri: null,
  customSoundName: null,
};

const soundSlice = createSlice({
  name: 'sound',
  initialState,
  reducers: {
    setSelectedSound: (state, action: PayloadAction<string>) => {
      console.log(`setSelectedSound: ${action.payload}`);
      state.selectedSound = action.payload;
    },
    setCustomSoundUri: (state, action: PayloadAction<string | null>) => {
      console.log(`setCustomSoundUri: ${action.payload}`);
      state.customSoundUri = action.payload;
    },
    setCustomSound: (state, action: PayloadAction<{ uri: string; name: string }>) => {
      console.log(`setCustomSound: ${action.payload.name}: ${action.payload.uri}`);
      state.customSoundUri = action.payload.uri;
      state.customSoundName = action.payload.name;
    },
    resetSound: () => initialState,
  },
});

export const {
  setSelectedSound,
  setCustomSoundUri,
  setCustomSound,
  resetSound,
} = soundSlice.actions;

export default soundSlice.reducer;
