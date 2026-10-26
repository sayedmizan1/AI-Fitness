/**
 * FormScoreGauge — Advanced Arch/Speedometer Gauge
 * 
 * Features:
 * • 180° arch gauge with color zones (red → amber → yellow → green)
 * • Smooth animated needle
 * • Score delta indicator (↑+5 or ↓-3)
 * • Animated glow ring in ideal zone
 * • Grade label: Excellent / Good / Fair / Poor
 */
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  score: number;   // 0–100
  size?: number;
  showDelta?: boolean;
}

function getZone(score: number): { color: string; glow: string; label: string; grade: string } {
  if (score >= 88) return { color: '#22c55e', glow: 'rgba(34,197,94,0.5)',  label: 'Excellent', grade: 'A' };
  if (score >= 75) return { color: '#84cc16', glow: 'rgba(132,204,22,0.4)', label: 'Good',      grade: 'B' };
  if (score >= 58) return { color: '#f59e0b', glow: 'rgba(245,158,11,0.4)', label: 'Fair',      grade: 'C' };
  if (score >= 40) return { color: '#f97316', glow: 'rgba(249,115,22,0.4)', label: 'Needs Work',grade: 'D' };
  return              { color: '#ef4444', glow: 'rgba(239,68,68,0.4)',   label: 'Poor',      grade: 'F' };
}

export default function FormScoreGauge({ score, size = 120, showDelta = true }: Props) {
  const prevScore  = useRef(score);
  const [delta, setDelta] = useState(0);
  const [showDeltaAnim, setShowDeltaAnim] = useState(false);

  useEffect(() => {
    const d = score - prevScore.current;
    if (Math.abs(d) >= 2) {
      setDelta(d);
      setShowDeltaAnim(true);
      const t = setTimeout(() => setShowDeltaAnim(false), 1800);
      prevScore.current = score;
      return () => clearTimeout(t);
    }
    prevScore.current = score;
  }, [score]);

  const zone = getZone(score);

  // Arch gauge math — 180° arc (from 180° to 0° = left half-circle)
  const cx = size / 2;
  const cy = size * 0.62; // slightly below center for arch look
  const R  = size * 0.42;
  const strokeW = Math.max(6, size * 0.07);
  const arcLen  = Math.PI * R;

  // Score segments: 0→40 red, 40→60 orange, 60→80 yellow-green, 80→100 green
  function arcSegment(from: number, to: number, color: string) {
    const startAngle = Math.PI - (from / 100) * Math.PI;
    const endAngle   = Math.PI - (to   / 100) * Math.PI;
    const x1 = cx + R * Math.cos(startAngle);
    const y1 = cy - R * Math.sin(startAngle);
    const x2 = cx + R * Math.cos(endAngle);
    const y2 = cy - R * Math.sin(endAngle);
    const large = to - from > 50 ? 1 : 0;
    return `M ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2}`;
  }

  // Needle angle: 0 score → pointing left (180°), 100 → pointing right (0°)
  const needleAngleDeg = 180 - (score / 100) * 180;
  // Needle tip position
  const needleLen = R * 0.78;
  const needleRad = (needleAngleDeg * Math.PI) / 180;
  const nx = cx + needleLen * Math.cos(Math.PI - needleRad * (Math.PI / 180) * (180 / Math.PI));
  // Use transform-origin approach for smooth rotation

  // Color zone stops
  const zones = [
    { from: 0,  to: 40,  color: '#ef4444' },
    { from: 40, to: 58,  color: '#f97316' },
    { from: 58, to: 75,  color: '#f59e0b' },
    { from: 75, to: 88,  color: '#84cc16' },
    { from: 88, to: 100, color: '#22c55e' },
  ];

  return (
    <div className="form-gauge-wrap">
      <div style={{ position: 'relative', width: size, height: size * 0.72 }}>
        <svg width={size} height={size * 0.72} viewBox={`0 0 ${size} ${size * 0.72}`}>
          {/* Background track */}
          <path
            d={`M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R} ${cy}`}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={strokeW}
            strokeLinecap="round"
          />

          {/* Color zone segments */}
          {zones.map((z, i) => (
            <path
              key={i}
              d={arcSegment(z.from, z.to, z.color)}
              fill="none"
              stroke={z.color}
              strokeWidth={strokeW * 0.55}
              strokeLinecap="round"
              opacity={0.25}
            />
          ))}

          {/* Active score arc */}
          <motion.path
            d={arcSegment(0, score, zone.color)}
            fill="none"
            stroke={zone.color}
            strokeWidth={strokeW}
            strokeLinecap="round"
            animate={{ opacity: 1 }}
            style={{
              filter: `drop-shadow(0 0 ${strokeW}px ${zone.glow})`,
            }}
          />

          {/* Needle */}
          <motion.g
            style={{ transformOrigin: `${cx}px ${cy}px` }}
            animate={{ rotate: needleAngleDeg - 180 }}
            transition={{ type: 'spring', stiffness: 60, damping: 18 }}
          >
            <line
              x1={cx} y1={cy}
              x2={cx - R * 0.7} y2={cy}
              stroke={zone.color}
              strokeWidth={Math.max(1.5, size * 0.02)}
              strokeLinecap="round"
              style={{ filter: `drop-shadow(0 0 3px ${zone.color})` }}
            />
          </motion.g>

          {/* Needle pivot */}
          <circle cx={cx} cy={cy} r={Math.max(4, size * 0.045)}
            fill={zone.color}
            style={{ filter: `drop-shadow(0 0 6px ${zone.glow})` }}
          />

          {/* Score text */}
          <text
            x={cx} y={cy - R * 0.2}
            textAnchor="middle"
            fill={zone.color}
            fontSize={Math.round(size * 0.22)}
            fontWeight="900"
            fontFamily="Inter, system-ui, sans-serif"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {score}
          </text>
          <text
            x={cx} y={cy - R * 0.2 + Math.round(size * 0.14)}
            textAnchor="middle"
            fill="rgba(255,255,255,0.3)"
            fontSize={Math.round(size * 0.09)}
            fontFamily="Inter, system-ui, sans-serif"
          >
            / 100
          </text>

          {/* Zone labels */}
          <text x={cx - R - 2} y={cy + 12} textAnchor="middle" fill="#ef4444" fontSize={size * 0.07} fontFamily="Inter,sans-serif" opacity={0.7}>0</text>
          <text x={cx + R + 2} y={cy + 12} textAnchor="middle" fill="#22c55e" fontSize={size * 0.07} fontFamily="Inter,sans-serif" opacity={0.7}>100</text>
        </svg>

        {/* Delta badge */}
        <AnimatePresence>
          {showDelta && showDeltaAnim && (
            <motion.div
              initial={{ opacity: 0, y: 4, scale: 0.85 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.9 }}
              style={{
                position: 'absolute', top: 0, right: 0,
                padding: '2px 7px', borderRadius: 20,
                background: delta > 0 ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)',
                border: `1px solid ${delta > 0 ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'}`,
                fontSize: 10, fontWeight: 800,
                color: delta > 0 ? '#4ade80' : '#f87171',
              }}
            >
              {delta > 0 ? `↑+${delta}` : `↓${delta}`}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Grade + label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{
          width: 22, height: 22, borderRadius: 6,
          background: `${zone.color}22`, border: `1px solid ${zone.color}55`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 900, color: zone.color,
        }}>
          {zone.grade}
        </div>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: zone.color }}>
          {zone.label}
        </span>
      </div>
    </div>
  );
}
