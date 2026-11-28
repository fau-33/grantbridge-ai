import React from "react";

interface MatchScoreRingProps {
  score: number;
  size?: number;
}

export function MatchScoreRing({ score, size = 76 }: MatchScoreRingProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const radius = 30;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (clamped / 100) * circumference;

  return (
    <div
      className="relative inline-flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
      aria-label={`Match Score de ${clamped}%`}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 76 76"
        className="-rotate-90"
      >
        <circle
          cx="38"
          cy="38"
          r={radius}
          fill="none"
          stroke="#1A2F24"
          strokeWidth="6"
        />
        <circle
          cx="38"
          cy="38"
          r={radius}
          fill="none"
          stroke="#20BD80"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{
            transition: "stroke-dashoffset 850ms cubic-bezier(0.16, 1, 0.3, 1)",
            filter: "drop-shadow(0 0 6px rgba(87, 220, 160, 0.45))",
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display font-bold text-lg leading-none text-[#57DCA0]">
          {clamped}%
        </span>
        <span className="font-mono text-[9px] uppercase tracking-wider text-[#8EA396] mt-0.5">
          match
        </span>
      </div>
    </div>
  );
}
