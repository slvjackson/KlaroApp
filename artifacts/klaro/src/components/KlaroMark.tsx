export function KlaroMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="kg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#a18bff" />
          <stop offset="1" stopColor="#5b8cff" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="30" height="30" rx="9" fill="url(#kg)" />
      <path
        d="M10 8 V24 M10 16 L20 8 M10 16 L22 24"
        stroke="#0c0c0f"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="23" cy="9" r="2" fill="#10b981" stroke="#0c0c0f" strokeWidth="1.2" />
    </svg>
  );
}
