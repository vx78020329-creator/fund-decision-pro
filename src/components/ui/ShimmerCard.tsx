import { ReactNode } from 'react';
import { motion } from 'framer-motion';

interface ShimmerCardProps {
  children: ReactNode;
  className?: string;
  hoverScale?: number;
}

export default function ShimmerCard({
  children,
  className = '',
  hoverScale = 1.02,
}: ShimmerCardProps) {
  return (
    <motion.div
      className={`relative overflow-hidden rounded-2xl backdrop-blur-xl ${className}`}
      whileHover={{ scale: hoverScale }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      style={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05))',
        border: '1px solid rgba(255,255,255,0.1)',
      }}
    >
      {/* Glow border effect on hover */}
      <motion.div
        className="absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300"
        whileHover={{ opacity: 1 }}
        style={{
          background: 'linear-gradient(135deg, rgba(99,102,241,0.3), rgba(139,92,246,0.2))',
          filter: 'blur(20px)',
          zIndex: -1,
        }}
      />

      {/* Shimmer effect */}
      <motion.div
        className="absolute inset-0 -translate-x-full"
        animate={{
          translateX: ['100%', '-100%'],
        }}
        transition={{
          repeat: Infinity,
          repeatDelay: 3,
          duration: 1.5,
          ease: 'easeInOut',
        }}
        style={{
          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)',
        }}
      />

      {/* Content */}
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
}
