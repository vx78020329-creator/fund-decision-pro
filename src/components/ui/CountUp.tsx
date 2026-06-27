import { useState, useEffect, useRef, useCallback } from 'react';

interface CountUpProps {
  end: number;
  start?: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
}

export default function CountUp({
  end,
  start = 0,
  duration = 2000,
  prefix = '',
  suffix = '',
  decimals = 0,
  className = '',
}: CountUpProps) {
  const [value, setValue] = useState(start);
  const frameRef = useRef<number>();
  const startTimeRef = useRef<number>();

  const animate = useCallback(
    (timestamp: number) => {
      if (!startTimeRef.current) {
        startTimeRef.current = timestamp;
      }

      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);

      // Ease out cubic
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      const currentValue = start + (end - start) * easedProgress;

      setValue(currentValue);

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      }
    },
    [start, end, duration]
  );

  useEffect(() => {
    frameRef.current = requestAnimationFrame(animate);

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [animate]);

  const formattedValue = value.toFixed(decimals);
  const isNegative = value < 0;

  return (
    <span
      className={className}
      style={{
        color: isNegative ? '#ef4444' : '#10b981',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {isNegative ? '-' : ''}
      {prefix}
      {Math.abs(parseFloat(formattedValue)).toFixed(decimals)}
      {suffix}
    </span>
  );
}
