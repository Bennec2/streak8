import React, { useEffect, useState, useRef } from 'react';
import { formatCurrency } from '../utils/gameUtils';

interface RollingNumberProps {
  value: number;
  className?: string;
  animate?: boolean;
}

const RollingNumber: React.FC<RollingNumberProps> = ({ value, className = "", animate = true }) => {
  const [displayValue, setDisplayValue] = useState(value);
  const [scale, setScale] = useState(1);
  const previousValue = useRef(value);

  useEffect(() => {
    if (previousValue.current !== value) {
      // Trigger Pop Animation
      if (animate) setScale(1.3);
      
      const duration = 800;
      const steps = 10;
      const stepTime = duration / steps;
      let currentStep = 0;

      const interval = setInterval(() => {
        currentStep++;
        if (currentStep < steps) {
            const randomVariation = Math.floor(value * (0.9 + Math.random() * 0.2));
            setDisplayValue(randomVariation);
        } else {
            clearInterval(interval);
            setDisplayValue(value);
            previousValue.current = value;
            setScale(1); // Reset scale
        }
      }, stepTime);
      
      // Reset scale slightly before end of rolling for smooth landing
      const scaleTimeout = setTimeout(() => setScale(1), 300);

      return () => {
        clearInterval(interval);
        clearTimeout(scaleTimeout);
      };
    }
  }, [value, animate]);

  return (
    <span 
      className={`inline-block transition-transform duration-300 ${className}`}
      style={{ transform: `scale(${scale})` }}
    >
      {formatCurrency(displayValue)}
    </span>
  );
};

export default RollingNumber;