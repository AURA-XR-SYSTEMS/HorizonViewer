import React from 'react';
import { AuraLocation } from './types';

interface AuraPinProps {
  location: AuraLocation;
  left: string;
  top: string;
  isVisible: boolean;
  isSelected: boolean;
  onClick: (location: AuraLocation, left: string, top: string) => void;
}

const AuraPin: React.FC<AuraPinProps> = ({ location, left, top, isVisible, isSelected, onClick }) => {
  const handlePinClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick(location, left, top);
  };

  return (
    <div
      className="absolute"
      style={{
        left: left,
        top: top,
        transform: 'translate(-50%, -100%)',
        opacity: isVisible ? 1 : 0,
        pointerEvents: isVisible ? 'auto' : 'none',
        transition: 'opacity 150ms ease-out',
      }}
    >
      {/* The Pin - White upside-down triangle with thick rounded black outline */}
      <svg
        onClick={handlePinClick}
        className={`cursor-pointer transition-transform duration-150 ${isSelected ? 'scale-125' : 'hover:scale-110'}`}
        width="24"
        height="28"
        viewBox="0 0 24 28"
        style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }}
      >
        <path
          d="M12 26 L2 4 L22 4 Z"
          fill={isSelected ? '#60a5fa' : 'white'}
          stroke="black"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
};

export default AuraPin;
