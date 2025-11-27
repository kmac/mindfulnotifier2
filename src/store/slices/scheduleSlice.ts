import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type ScheduleType = 'periodic' | 'random';

export interface QuietHoursConfig {
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  notifyQuietHours: boolean;
}

export interface PeriodicConfig {
  durationHours: number;
  durationMinutes: number;
}

export interface RandomConfig {
  minMinutes: number;
  maxMinutes: number;
}

export interface ScheduleState {
  scheduleType: ScheduleType;
  quietHours: QuietHoursConfig;
  periodicConfig: PeriodicConfig;
  randomConfig: RandomConfig;
}

const initialState: ScheduleState = {
  scheduleType: 'random',
  quietHours: {
    startHour: 21,
    startMinute: 0,
    endHour: 9,
    endMinute: 0,
    notifyQuietHours: false,
  },
  periodicConfig: {
    durationHours: 1,
    durationMinutes: 0,
  },
  randomConfig: {
    minMinutes: 30,
    maxMinutes: 60,
  },
};

const scheduleSlice = createSlice({
  name: 'schedule',
  initialState,
  reducers: {
    setScheduleType: (state, action: PayloadAction<ScheduleType>) => {
      state.scheduleType = action.payload;
    },
    setQuietHours: (state, action: PayloadAction<QuietHoursConfig>) => {
      state.quietHours = action.payload;
    },
    setPeriodicConfig: (state, action: PayloadAction<PeriodicConfig>) => {
      state.periodicConfig = action.payload;
    },
    setRandomConfig: (state, action: PayloadAction<RandomConfig>) => {
      state.randomConfig = action.payload;
    },
    resetSchedule: () => initialState,
  },
});

export const {
  setScheduleType,
  setQuietHours,
  setPeriodicConfig,
  setRandomConfig,
  resetSchedule,
} = scheduleSlice.actions;

export default scheduleSlice.reducer;
