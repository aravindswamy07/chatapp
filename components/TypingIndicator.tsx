import React, { useEffect, useState } from 'react';

type TypingIndicatorProps = {
  typingUsers: string[];
};

export default function TypingIndicator({ typingUsers }: TypingIndicatorProps) {
  const [dots, setDots] = useState('');
  
  // Animated dots
  useEffect(() => {
    if (typingUsers.length === 0) return;
    
    const intervalId = setInterval(() => {
      setDots(prev => {
        if (prev === '...') return '';
        return prev + '.';
      });
    }, 500);
    
    return () => clearInterval(intervalId);
  }, [typingUsers.length]);
  
  if (typingUsers.length === 0) {
    return null;
  }
  
  let message = '';
  if (typingUsers.length === 1) {
    message = `${typingUsers[0]} is typing${dots}`;
  } else if (typingUsers.length === 2) {
    message = `${typingUsers[0]} and ${typingUsers[1]} are typing${dots}`;
  } else {
    message = `${typingUsers[0]} and ${typingUsers.length - 1} others are typing${dots}`;
  }
  
  return (
    <div className="text-gray-400 text-sm italic px-2 py-1 flex items-center">
      <div className="typing-animation mr-2">
        <span className="dot"></span>
        <span className="dot"></span>
        <span className="dot"></span>
      </div>
      {message}
    </div>
  );
} 