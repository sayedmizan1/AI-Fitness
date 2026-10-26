/**
 * BodyScanOverlay — AI Camera Initialization Animation
 *
 * Plays a scanning animation when pose detection first loads.
 * Gives visual feedback that AI is initializing.
 */
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  isScanning: boolean;   // true while MediaPipe is loading
  isDetected: boolean;   // true once first pose is found
}

const SCAN_MESSAGES = [
  'Initializing neural engine…',
  'Loading pose model…',
  'Calibrating 33 landmarks…',
  'Activating form analyzer…',
  'AI ready — step into frame',
];

export default function BodyScanOverlay({ isScanning, isDetected }: Props) {
  const [msgIdx, setMsgIdx] = useState(0);
  const [done, setDone]     = useState(false);

  useEffect(() => {
    if (!isScanning) return;
    const t = setInterval(() => setMsgIdx(i => Math.min(i + 1, SCAN_MESSAGES.length - 1)), 600);
    return () => clearInterval(t);
  }, [isScanning]);

  useEffect(() => {
    if (isDetected) {
      const t = setTimeout(() => setDone(true), 800);
      return () => clearTimeout(t);
    } else {
      setDone(false);
    }
  }, [isDetected]);

  // Only show the full overlay while the model is actively loading
  // Once mpLoading ends OR pose is detected, fade out completely
  const show = isScanning && !done;
  // Partial overlay: transparent bg so camera feed always visible after model loads
  const coverBg = msgIdx < 3 ? 'rgba(3,7,18,0.65)' : 'rgba(3,7,18,0.12)';

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          style={{
            position: 'absolute', inset: 0, zIndex: 20,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexDirection: 'column', gap: 24,
            background: coverBg,
            // NO backdropFilter — it blurs the live camera feed
            transition: 'background 0.8s ease',
          }}
        >
          {/* Corner scan markers */}
          {['top-left','top-right','bottom-left','bottom-right'].map(corner => {
            const isTop    = corner.includes('top');
            const isLeft   = corner.includes('left');
            return (
              <motion.div
                key={corner}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                style={{
                  position: 'absolute',
                  top:    isTop    ? 20  : undefined,
                  bottom: !isTop   ? 20  : undefined,
                  left:   isLeft   ? 20  : undefined,
                  right:  !isLeft  ? 20  : undefined,
                  width: 28, height: 28,
                  borderTop:    isTop  ? '2px solid #22c55e' : undefined,
                  borderBottom: !isTop ? '2px solid #22c55e' : undefined,
                  borderLeft:   isLeft  ? '2px solid #22c55e' : undefined,
                  borderRight:  !isLeft ? '2px solid #22c55e' : undefined,
                  boxShadow: isLeft && isTop ? '2px 2px 8px rgba(34,197,94,0.4)' : undefined,
                }}
              />
            );
          })}

          {/* Horizontal scan line */}
          <motion.div
            style={{
              position: 'absolute', left: 20, right: 20, height: 1,
              background: 'linear-gradient(90deg, transparent, #22c55e, transparent)',
              boxShadow: '0 0 12px rgba(34,197,94,0.8)',
            }}
            animate={{ top: ['15%', '85%', '15%'] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}
          />

          {/* Center content */}
          <div style={{ textAlign: 'center', zIndex: 1 }}>
            {/* Spinning rings */}
            <div style={{ position: 'relative', width: 72, height: 72, margin: '0 auto 16px' }}>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                style={{
                  position: 'absolute', inset: 0, borderRadius: '50%',
                  border: '2px solid transparent',
                  borderTop: '2px solid #22c55e',
                  borderRight: '2px solid #22c55e',
                }}
              />
              <motion.div
                animate={{ rotate: -360 }}
                transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                style={{
                  position: 'absolute', inset: 8, borderRadius: '50%',
                  border: '1.5px solid transparent',
                  borderTop: '1.5px solid #6366f1',
                }}
              />
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <motion.div
                  animate={{ scale: [0.8, 1.1, 0.8], opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  style={{ width: 12, height: 12, borderRadius: '50%', background: '#22c55e' }}
                />
              </div>
            </div>

            {/* Cycling message */}
            <AnimatePresence mode="wait">
              <motion.div
                key={msgIdx}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                style={{
                  fontSize: 12, fontWeight: 700, color: '#4ade80',
                  letterSpacing: '0.03em',
                  textShadow: '0 0 12px rgba(34,197,94,0.7)',
                }}
              >
                {SCAN_MESSAGES[msgIdx]}
              </motion.div>
            </AnimatePresence>

            {/* Animated dots */}
            <div style={{ display: 'flex', gap: 5, justifyContent: 'center', marginTop: 12 }}>
              {[0,1,2,3,4].map(i => (
                <motion.div
                  key={i}
                  animate={{ scale: [0.8, 1.3, 0.8], opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
                  style={{ width: 5, height: 5, borderRadius: '50%', background: '#22c55e' }}
                />
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
