import React from 'react';

export const Logo: React.FC<{ className?: string, size?: number }> = ({ className = "", size = 32 }) => {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 128 128" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000000" floodOpacity="0.2"/>
        </filter>
      </defs>
      {/* Blue Hexagon Shape */}
      <path 
        d="M64 8L112.5 36V88L64 116L15.5 88V36L64 8Z" 
        fill="#0088FF" 
        stroke="#0088FF" 
        strokeWidth="6" 
        strokeLinejoin="round" 
        filter="url(#shadow)"
      />
      {/* White 'V' */}
      <path 
        d="M44 48L64 84L84 48" 
        stroke="white" 
        strokeWidth="12" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
      />
    </svg>
  );
};