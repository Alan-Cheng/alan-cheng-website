import React, { useEffect, useRef, useState } from 'react';

interface AnimatedCardProps {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  as?: 'div' | 'button';
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
}

export const AnimatedCard: React.FC<AnimatedCardProps> = ({ 
  children, 
  delay = 0, 
  className = '',
  as: Component = 'div',
  onClick,
  type
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const cardRef = useRef<HTMLDivElement | HTMLButtonElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // 元素進入視窗後，稍微延遲再觸發動畫，給圖片載入時間
            setTimeout(() => {
              setIsVisible(true);
            }, delay * 1000);
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.1, // 當 10% 的元素可見時觸發
        rootMargin: '50px', // 提前 50px 開始觀察
      }
    );

    if (cardRef.current) {
      observer.observe(cardRef.current);
    }

    return () => {
      if (cardRef.current) {
        observer.unobserve(cardRef.current);
      }
    };
  }, [delay]);

  const combinedClassName = `${isVisible ? 'animate-fade-in-up' : 'opacity-0'} ${className}`;

  if (Component === 'button') {
    return (
      <button
        ref={cardRef as React.RefObject<HTMLButtonElement>}
        className={combinedClassName}
        onClick={onClick}
        type={type}
      >
        {children}
      </button>
    );
  }

  return (
    <div
      ref={cardRef as React.RefObject<HTMLDivElement>}
      className={combinedClassName}
    >
      {children}
    </div>
  );
};

