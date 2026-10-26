import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { coachApi } from '../api/coach';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

interface ChatState {
  messages: ChatMessage[];
  loading: boolean;
  error: string | null;
}

const initialState: ChatState = {
  messages: [],
  loading: false,
  error: null,
};

export const sendMessage = createAsyncThunk(
  'chat/send',
  async (message: string, { rejectWithValue }) => {
    try {
      return await coachApi.chat(message);
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.detail || 'Failed to send message');
    }
  }
);

export const loadHistory = createAsyncThunk('chat/loadHistory', async () => {
  return await coachApi.getHistory();
});

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    addUserMessage(state, action: PayloadAction<string>) {
      state.messages.push({
        id: Date.now().toString(),
        role: 'user',
        content: action.payload,
        created_at: new Date().toISOString(),
      });
    },
    clearMessages(state) {
      state.messages = [];
    },
  },
  extraReducers: (builder) => {
    builder.addCase(sendMessage.pending, (state) => { state.loading = true; state.error = null; });
    builder.addCase(sendMessage.fulfilled, (state, action) => {
      state.loading = false;
      state.messages.push({
        id: Date.now().toString(),
        role: 'assistant',
        content: action.payload.reply,
        created_at: new Date().toISOString(),
      });
    });
    builder.addCase(sendMessage.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload as string;
    });
    builder.addCase(loadHistory.fulfilled, (state, action) => {
      state.messages = action.payload;
    });
  },
});

export const { addUserMessage, clearMessages } = chatSlice.actions;
export default chatSlice.reducer;
