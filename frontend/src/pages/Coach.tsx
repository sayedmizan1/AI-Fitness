/**
 * Coach — AI Fitness Chat Page (Production Redesign)
 *
 * Fixes:
 * • Removed all broken Tailwind classes → pure inline styles + CSS classes
 * • Added markdown rendering (bold, lists, headers)
 * • Added agent type badges on AI messages
 * • Conversation history properly wired
 * • Premium dark design matching the workout page aesthetic
 */
import { useEffect, useState, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../store';
import { sendMessage, addUserMessage, loadHistory } from '../store/chatSlice';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send, Trash2, Zap, Bot, User, Sparkles, MessageSquare,
  Brain, Dumbbell, Apple, Heart, Target, ChevronDown,
} from 'lucide-react';
import { coachApi } from '../api/coach';

const QUICK_QUESTIONS = [
  { text: "What's a good beginner workout plan?", icon: Dumbbell },
  { text: 'How many grams of protein do I need daily?', icon: Apple },
  { text: 'How can I improve my squat form?', icon: Target },
  { text: 'What should I eat before a workout?', icon: Apple },
  { text: 'How do I recover faster after training?', icon: Heart },
];

const AGENT_LABELS: Record<string, { label: string; color: string; emoji: string }> = {
  exercise_specialist: { label: 'Exercise Expert',   color: '#22c55e', emoji: '🏋️' },
  nutrition_scientist:  { label: 'Nutrition Coach',   color: '#f59e0b', emoji: '🥗' },
  recovery_specialist:  { label: 'Recovery Expert',   color: '#38bdf8', emoji: '🧘' },
  programming_expert:   { label: 'Program Designer',  color: '#a78bfa', emoji: '📋' },
  form_review_coach:    { label: 'Form Analyst',      color: '#6366f1', emoji: '📐' },
  goal_planner:         { label: 'Goal Planner',      color: '#f97316', emoji: '🎯' },
  realtime_coach:       { label: 'Live Coach',        color: '#4ade80', emoji: '⚡' },
  local:                { label: 'AI Coach',          color: '#71717a', emoji: '🤖' },
};

// Simple markdown renderer: **bold**, bullet lists, numbered lists, # headers
function MarkdownText({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <div style={{ fontSize: 13, lineHeight: 1.7, color: '#d4d4d8' }}>
      {lines.map((line, i) => {
        const trimmed = line.trim();

        // Headers
        if (trimmed.startsWith('### ')) {
          return <div key={i} style={{ fontSize: 12, fontWeight: 800, color: '#e4e4e7', marginTop: 10, marginBottom: 3, letterSpacing: '0.02em' }}>{trimmed.slice(4)}</div>;
        }
        if (trimmed.startsWith('## ')) {
          return <div key={i} style={{ fontSize: 13, fontWeight: 800, color: '#f4f4f5', marginTop: 12, marginBottom: 4 }}>{trimmed.slice(3)}</div>;
        }
        if (trimmed.startsWith('# ')) {
          return <div key={i} style={{ fontSize: 15, fontWeight: 900, color: '#f4f4f5', marginTop: 14, marginBottom: 6 }}>{trimmed.slice(2)}</div>;
        }

        // Bold inline: split on **...**
        const renderBold = (str: string) => {
          const parts = str.split(/\*\*(.*?)\*\*/g);
          return parts.map((part, j) =>
            j % 2 === 1
              ? <strong key={j} style={{ color: '#f4f4f5', fontWeight: 700 }}>{part}</strong>
              : part
          );
        };

        // Bullet list
        if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
          return (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 2, alignItems: 'flex-start' }}>
              <span style={{ color: '#6366f1', flexShrink: 0, marginTop: 1 }}>•</span>
              <span>{renderBold(trimmed.slice(2))}</span>
            </div>
          );
        }

        // Numbered list
        if (/^\d+\.\s/.test(trimmed)) {
          const num = trimmed.match(/^(\d+)\./)?.[1];
          const content = trimmed.replace(/^\d+\.\s/, '');
          return (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 2, alignItems: 'flex-start' }}>
              <span style={{ color: '#6366f1', flexShrink: 0, fontWeight: 700, fontSize: 11, minWidth: 16 }}>{num}.</span>
              <span>{renderBold(content)}</span>
            </div>
          );
        }

        // Horizontal rule
        if (trimmed === '---') {
          return <div key={i} style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '8px 0' }} />;
        }

        // Empty line
        if (!trimmed) return <div key={i} style={{ height: 6 }} />;

        // Normal paragraph
        return <div key={i} style={{ marginBottom: 2 }}>{renderBold(line)}</div>;
      })}
    </div>
  );
}

