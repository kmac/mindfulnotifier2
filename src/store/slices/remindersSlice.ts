import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import {
  defaultJsonReminderMap,
  JsonReminder,
} from "@/src/constants/Reminders";

export interface RemindersState {
  reminders: JsonReminder[];
  lastNotificationText: string | null;
}

const initialState: RemindersState = {
  reminders: defaultJsonReminderMap,
  lastNotificationText: null,
};

const remindersSlice = createSlice({
  name: "reminders",
  initialState,
  reducers: {
    addReminder: (state, action: PayloadAction<JsonReminder>) => {
      state.reminders.push(action.payload);
    },
    updateReminder: (
      state,
      action: PayloadAction<{ index: number; reminder: JsonReminder }>,
    ) => {
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
    toggleReminderFavourite: (state, action: PayloadAction<number>) => {
      const index = action.payload;
      if (index >= 0 && index < state.reminders.length) {
        state.reminders[index].favourite = !state.reminders[index].favourite;
      }
    },
    setReminders: (state, action: PayloadAction<JsonReminder[]>) => {
      state.reminders = action.payload;
    },
    setLastNotificationText: (state, action: PayloadAction<string>) => {
      state.lastNotificationText = action.payload;
    },
    resetReminders: () => initialState,
  },
});

export const {
  addReminder,
  updateReminder,
  deleteReminder,
  toggleReminderEnabled,
  toggleReminderFavourite,
  setReminders,
  setLastNotificationText,
  resetReminders,
} = remindersSlice.actions;

export default remindersSlice.reducer;
