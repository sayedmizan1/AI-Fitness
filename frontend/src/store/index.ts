import { configureStore } from '@reduxjs/toolkit';
import authReducer from './authSlice';
import workoutReducer from './workoutSlice';
import chatReducer from './chatSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    workout: workoutReducer,
    chat: chatReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
