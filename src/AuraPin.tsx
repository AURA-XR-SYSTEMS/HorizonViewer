import React from 'react';
import { AuraLocation } from './types';

interface AuraPinProps {
  location: AuraLocation;
  left: string;
  top: string;
  isVisible: boolean;
  isSelected: boolean;
  /** Phones: pad the hit area out to 44px around the 24px glyph. */
  compact?: boolean;
  onClick: (location: AuraLocation, left: string, top: string) => void;
}

const AuraPin: React.FC<AuraPinProps> = ({
  location,
  left,
  top,
  isVisible,
  isSelected,
  compact = false,
  onClick,
}) => {
  const handlePinClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick(location, left, top);
  };

  // The desktop markup is unchanged: an inline svg directly in the anchor div.
  const glyph = (
    <svg
      onClick={compact ? undefined : handlePinClick}
      className={`cursor-pointer transition-transform duration-150 ${isSelected ? 'scale-125' : 'hover:scale-110'}`}
      width="24"
      height="28"
      viewBox="0 0 24 28"
      style={{
        filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
        ...(compact ? { display: 'block' } : {}),
      }}
      aria-hidden={compact ? true : undefined}
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
  );

  return (
    <div
      className="absolute"
      data-testid={`aura-pin-${location.id}`}
      style={{
        left: left,
        top: top,
        transform: 'translate(-50%, -100%)',
        opacity: isVisible ? 1 : 0,
        pointerEvents: isVisible ? 'auto' : 'none',
        transition: 'opacity 150ms ease-out',
      }}
    >
      {compact ? (
        // The glyph stays 24x28 so its tip still marks the spot; the button is
        // the 44px tap target, with negative margins so the tip's position in
        // the anchor div does not move.
        <button
          type="button"
          aria-label={location.Name}
          aria-pressed={isSelected}
          onClick={handlePinClick}
          onPointerDown={(e) => e.stopPropagation()}
          className="flex items-center justify-center"
          style={{ width: 44, height: 44, margin: '-8px -10px -8px -10px' }}
        >
          {glyph}
        </button>
      ) : (
        glyph
      )}
    </div>
  );
};

export default AuraPin;
