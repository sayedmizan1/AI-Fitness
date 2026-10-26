import { motion, AnimatePresence } from 'framer-motion';
import { Award, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { useState } from 'react';

export interface RepDetail {
  repNum: number;
  score: number;
  corrections: string[];
  timestamp: number;
}

interface Props {
  reps: RepDetail[];
}

export default function RepQualityTimeline({ reps }: Props) {
  const [hoveredRep, setHoveredRep] = useState<number | null>(null);

  if (reps.length === 0) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: 68,
        borderRadius: 14,
        background: 'rgba(255,255,255,0.02)',
        border: '1px dashed rgba(255,255,255,0.07)',
        color: '#52525b',
        fontSize: 12,
        fontWeight: 500,
        gap: 6
      }}>
        <Info size={13} />
        Reps performed in this set will appear here in real-time
      </div>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      {/* Scrollable Container */}
      <div style={{
        display: 'flex',
        gap: 8,
        overflowX: 'auto',
        padding: '6px 4px 16px 4px',
        scrollbarWidth: 'thin',
        scrollbarColor: 'rgba(255,255,255,0.1) transparent',
      }}>
        <AnimatePresence initial={false}>
          {reps.map((rep) => {
            const isExcellent = rep.score >= 80;
            const isWarning = rep.score >= 55 && rep.score < 80;
            const statusColor = isExcellent ? '#22c55e' : isWarning ? '#f59e0b' : '#ef4444';
            const bgGradient = isExcellent
              ? 'linear-gradient(135deg, rgba(34,197,94,0.12), rgba(34,197,94,0.02))'
              : isWarning
              ? 'linear-gradient(135deg, rgba(245,158,11,0.12), rgba(245,158,11,0.02))'
              : 'linear-gradient(135deg, rgba(239,68,68,0.12), rgba(239,68,68,0.02))';
            const statusBorder = isExcellent
              ? '1px solid rgba(34,197,94,0.3)'
              : isWarning
              ? '1px solid rgba(245,158,11,0.3)'
              : '1px solid rgba(239,68,68,0.3)';

            return (
              <div
                key={rep.repNum}
                style={{ position: 'relative' }}
                onMouseEnter={() => setHoveredRep(rep.repNum)}
                onMouseLeave={() => setHoveredRep(null)}
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.8, x: 20 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  whileHover={{ scale: 1.05, y: -2 }}
                  style={{
                    flexShrink: 0,
                    width: 72,
                    padding: '8px 4px',
                    borderRadius: 12,
                    background: bgGradient,
                    border: statusBorder,
                    textAlign: 'center',
                    cursor: 'pointer',
                    boxShadow: hoveredRep === rep.repNum ? `0 4px 15px ${statusColor}18` : 'none',
                    transition: 'box-shadow 0.2s',
                  }}
                >
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Rep
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: '#f4f4f5', margin: '2px 0 1px 0', lineHeight: 1.1 }}>
                    {rep.repNum}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: statusColor }}>
                    {rep.score}%
                  </div>
                </motion.div>

                {/* Micro Tooltip */}
                <AnimatePresence>
                  {hoveredRep === rep.repNum && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 5, scale: 0.95 }}
                      style={{
                        position: 'absolute',
                        bottom: '100%',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        marginBottom: 10,
                        width: 170,
                        background: '#0d1117',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 10,
                        padding: 10,
                        boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                        zIndex: 100,
                        pointerEvents: 'none',
                      }}
                    >
                      {/* Triangle pointer */}
                      <div style={{
                        position: 'absolute',
                        top: '100%',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        width: 0,
                        height: 0,
                        borderLeft: '6px solid transparent',
                        borderRight: '6px solid transparent',
                        borderTop: '6px solid #0d1117',
                      }} />
                      <div style={{
                        position: 'absolute',
                        top: '100%',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        width: 0,
                        height: 0,
                        borderLeft: '7px solid transparent',
                        borderRight: '7px solid transparent',
                        borderTop: '7px solid rgba(255,255,255,0.08)',
                        zIndex: -1,
                      }} />

                      {/* Header */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 6, marginBottom: 6 }}>
                        {isExcellent ? (
                          <CheckCircle size={12} color="#22c55e" />
                        ) : (
                          <AlertTriangle size={12} color={statusColor} />
                        )}
                        <span style={{ fontSize: 11, fontWeight: 800, color: '#e4e4e7' }}>Rep {rep.repNum} Analysis</span>
                      </div>

                      {/* Details */}
                      <div style={{ fontSize: 10, color: '#a1a1aa', lineHeight: 1.4 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                          <span>Score:</span>
                          <span style={{ fontWeight: 700, color: statusColor }}>{rep.score}%</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span>Quality:</span>
                          <span style={{ fontWeight: 700, color: statusColor }}>
                            {isExcellent ? 'Perfect' : isWarning ? 'Acceptable' : 'Needs Work'}
                          </span>
                        </div>

                        {rep.corrections.length > 0 ? (
                          <div style={{ marginTop: 6, borderTop: '1px dashed rgba(255,255,255,0.08)', paddingTop: 5 }}>
                            <div style={{ fontWeight: 700, fontSize: 9, color: '#fca5a5', marginBottom: 2 }}>CORRECTIONS:</div>
                            {rep.corrections.map((corr, idx) => (
                              <div key={idx} style={{ display: 'flex', gap: 4, alignItems: 'flex-start', color: '#fed7aa', fontSize: 9.5, marginTop: 2 }}>
                                <span>•</span>
                                <span>{corr}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div style={{ marginTop: 6, borderTop: '1px dashed rgba(255,255,255,0.08)', paddingTop: 5, color: '#86efac', fontWeight: 600, fontSize: 9.5, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Award size={10} /> Great biomechanics!
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
