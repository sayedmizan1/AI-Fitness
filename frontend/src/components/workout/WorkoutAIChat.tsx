/**
 * WorkoutAIChat — Floating Mid-Workout AI Chat Panel
 *
 * A minimizable floating panel that lets users query the AI coach
 * during an active workout session. Pre-populates context with
 * current exercise, reps, form score, and corrections.
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Send, X, Minimize2, MessageCircle, Loader2, ChevronDown } from 'lucide-react';
import { coachApi } from '../../api/coach';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  agentUsed?: string;
}

interface Props {
  exercise: string | null;
  exerciseName: string;
  repCount: number;
  formScore: number;
  corrections: string[];
  isSessionActive: boolean;
  sessionDuration: number;
}

function AgentBadge({ agent }: { agent?: string }) {
  if (!agent) return null;
  const labels: Record<string, { label: string; color: string }> = {
    exercise_specialist: { label: 'Exercise Expert', color: '#22c55e' },
    nutrition_scientist:  { label: 'Nutrition',       color: '#f59e0b' },
    recovery_specialist:  { label: 'Recovery',        color: '#38bdf8' },
    programming_expert:   { label: 'Programming',     color: '#a78bfa' },
    form_review_coach:    { label: 'Form Coach',      color: '#6366f1' },
    goal_planner:         { label: 'Goal Planner',    color: '#f97316' },
    realtime_coach:       { label: 'Live Coach',      color: '#4ade80' },
  };
  const info = labels[agent] ?? { label: agent.replace('_', ' '), color: '#71717a' };
  return (
    <span style={{
      display: 'inline-block', fontSize: 8.5, fontWeight: 700, padding: '1px 6px',
      borderRadius: 8, background: `${info.color}18`, color: info.color,
      marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.05em',
    }}>
      {info.label}
    </span>
  );
}

// Simple markdown-like renderer (bold, bullets)
function MessageText({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <div style={{ fontSize: 11.5, lineHeight: 1.6, color: '#d4d4d8' }}>
      {lines.map((line, i) => {
        // Bold: **text**
        const parts = line.split(/\*\*(.*?)\*\*/g);
        const rendered = parts.map((part, j) =>
          j % 2 === 1 ? <strong key={j} style={{ color: '#f4f4f5', fontWeight: 700 }}>{part}</strong> : part
        );
        // Bullet
        if (line.startsWith('- ') || line.startsWith('• ')) {
          return (
            <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 2 }}>
              <span style={{ color: '#6366f1', flexShrink: 0 }}>•</span>
              <span>{rendered}</span>
            </div>
          );
        }
        // Numbered
        if (/^\d+\. /.test(line)) {
          return <div key={i} style={{ marginBottom: 2 }}>{rendered}</div>;
        }
        return line ? <div key={i} style={{ marginBottom: line.startsWith('#') ? 4 : 1 }}>{rendered}</div> : <br key={i} />;
      })}
    </div>
  );
}

