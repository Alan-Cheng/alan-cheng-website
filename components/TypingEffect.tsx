import React, { useState, useEffect } from 'react';

interface TypingEffectProps {
  /** 要顯示的文字 */
  text: string;
  /** 打字速度（毫秒），預設 50 */
  speed?: number;
  /** 是否顯示閃爍的光標，預設 true */
  showCursor?: boolean;
  /** 光標閃爍速度（毫秒），預設 530 */
  cursorBlinkSpeed?: number;
  /** 開始打字前的延遲（毫秒），預設 0 */
  startDelay?: number;
  /** 打字完成後光標持續顯示的時間（毫秒），預設 2000，設為 0 則持續顯示 */
  cursorDuration?: number;
  /** 自訂 className */
  className?: string;
}

export const TypingEffect: React.FC<TypingEffectProps> = ({
  text,
  speed = 50,
  showCursor = true,
  cursorBlinkSpeed = 530,
  startDelay = 0,
  cursorDuration = 2000,
  className = '',
}) => {
  const [displayedText, setDisplayedText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [shouldShowCursor, setShouldShowCursor] = useState(true);
  const [cursorBlink, setCursorBlink] = useState(true);

  // 打字效果
  useEffect(() => {
    if (currentIndex >= text.length) {
      setIsComplete(true);
      return;
    }

    const timer = setTimeout(() => {
      setDisplayedText(text.slice(0, currentIndex + 1));
      setCurrentIndex(currentIndex + 1);
    }, currentIndex === 0 ? startDelay : speed);

    return () => clearTimeout(timer);
  }, [currentIndex, text, speed, startDelay]);

  // 打字完成後，光標持續顯示一段時間後消失
  useEffect(() => {
    if (!isComplete || !showCursor) return;

    if (cursorDuration > 0) {
      const hideCursorTimer = setTimeout(() => {
        setShouldShowCursor(false);
      }, cursorDuration);

      return () => clearTimeout(hideCursorTimer);
    }
  }, [isComplete, showCursor, cursorDuration]);

  // 光標閃爍效果（只在應該顯示光標時閃爍）
  useEffect(() => {
    if (!showCursor || !shouldShowCursor) {
      return;
    }

    const cursorTimer = setInterval(() => {
      setCursorBlink((prev) => !prev);
    }, cursorBlinkSpeed);

    return () => clearInterval(cursorTimer);
  }, [showCursor, cursorBlinkSpeed, shouldShowCursor]);

  return (
    <span className={className}>
      {displayedText}
      {showCursor && shouldShowCursor && cursorBlink && (
        <span className="inline-block w-0.5 h-4 bg-stone-600 ml-0.5" />
      )}
    </span>
  );
};

