import React from 'react';

interface OmnimLogoAnimationProps {
  mode?: 'draw-once' | 'loop';
  size?: number;
  className?: string;
  showGlow?: boolean;
}

export const OmnimLogoAnimation: React.FC<OmnimLogoAnimationProps> = ({
  mode = 'draw-once',
  size = 64,
  className = '',
  showGlow = true,
}) => {
  // Continuous figure-8 lemniscate path
  const pathData =
    'M 256 256 C 325 180, 365 145, 365 100 C 365 48, 315 36, 256 36 C 197 36, 147 48, 147 100 C 147 145, 187 180, 256 256 C 325 332, 365 367, 365 412 C 365 464, 315 476, 256 476 C 197 476, 147 464, 147 412 C 147 367, 187 332, 256 256 Z';

  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 512 512"
        width="100%"
        height="100%"
        className="overflow-visible"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Metallic Champagne / Rose Gold Gradient */}
          <linearGradient id="omnimDrawGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FCE1C9" />
            <stop offset="30%" stopColor="#E5B887" />
            <stop offset="70%" stopColor="#BA8356" />
            <stop offset="100%" stopColor="#F5D2B1" />
          </linearGradient>

          {/* Core specular highlight gradient */}
          <linearGradient id="omnimCoreGrad" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
            <stop offset="50%" stopColor="#FFF2E0" stopOpacity="0.75" />
            <stop offset="100%" stopColor="#E5B887" stopOpacity="0.85" />
          </linearGradient>

          {/* Soft ambient glow */}
          {showGlow && (
            <filter id="omnimDrawGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="12" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          )}
        </defs>

        {/* Ambient subtle track outline */}
        <path
          d={pathData}
          fill="none"
          stroke="#E5B887"
          strokeWidth="36"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="opacity-15"
        />

        {/* Primary Animated Stroke */}
        <path
          d={pathData}
          fill="none"
          stroke="url(#omnimDrawGrad)"
          strokeWidth="42"
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength="100"
          filter={showGlow ? 'url(#omnimDrawGlow)' : undefined}
          style={{
            strokeDasharray: mode === 'loop' ? '28 72' : '100',
            strokeDashoffset: mode === 'loop' ? undefined : '0',
            animation:
              mode === 'loop'
                ? 'omnimFlowLoop 1.6s linear infinite'
                : 'omnimDrawSelf 1.3s cubic-bezier(0.4, 0, 0.2, 1) forwards',
          }}
        />

        {/* High-specular core animated line */}
        <path
          d={pathData}
          fill="none"
          stroke="url(#omnimCoreGrad)"
          strokeWidth="14"
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength="100"
          style={{
            strokeDasharray: mode === 'loop' ? '18 82' : '100',
            strokeDashoffset: mode === 'loop' ? undefined : '0',
            animation:
              mode === 'loop'
                ? 'omnimFlowLoop 1.6s linear infinite'
                : 'omnimDrawSelf 1.3s cubic-bezier(0.4, 0, 0.2, 1) forwards',
          }}
        />

        {/* Sparkle highlight on the loop apex */}
        {mode === 'draw-once' && (
          <circle
            cx="210"
            cy="55"
            r="6"
            fill="#FFFFFF"
            className="animate-pulse"
            style={{ animationDuration: '2s' }}
          />
        )}
      </svg>
    </div>
  );
};
