/**
 * OMNIM AI mascot: two eyes behind glasses shaped like the OMNIM "8" turned on its side (∞).
 * The eyes glance around and blink (CSS in index.css, disabled for reduced motion).
 */
export default function OmnimBot({ size = 58, animated = true }: { size?: number; animated?: boolean }) {
  const id = `omnim-gold-${size}`;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="block">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FBE3CC" />
          <stop offset="45%" stopColor="#E5B887" />
          <stop offset="100%" stopColor="#A9774A" />
        </linearGradient>
        <radialGradient id={`${id}-bg`} cx="50%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#26272B" />
          <stop offset="100%" stopColor="#0B0C10" />
        </radialGradient>
      </defs>

      <circle cx="32" cy="32" r="31" fill={`url(#${id}-bg)`} />
      <circle cx="32" cy="32" r="30" fill="none" stroke={`url(#${id})`} strokeWidth="2" opacity="0.85" />

      {/* Eyes sit inside the two loops of the glasses */}
      <g className={animated ? 'omnim-eyes' : undefined}>
        {[21, 43].map((cx) => (
          <g key={cx} className={animated ? 'omnim-eye' : undefined}>
            <ellipse cx={cx} cy="32" rx="4.4" ry="5.4" fill="#F7EDE3" />
            <circle cx={cx + 0.6} cy="32.4" r="2.5" fill="#0B0C10" />
            <circle cx={cx + 1.5} cy="31.2" r="0.9" fill="#ffffff" />
          </g>
        ))}
      </g>

      {/* Infinity-shaped glasses, echoing the OMNIM logo */}
      <path
        d="M32 32 C28 23.5 21.5 22 17.5 24 C12.5 26.5 12.5 37.5 17.5 40 C21.5 42 28 40.5 32 32 C36 23.5 42.5 22 46.5 24 C51.5 26.5 51.5 37.5 46.5 40 C42.5 42 36 40.5 32 32 Z"
        fill="none"
        stroke={`url(#${id})`}
        strokeWidth="2.8"
        strokeLinejoin="round"
      />
      {/* Temple arms */}
      <path d="M12.6 30 L8 27.5 M51.4 30 L56 27.5" stroke={`url(#${id})`} strokeWidth="2.2" strokeLinecap="round" />
      {/* Glint on the lens */}
      <path d="M15.5 27.5 Q17 25.5 19.5 25" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="1.1" fill="none" strokeLinecap="round" />
    </svg>
  );
}