function AgentBadge({ agentUsed }: { agentUsed?: string }) {
  if (!agentUsed) return null;
  const info = AGENT_LABELS[agentUsed] ?? { label: agentUsed.replace(/_/g, ' '), color: '#71717a', emoji: '🤖' };
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 9.5, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
      background: `${info.color}18`, color: info.color,
      marginBottom: 5, textTransform: 'capitalize',
    }}>
      <span>{info.emoji}</span>
      <span>{info.label}</span>
    </div>
  );
}

function ChatBubble({ msg }: { msg: any }) {
  const isUser = msg.role === 'user';
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      style={{ display: 'flex', gap: 10, flexDirection: isUser ? 'row-reverse' : 'row', alignItems: 'flex-start' }}
    >
      {/* Avatar */}
      <div style={{
        width: 32, height: 32, borderRadius: 10,
        background: isUser
          ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
          : 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.1))',
        border: isUser ? 'none' : '1px solid rgba(99,102,241,0.25)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginTop: 2, flexShrink: 0,
      }}>
        {isUser ? <User size={15} color="#fff" /> : <Bot size={15} color="#818cf8" />}
      </div>

      {/* Bubble */}
      <div style={{ maxWidth: '78%' }}>
        {!isUser && <AgentBadge agentUsed={msg.agent_used} />}
        <div style={{
          padding: '10px 14px',
          borderRadius: isUser ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
          background: isUser
            ? 'rgba(99,102,241,0.18)'
            : 'rgba(255,255,255,0.04)',
          border: isUser
            ? '1px solid rgba(99,102,241,0.3)'
            : '1px solid rgba(255,255,255,0.08)',
        }}>
          {isUser ? (
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: '#e4e4e7' }}>{msg.content}</p>
          ) : (
            <MarkdownText text={msg.content} />
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default function Coach() {
  const dispatch = useDispatch<AppDispatch>();
  const { messages, loading } = useSelector((s: RootState) => s.chat);
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    dispatch(loadHistory());
  }, [dispatch]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    setInput('');
    dispatch(addUserMessage(msg));
    await dispatch(sendMessage(msg));
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleClear = async () => {
    await coachApi.clearHistory();
    dispatch({ type: 'chat/clearMessages' });
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: 'calc(100vh - 0px)', maxHeight: '100dvh',
      padding: '0',
      background: '#030712',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '20px 24px 14px',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        flexShrink: 0,
        background: 'rgba(3,7,18,0.9)',
        backdropFilter: 'blur(12px)',
      }}>
        <div>
          <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10, fontSize: 22, fontWeight: 900, color: '#f4f4f5' }}>
            <div style={{ width: 36, height: 36, borderRadius: 11, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Sparkles size={18} color="#fff" />
            </div>
            AI Fitness Coach
          </h1>
          <p style={{ margin: '4px 0 0 46px', fontSize: 11, color: '#52525b' }}>
            Multi-agent · RAG Knowledge Base · LLaMA3-70B + Gemini 2.0
          </p>
        </div>
        <button
          onClick={handleClear}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', borderRadius: 10,
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            color: '#71717a', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          <Trash2 size={13} /> Clear
        </button>
      </div>

      {/* Messages area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {messages.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center', gap: 20 }}>
            {/* Hero */}
            <div style={{
              width: 80, height: 80, borderRadius: 24,
              background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.15))',
              border: '1px solid rgba(99,102,241,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 40px rgba(99,102,241,0.2)',
            }}>
              <Brain size={36} color="#818cf8" />
            </div>

            <div>
              <h2 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 800, color: '#f4f4f5' }}>
                Meet Your AI Fitness Coach
              </h2>
              <p style={{ margin: 0, fontSize: 13, color: '#52525b', maxWidth: 380, lineHeight: 1.7 }}>
                Ask anything about workouts, nutrition, form, recovery, or goal planning.
                I use a fitness knowledge base + your personal profile for tailored advice.
              </p>
            </div>

            {/* Agent cards */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 500 }}>
              {Object.entries(AGENT_LABELS).filter(([k]) => k !== 'local').slice(0, 5).map(([key, info]) => (
                <div key={key} style={{
                  padding: '6px 12px', borderRadius: 20,
                  background: `${info.color}10`, border: `1px solid ${info.color}25`,
                  fontSize: 10.5, fontWeight: 600, color: info.color,
                  display: 'flex', alignItems: 'center', gap: 4,
                }}>
                  <span>{info.emoji}</span> {info.label}
                </div>
              ))}
            </div>

            {/* Quick questions */}
            <div style={{ width: '100%', maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 7 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#3f3f46', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2, textAlign: 'left' }}>
                Quick Start
              </div>
              {QUICK_QUESTIONS.map(({ text, icon: Icon }) => (
                <button
                  key={text}
                  onClick={() => handleSend(text)}
                  style={{
                    textAlign: 'left', fontSize: 12.5, padding: '10px 14px',
                    borderRadius: 12, cursor: 'pointer',
                    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                    color: '#a1a1aa', transition: 'all 0.15s',
                    display: 'flex', alignItems: 'center', gap: 9,
                  }}
                  onMouseEnter={e => { (e.target as HTMLElement).style.background = 'rgba(99,102,241,0.07)'; (e.target as HTMLElement).style.borderColor = 'rgba(99,102,241,0.2)'; (e.target as HTMLElement).style.color = '#e4e4e7'; }}
                  onMouseLeave={e => { (e.target as HTMLElement).style.background = 'rgba(255,255,255,0.03)'; (e.target as HTMLElement).style.borderColor = 'rgba(255,255,255,0.07)'; (e.target as HTMLElement).style.color = '#a1a1aa'; }}
                >
                  <Icon size={13} color="#6366f1" style={{ flexShrink: 0 }} />
                  {text}
                </button>
              ))}
            </div>
          </div>
        )}

        <AnimatePresence>
          {messages.map((msg, i) => <ChatBubble key={msg.id || i} msg={msg} />)}
        </AnimatePresence>

        {/* Loading indicator */}
        {loading && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
              <Bot size={15} color="#818cf8" />
            </div>
            <div style={{ padding: '12px 16px', borderRadius: '4px 16px 16px 16px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                {[0, 1, 2].map(i => (
                  <motion.div
                    key={i} animate={{ y: [0, -5, 0] }}
                    transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.12 }}
                    style={{ width: 7, height: 7, borderRadius: '50%', background: '#6366f1' }}
                  />
                ))}
                <span style={{ fontSize: 11, color: '#52525b', marginLeft: 4 }}>Thinking...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div style={{
        padding: '12px 20px 16px',
        borderTop: '1px solid rgba(255,255,255,0.07)',
        background: 'rgba(3,7,18,0.95)',
        backdropFilter: 'blur(12px)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center',
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 13, padding: '2px 4px 2px 14px',
            transition: 'border-color 0.15s',
          }}>
            <input
              ref={inputRef}
              id="coach-input"
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder="Ask your AI coach anything..."
              disabled={loading}
              style={{
                flex: 1, background: 'none', border: 'none', outline: 'none',
                color: '#e4e4e7', fontSize: 13, fontFamily: 'inherit', padding: '9px 0',
              }}
            />
            <button
              id="coach-send"
              onClick={() => handleSend()}
              disabled={loading || !input.trim()}
              style={{
                width: 36, height: 36, borderRadius: 10, border: 'none', flexShrink: 0,
                background: input.trim() && !loading
                  ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
                  : 'rgba(255,255,255,0.06)',
                cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.18s',
              }}
            >
              <Send size={15} color={input.trim() && !loading ? '#fff' : '#52525b'} />
            </button>
          </div>
        </div>
        <p style={{ margin: '6px 0 0', textAlign: 'center', fontSize: 10, color: '#3f3f46', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
          <Zap size={9} color="#3f3f46" />
          Groq LLaMA3-70B · Gemini 2.0 Flash · RAG Knowledge Base
        </p>
      </div>
    </div>
  );
}
