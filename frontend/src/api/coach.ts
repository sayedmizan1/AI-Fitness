import api from './client';

export const authApi = {
  login: async (credentials: { email: string; password: string }) => {
    const res = await api.post('/auth/login', credentials);
    return res.data;
  },
  register: async (payload: { email: string; password: string; full_name: string }) => {
    const res = await api.post('/auth/register', payload);
    return res.data;
  },
  createProfile: async (profile: any) => {
    const res = await api.post('/auth/profile', profile);
    return res.data;
  },
  getProfile: async () => {
    const res = await api.get('/auth/profile');
    return res.data;
  },
};

export const workoutApi = {
  startSession: async (planId?: string) => {
    const res = await api.post('/workout/sessions/start', { plan_id: planId });
    return res.data;
  },
  endSession: async (sessionId: string, data: any) => {
    const res = await api.post(`/workout/sessions/${sessionId}/end`, data);
    return res.data;
  },
  getSessions: async () => {
    const res = await api.get('/workout/sessions');
    return res.data;
  },
  logExercise: async (data: any) => {
    const res = await api.post('/workout/exercise-logs', data);
    return res.data;
  },
  getPlans: async () => {
    const res = await api.get('/workout/plans');
    return res.data;
  },
};

export const analyticsApi = {
  getSummary: async () => {
    const res = await api.get('/analytics/summary');
    return res.data;
  },
  getProgress: async () => {
    const res = await api.get('/analytics/progress');
    return res.data;
  },
  logProgress: async (data: any) => {
    const res = await api.post('/analytics/progress', data);
    return res.data;
  },
  getGoals: async () => {
    const res = await api.get('/analytics/goals');
    return res.data;
  },
  createGoal: async (data: any) => {
    const res = await api.post('/analytics/goals', data);
    return res.data;
  },
  getNotifications: async () => {
    const res = await api.get('/analytics/notifications');
    return res.data;
  },
};

export interface SessionAnalysisPayload {
  exercise_name: string;
  duration_secs: number;
  total_reps: number;
  avg_form_score: number;
  sets_completed: number;
  goal_sets: number;
  calories: number;
  set_history?: { setNum: number; reps: number; avgFormScore: number; duration: number; effortRating: number }[];
  personal_best?: boolean;
}

export const coachApi = {
  chat: async (message: string) => {
    const res = await api.post('/coach/chat', { message });
    return res.data;
  },
  getHistory: async () => {
    const res = await api.get('/coach/history');
    return res.data;
  },
  clearHistory: async () => {
    const res = await api.delete('/coach/history');
    return res.data;
  },
  sessionAnalysis: async (payload: SessionAnalysisPayload): Promise<{ analysis: string; agent_used: string }> => {
    const res = await api.post('/coach/session-analysis', payload);
    return res.data;
  },
};
