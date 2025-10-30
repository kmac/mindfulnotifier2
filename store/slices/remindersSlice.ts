import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { defaultJsonReminderMap, JsonReminder } from '@/constants/Reminders';

export interface RemindersState {
  reminders: JsonReminder[];
}

const initialState: RemindersState = {
  reminders: defaultJsonReminderMap,
};

const remindersSlice = createSlice({
  name: 'reminders',
  initialState,
  reducers: {
    addReminder: (state, action: PayloadAction<JsonReminder>) => {
      state.reminders.push(action.payload);
    },
    updateReminder: (state, action: PayloadAction<{ index: number; reminder: JsonReminder }>) => {
      const { index, reminder } = action.payload;
      if (index >= 0 && index < state.reminders.length) {
        state.reminders[index] = reminder;
      }
    },
    deleteReminder: (state, action: PayloadAction<number>) => {
      state.reminders.splice(action.payload, 1);
    },
    toggleReminderEnabled: (state, action: PayloadAction<number>) => {
      const index = action.payload;
      if (index >= 0 && index < state.reminders.length) {
        state.reminders[index].enabled = !state.reminders[index].enabled;
      }
    },
    setReminders: (state, action: PayloadAction<JsonReminder[]>) => {
      state.reminders = action.payload;
    },
    resetReminders: () => initialState,
  },
});

export const {
  addReminder,
  updateReminder,
  deleteReminder,
  toggleReminderEnabled,
  setReminders,
  resetReminders,
} = remindersSlice.actions;

export default remindersSlice.reducer;
