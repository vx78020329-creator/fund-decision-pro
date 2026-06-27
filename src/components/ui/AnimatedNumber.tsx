import { useEffect, useRef } from 'react';
import { useMotionValue, useTransform, animate, motion } from 'framer-motion';

interface AnimatedNumberProps {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  duration?: number;
  className?: string;
}

export default function AnimatedNumber({
  value,
  prefix = '',
  suffix = '',
  decimals = 2,
  duration = 1.2,
  className = '',
}: AnimatedNumberProps) {
  const motionValue = useMotionValue(0);
  const previousValue = useRef(0);

  const rounded = useTransform(motionValue, (latest) => {
    const isNegative = latest < 0;
    const absValue = Math.abs(latest);
    const formatted = absValue.toFixed(decimals);
    return `${isNegative ? '-' : ''}${prefix}${formatted}${suffix}`;
  });

  useEffect(() => {
    const controls = animate(motionValue, value, {
      duration,
      ease: 'easeOut',
      onUpdate: (latest) => {
        previousValue.current = latest;
      },
    });
    return controls.stop;
  }, [value, duration, motionValue]);

  const isPositive = value >= 0;

  return (
    <motion.span
      className={className}
      style={{
        color: isPositive ? '#10b981' : '#ef4444',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {rounded}
    </motion.span>
  );
}