export default function WorkoutAIChat({ exercise, exerciseName, repCount, formScore, corrections, isSessionActive, sessionDuration }: Props) {
  const [isOpen, setIsOpen]         = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages]     = useState<Message[]>([]);
  const [input, setInput]           = useState('');
  const [loading, setLoading]       = useState(false);
  const [hasNewMessage, setHasNewMessage] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Mark new message when minimized
  useEffect(() => {
    if (isMinimized && messages.length > 0 && messages[messages.length - 1].role === 'assistant') {
      setHasNewMessage(true);
    }
  }, [messages, isMinimized]);

  const openAndFocus = () => {
    setIsOpen(true);
    setIsMinimized(false);
    setHasNewMessage(false);
  };

  const buildContextPrefix = useCallback(() => {
    const mins = Math.floor(sessionDuration / 60);
    const secs = sessionDuration % 60;
    const parts = [`I'm currently doing ${exerciseName}`, `${mins}m ${secs}s into my workout`, `${repCount} reps done`, `form score: ${formScore}%`];
    if (corrections.length > 0) parts.push(`corrections: ${corrections.slice(0, 2).join(', ')}`);
    return `[Context: ${parts.join(', ')}] `;
  }, [exerciseName, repCount, formScore, corrections, sessionDuration]);

  const handleSend = async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    setInput('');

    const userMessage: Message = { id: Date.now().toString(), role: 'user', content: msg };
    setMessages(prev => [...prev, userMessage]);
    setLoading(true);

    try {
      // Prepend workout context to the message so AI knows the live situation
      const fullMessage = buildContextPrefix() + msg;
      const res = await coachApi.chat(fullMessage);
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: res.reply,
        agentUsed: res.agent_used,
      };
      setMessages(prev => [...prev, aiMessage]);
    } catch {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "I'm having a connection issue. Try again in a moment!",
      }]);
    } finally {
      setLoading(false);
    }
  };

  if (!isSessionActive) return null;

  return (
    <>
      {/* Floating trigger button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            onClick={openAndFocus}
            style={{
              position: 'fixed', bottom: 90, right: 20, zIndex: 500,
              width: 52, height: 52, borderRadius: '50%', border: 'none',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', boxShadow: '0 4px 20px rgba(99,102,241,0.5)',
            }}
          >
            <MessageCircle size={22} color="#fff" />
            {hasNewMessage && (
              <div style={{
                position: 'absolute', top: 2, right: 2, width: 12, height: 12,
                borderRadius: '50%', background: '#ef4444',
                border: '2px solid #030712',
              }} />
            )}
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            style={{
              position: 'fixed',
              bottom: 80, right: 16,
              width: Math.min(360, window.innerWidth - 32),
              zIndex: 500,
              borderRadius: 18,
              background: 'linear-gradient(160deg, #0d1117, #0a0e1a)',
              border: '1px solid rgba(99,102,241,0.25)',
              boxShadow: '0 16px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(99,102,241,0.1)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: isMinimized ? 'auto' : 420,
            }}
          >
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 14px',
              background: 'rgba(99,102,241,0.08)',
              borderBottom: '1px solid rgba(99,102,241,0.15)',
              flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Brain size={14} color="#fff" />
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#e4e4e7' }}>AI Coach</div>
                  <div style={{ fontSize: 9.5, color: '#6366f1', fontWeight: 600 }}>Live workout assistant</div>
                </div>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 20,
                  background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)',
                }}>
                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#22c55e' }} />
                  <span style={{ fontSize: 8.5, fontWeight: 700, color: '#4ade80' }}>LIVE</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={() => setIsMinimized(m => !m)} style={{
                  width: 26, height: 26, borderRadius: 7, border: 'none',
                  background: 'rgba(255,255,255,0.06)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {isMinimized ? <MessageCircle size={12} color="#71717a" /> : <Minimize2 size={12} color="#71717a" />}
                </button>
                <button onClick={() => setIsOpen(false)} style={{
                  width: 26, height: 26, borderRadius: 7, border: 'none',
                  background: 'rgba(255,255,255,0.06)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <X size={12} color="#71717a" />
                </button>
              </div>
            </div>

            {!isMinimized && (
              <>
                {/* Messages */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}>
                  {messages.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '16px 8px' }}>
                      <div style={{ fontSize: 20, marginBottom: 6 }}>🏋️</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#e4e4e7', marginBottom: 4 }}>Ask your AI coach</div>
                      <div style={{ fontSize: 10.5, color: '#52525b', lineHeight: 1.6 }}>
                        I can see your live workout data.<br />Ask me anything right now!
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 12 }}>
                        {[
                          'How is my form?',
                          `Tips for ${exerciseName}?`,
                          'How many more reps should I do?',
                        ].map(q => (
                          <button key={q} onClick={() => handleSend(q)} style={{
                            padding: '7px 12px', borderRadius: 9,
                            border: '1px solid rgba(99,102,241,0.2)',
                            background: 'rgba(99,102,241,0.07)',
                            color: '#a5b4fc', fontSize: 10.5, fontWeight: 600,
                            cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                          }}>
                            {q}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    messages.map(msg => (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        style={{ display: 'flex', gap: 7, flexDirection: msg.role === 'user' ? 'row-reverse' : 'row', alignItems: 'flex-start' }}
                      >
                        <div style={{
                          width: 24, height: 24, borderRadius: 7, flexShrink: 0,
                          background: msg.role === 'user' ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : 'rgba(255,255,255,0.07)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          marginTop: 2,
                        }}>
                          {msg.role === 'user' ? (
                            <span style={{ fontSize: 10 }}>👤</span>
                          ) : (
                            <Brain size={11} color="#818cf8" />
                          )}
                        </div>
                        <div style={{ maxWidth: '80%' }}>
                          {msg.role === 'assistant' && <AgentBadge agent={msg.agentUsed} />}
                          <div style={{
                            padding: '8px 11px', borderRadius: msg.role === 'user' ? '14px 4px 14px 14px' : '4px 14px 14px 14px',
                            background: msg.role === 'user' ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.05)',
                            border: `1px solid ${msg.role === 'user' ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.07)'}`,
                          }}>
                            <MessageText text={msg.content} />
                          </div>
                        </div>
                      </motion.div>
                    ))
                  )}
                  {loading && (
                    <div style={{ display: 'flex', gap: 7, alignItems: 'flex-start' }}>
                      <div style={{ width: 24, height: 24, borderRadius: 7, background: 'rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>
                        <Brain size={11} color="#818cf8" />
                      </div>
                      <div style={{ padding: '10px 12px', borderRadius: '4px 14px 14px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)' }}>
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                          <Loader2 size={11} color="#6366f1" style={{ animation: 'spin 1s linear infinite' }} />
                          <span style={{ fontSize: 10.5, color: '#52525b' }}>Thinking...</span>
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={bottomRef} />
                </div>

                {/* Context chip */}
                <div style={{ padding: '4px 12px 0', display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {[
                    { label: `${repCount} reps`, color: '#6366f1' },
                    { label: `${formScore}% form`, color: formScore >= 80 ? '#22c55e' : formScore >= 55 ? '#f59e0b' : '#ef4444' },
                    { label: exerciseName, color: '#a78bfa' },
                  ].map(chip => (
                    <span key={chip.label} style={{
                      fontSize: 9, padding: '2px 7px', borderRadius: 20,
                      background: `${chip.color}15`, color: chip.color, fontWeight: 700,
                    }}>{chip.label}</span>
                  ))}
                </div>

                {/* Input */}
                <div style={{ padding: '8px 10px', display: 'flex', gap: 6, flexShrink: 0 }}>
                  <input
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                    placeholder="Ask about form, reps, pain..."
                    disabled={loading}
                    style={{
                      flex: 1, padding: '9px 12px', borderRadius: 10,
                      background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                      color: '#e4e4e7', fontSize: 12, fontFamily: 'inherit',
                      outline: 'none',
                    }}
                  />
                  <button
                    onClick={() => handleSend()}
                    disabled={loading || !input.trim()}
                    style={{
                      width: 36, height: 36, borderRadius: 10, border: 'none',
                      background: input.trim() ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : 'rgba(255,255,255,0.06)',
                      cursor: input.trim() ? 'pointer' : 'not-allowed',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, transition: 'all 0.18s',
                    }}
                  >
                    <Send size={14} color={input.trim() ? '#fff' : '#52525b'} />
                  </button>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
