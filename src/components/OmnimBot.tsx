/**
 * OMNIM AI mascot: big expressive eyes framed by the OMNIM "8" turned on its side (∞), no arms.
 * Pupils look around and the eyes blink (CSS in index.css, disabled for reduced motion).
 */
export default function OmnimBot({ size = 58, animated = true }: { size?: number; animated?: boolean }) {
  const id = `omnim-gold-${size}-${animated ? 'a' : 's'}`;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="block">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FBE3CC" />
          <stop offset="45%" stopColor="#E5B887" />
          <stop offset="100%" stopColor="#A9774A" />
        </linearGradient>
        <radialGradient id={`${id}-bg`} cx="50%" cy="35%" r="75%">
          <stop offset="0%" stopColor="#2A2B30" />
          <stop offset="100%" stopColor="#0B0C10" />
        </radialGradient>
      </defs>

      <circle cx="32" cy="32" r="31" fill={`url(#${id}-bg)`} />
      <circle cx="32" cy="32" r="30" fill="none" stroke={`url(#${id})`} strokeWidth="1.6" opacity="0.7" />

      {/* Eyes fill the two loops */}
      {[19.5, 44.5].map((cx) => (
        <g key={cx} className={animated ? 'omnim-eye' : undefined}>
          <ellipse cx={cx} cy="32" rx="8" ry="9.6" fill="#F8EFE6" />
          <g className={animated ? 'omnim-pupil' : undefined}>
            <circle cx={cx} cy="32.5" r="4.6" fill="#0B0C10" />
            <circle cx={cx + 1.6} cy="30.6" r="1.5" fill="#ffffff" />
          </g>
        </g>
      ))}

      {/* OMNIM logo shape as the glasses frame: a large ∞ with no handles */}
      <path
        d="M32 32 C27.5 20 17.5 17.5 11.5 21.5 C5 26 5 38 11.5 42.5 C17.5 46.5 27.5 44 32 32 C36.5 20 46.5 17.5 52.5 21.5 C59 26 59 38 52.5 42.5 C46.5 46.5 36.5 44 32 32 Z"
        fill="none"
        stroke={`url(#${id})`}
        strokeWidth="3.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}
