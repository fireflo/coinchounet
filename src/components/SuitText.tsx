import React from 'react';

const SUIT_MAP = {
  '♠': 'spades',
  '♥': 'hearts',
  '♦': 'diamonds',
  '♣': 'clubs',
} as const;

interface SuitTextProps {
  text: string;
  className?: string;
}

// Renders a string that may contain playing card suit characters and
// wraps heart/diamond characters in a red-colored span so they appear red in the UI.
export const SuitText: React.FC<SuitTextProps> = ({ text, className }) => {
  // Split into array of characters so we can wrap suits individually
  const parts = Array.from(text);

  return (
    <span className={className}>
      {parts.map((ch, i) => {
        if (ch === '♥' || ch === '♦') {
          return (
            <span key={i} className="text-red-600">
              {ch}
            </span>
          );
        }
        return <span key={i}>{ch}</span>;
      })}
    </span>
  );
};

export default SuitText;
