import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface IntroSequenceProps {
  onComplete: () => void;
}

export function IntroSequence({ onComplete }: IntroSequenceProps) {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const timer1 = setTimeout(() => setStage(1), 1000);
    const timer2 = setTimeout(() => setStage(2), 2500);
    const timer3 = setTimeout(() => onComplete(), 5000);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [onComplete]);

  return (
    <div className="relative w-full h-screen bg-[#0a0a14] overflow-hidden film-grain">
      {/* Ambient background particles */}
      <div className="absolute inset-0">
        {[...Array(30)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-cyan-glow/20 rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              y: [0, -100, 0],
              opacity: [0, 0.5, 0],
            }}
            transition={{
              duration: 3 + Math.random() * 2,
              repeat: Infinity,
              delay: Math.random() * 2,
            }}
          />
        ))}
      </div>

      {/* Floating glass shards */}
      <AnimatePresence>
        {stage >= 0 && (
          <>
            {[...Array(8)].map((_, i) => (
              <motion.div
                key={`shard-${i}`}
                className="absolute glass-panel"
                style={{
                  width: 120 + Math.random() * 100,
                  height: 120 + Math.random() * 100,
                  left: `${15 + i * 10}%`,
                  top: `${20 + Math.sin(i) * 15}%`,
                  rotate: Math.random() * 45,
                }}
                initial={{ opacity: 0, scale: 0, rotate: 0 }}
                animate={{
                  opacity: [0, 0.3, 0.2],
                  scale: [0, 1, 1],
                  rotate: [0, 15 + i * 5],
                  y: [0, -20, 0],
                }}
                exit={{ opacity: 0, scale: 0 }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  repeatType: 'reverse',
                  delay: i * 0.1,
                }}
              />
            ))}
          </>
        )}
      </AnimatePresence>

      {/* Blurred profile silhouettes in background */}
      <div className="absolute inset-0 flex items-center justify-center opacity-20">
        {[...Array(5)].map((_, i) => (
          <motion.div
            key={`silhouette-${i}`}
            className="absolute w-32 h-32 rounded-full bg-gradient-to-br from-cyan-glow/30 to-violet-smoke/30"
            style={{
              left: `${20 + i * 15}%`,
              top: `${30 + Math.sin(i) * 20}%`,
              filter: 'blur(40px)',
            }}
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.3, 0.6, 0.3],
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              delay: i * 0.5,
            }}
          />
        ))}
      </div>

      {/* Moving light sweeps */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-glow/5 to-transparent"
        animate={{
          x: ['-100%', '200%'],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: 'linear',
        }}
      />

      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
        <AnimatePresence mode="wait">
          {stage >= 1 && (
            <motion.div
              className="text-center"
              initial={{ opacity: 0, y: 20, filter: 'blur(10px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, scale: 1.2, filter: 'blur(20px)' }}
              transition={{ duration: 1, ease: 'easeOut' }}
            >
              <motion.h1
                className="text-7xl tracking-tight mb-6"
                style={{
                  background: 'linear-gradient(135deg, #00d9ff 0%, #8b7aff 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
                animate={{
                  backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                }}
              >
                Resonance
              </motion.h1>

              {stage >= 2 && (
                <motion.p
                  className="text-lg text-silver-soft/80 max-w-lg"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.3 }}
                >
                  Memory, identity, and relationships — mapped beautifully
                </motion.p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Skip button */}
      <motion.button
        className="absolute bottom-8 right-8 px-6 py-3 glass-panel text-sm text-cyan-glow/80 hover:text-cyan-glow transition-colors z-20"
        onClick={onComplete}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        Skip Intro
      </motion.button>
    </div>
  );
}
