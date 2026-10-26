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
