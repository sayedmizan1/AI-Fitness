import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { authApi } from '../api/auth';

export interface User {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  created_at: string;
}

export interface FitnessProfile {
  id: string;
  age: number;
  gender: string;
  height_cm: number;
  weight_kg: number;
  goal: string;
  experience: string;
  bmi: number | null;
  daily_calories: number | null;
  training_days_per_week: number | null;
}

interface AuthState {
  user: User | null;
  token: string | null;
  profile: FitnessProfile | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  user: JSON.parse(localStorage.getItem('fitmentor_user') || 'null'),
  token: localStorage.getItem('fitmentor_token'),
  profile: JSON.parse(localStorage.getItem('fitmentor_profile') || 'null'),
  isAuthenticated: !!localStorage.getItem('fitmentor_token'),
  loading: false,
  error: null,
};

export const login = createAsyncThunk(
  'auth/login',
  async (credentials: { email: string; password: string }, { rejectWithValue }) => {
    try {
      const data = await authApi.login(credentials);
      return data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.detail || 'Login failed');
    }
  }
);

export const register = createAsyncThunk(
  'auth/register',
  async (payload: { email: string; password: string; full_name: string }, { rejectWithValue }) => {
    try {
      const data = await authApi.register(payload);
      return data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.detail || 'Registration failed');
    }
  }
);

export const createProfile = createAsyncThunk(
  'auth/createProfile',
  async (profile: Omit<FitnessProfile, 'id' | 'bmi' | 'daily_calories' | 'training_days_per_week'>, { rejectWithValue }) => {
    try {
      return await authApi.createProfile(profile);
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.detail || 'Profile creation failed');
    }
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout(state) {
      state.user = null;
      state.token = null;
      state.profile = null;
      state.isAuthenticated = false;
      localStorage.removeItem('fitmentor_token');
      localStorage.removeItem('fitmentor_user');
      localStorage.removeItem('fitmentor_profile');
    },
    clearError(state) {
      state.error = null;
    },
    setProfile(state, action: PayloadAction<FitnessProfile>) {
      state.profile = action.payload;
      localStorage.setItem('fitmentor_profile', JSON.stringify(action.payload));
    },
  },
  extraReducers: (builder) => {
    // Login
    builder.addCase(login.pending, (state) => { state.loading = true; state.error = null; });
    builder.addCase(login.fulfilled, (state, action) => {
      state.loading = false;
      state.token = action.payload.access_token;
      state.user = action.payload.user;
      state.isAuthenticated = true;
      localStorage.setItem('fitmentor_token', action.payload.access_token);
      localStorage.setItem('fitmentor_user', JSON.stringify(action.payload.user));
    });
    builder.addCase(login.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload as string;
    });

    // Register
    builder.addCase(register.pending, (state) => { state.loading = true; state.error = null; });
    builder.addCase(register.fulfilled, (state, action) => {
      state.loading = false;
      state.token = action.payload.access_token;
      state.user = action.payload.user;
      state.isAuthenticated = true;
      localStorage.setItem('fitmentor_token', action.payload.access_token);
      localStorage.setItem('fitmentor_user', JSON.stringify(action.payload.user));
    });
    builder.addCase(register.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload as string;
    });

    // Create Profile
    builder.addCase(createProfile.fulfilled, (state, action) => {
      state.profile = action.payload;
      localStorage.setItem('fitmentor_profile', JSON.stringify(action.payload));
    });
  },
});

export const { logout, clearError, setProfile } = authSlice.actions;
export default authSlice.reducer;
