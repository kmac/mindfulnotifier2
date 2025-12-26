import { configureStore, combineReducers } from "@reduxjs/toolkit";
import { persistStore, persistReducer, createMigrate } from "redux-persist";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { TypedUseSelectorHook, useDispatch, useSelector } from "react-redux";
import { DEFAULT_FAVOURITE_SELECTION_PROBABILITY } from "@/src/constants/Reminders";

import preferencesReducer from "./slices/preferencesSlice";
import scheduleReducer from "./slices/scheduleSlice";
import remindersReducer from "./slices/remindersSlice";
import soundReducer from "./slices/soundSlice";

// Migrations for persisted state
// Each migration receives the previous state and returns the new state
const migrations = {
  // Version 1: Add foregroundServiceEnabled, favouriteSelectionProbability default
  1: (state: any) => ({
    ...state,
    preferences: {
      ...state?.preferences,
      foregroundServiceEnabled:
        state?.preferences?.foregroundServiceEnabled ?? false,
      favouriteSelectionProbability:
        state?.preferences?.favouriteSelectionProbability ??
        DEFAULT_FAVOURITE_SELECTION_PROBABILITY,
    },
  }),
};

// Persist configuration
const persistConfig = {
  key: "root",
  storage: AsyncStorage,
  whitelist: ["preferences", "schedule", "reminders", "sound"], // Only persist these reducers
  version: 1,
  migrate: createMigrate(migrations, { debug: false }),
};

// Combine reducers
const rootReducer = combineReducers({
  preferences: preferencesReducer,
  schedule: scheduleReducer,
  reminders: remindersReducer,
  sound: soundReducer,
});

// Create persisted reducer
const persistedReducer = persistReducer(persistConfig, rootReducer);

// Configure store
export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore these action types from redux-persist
        ignoredActions: ["persist/PERSIST", "persist/REHYDRATE"],
      },
    }),
});

// Create persistor
export const persistor = persistStore(store);

// Export types
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Export typed hooks for use throughout the app
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
