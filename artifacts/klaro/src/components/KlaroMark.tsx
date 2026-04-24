interface KlaroMarkProps {
  size?: number;
  className?: string;
}

export function KlaroMark({ size = 28, className = "" }: KlaroMarkProps) {
  return (
    <span
      className={`font-black tracking-tight leading-none select-none inline-block ${className}`}
      style={{ fontSize: size, letterSpacing: "-0.03em" }}
    >
      <span style={{ color: "#ffffff" }}>Klar</span>
      <span style={{ color: "#6af82f" }}>o</span>
    </span>
  );
}
