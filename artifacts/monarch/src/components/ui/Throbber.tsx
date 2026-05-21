const BUTTERFLY = "/monarch-butterfly.png";

interface ThrobberProps {
  size?: number;
}

export function Throbber({ size = 80 }: ThrobberProps) {
  return (
    <div
      style={{
        position: "relative",
        width: size,
        height: size,
        animation: "monarch-bob 2s ease-in-out infinite",
      }}
    >
      <img
        src={BUTTERFLY}
        width={size}
        height={size}
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.18,
          filter: "blur(2px) brightness(0.7)",
          transform: "translateY(6px) scaleX(0.92)",
        }}
        alt=""
        aria-hidden
      />
      <img
        src={BUTTERFLY}
        width={size}
        height={size}
        style={{
          position: "absolute",
          inset: 0,
          transformOrigin: "center center",
          animation: "monarch-flap 0.85s cubic-bezier(0.45, 0, 0.55, 1) infinite",
        }}
        alt=""
        aria-hidden
      />
      <img
        src={BUTTERFLY}
        width={size}
        height={size}
        style={{
          position: "absolute",
          inset: 0,
          opacity: 1,
        }}
        alt="Loading"
      />
    </div>
  );
}
