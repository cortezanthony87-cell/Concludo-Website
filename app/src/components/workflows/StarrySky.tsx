import React, { useMemo } from 'react';

// Deterministic pseudo-random generator for consistent star placement across re-renders
function createPRNG(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

interface Star {
  id: string;
  cx: number;
  cy: number;
  r: number;
  opacity: number;
  fill: string;
  animClass?: string;
  animDelay?: string;
  animDuration?: string;
  hasCross?: boolean;
}

export const StarrySky: React.FC = () => {
  const stars = useMemo(() => {
    const rand = createPRNG(98765);
    const list: Star[] = [];

    // 1. Distant micro stars (140 stars, tiny pinpricks at optical infinity)
    for (let i = 0; i < 140; i++) {
      list.push({
        id: `micro-${i}`,
        cx: +(rand() * 1600).toFixed(1),
        cy: +(rand() * 1000).toFixed(1),
        r: +(0.55 + rand() * 0.45).toFixed(2),
        opacity: +(0.2 + rand() * 0.35).toFixed(2),
        fill: rand() > 0.8 ? '#E0E7FF' : '#FFFFFF',
      });
    }

    // 2. Mid-distance stars (58 stars with gentle shimmering)
    for (let i = 0; i < 58; i++) {
      const twinkleIndex = Math.floor(rand() * 3) + 1;
      list.push({
        id: `mid-${i}`,
        cx: +(rand() * 1600).toFixed(1),
        cy: +(rand() * 1000).toFixed(1),
        r: +(1.05 + rand() * 0.55).toFixed(2),
        opacity: +(0.45 + rand() * 0.4).toFixed(2),
        fill: rand() > 0.85 ? '#FEF08A' : rand() > 0.65 ? '#E0E7FF' : '#FFFFFF',
        animClass: `wb-star-twinkle-${twinkleIndex}`,
        animDelay: `${(rand() * 6).toFixed(1)}s`,
        animDuration: `${(3.5 + rand() * 3.5).toFixed(1)}s`,
      });
    }

    // 3. Focal bright stars (22 stars with prominent glow)
    for (let i = 0; i < 22; i++) {
      list.push({
        id: `focal-${i}`,
        cx: +(rand() * 1600).toFixed(1),
        cy: +(rand() * 1000).toFixed(1),
        r: +(1.7 + rand() * 0.7).toFixed(2),
        opacity: +(0.75 + rand() * 0.25).toFixed(2),
        fill: rand() > 0.7 ? '#FDE047' : '#FFFFFF',
        animClass: 'wb-star-pulse',
        animDelay: `${(rand() * 5).toFixed(1)}s`,
        animDuration: `${(4 + rand() * 3).toFixed(1)}s`,
        hasCross: i < 5, // Top 5 have 4-point sparkle cross
      });
    }

    return list;
  }, []);

  return (
    <div className="wb-starry-sky" aria-hidden="true">
      {/* Faint distant cosmic nebula glow */}
      <div className="wb-nebula-glow wb-nebula-1" />
      <div className="wb-nebula-glow wb-nebula-2" />

      {/* Vector starfield */}
      <svg
        className="wb-stars-svg"
        viewBox="0 0 1600 1000"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Soft radial glow filter for prominent focal stars */}
          <radialGradient id="wb-star-glow-grad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="1" />
            <stop offset="40%" stopColor="#E2B53C" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#E2B53C" stopOpacity="0" />
          </radialGradient>
          <filter id="wb-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {stars.map((star) => (
          <g key={star.id}>
            {/* 4-point diffraction cross for brightest focal stars */}
            {star.hasCross && (
              <g
                className={star.animClass}
                style={{
                  animationDelay: star.animDelay,
                  animationDuration: star.animDuration,
                  transformOrigin: `${star.cx}px ${star.cy}px`,
                }}
              >
                <line
                  x1={star.cx - 7}
                  y1={star.cy}
                  x2={star.cx + 7}
                  y2={star.cy}
                  stroke={star.fill}
                  strokeWidth="0.65"
                  opacity={star.opacity * 0.7}
                />
                <line
                  x1={star.cx}
                  y1={star.cy - 7}
                  x2={star.cx}
                  y2={star.cy + 7}
                  stroke={star.fill}
                  strokeWidth="0.65"
                  opacity={star.opacity * 0.7}
                />
              </g>
            )}

            {/* Star circle */}
            <circle
              cx={star.cx}
              cy={star.cy}
              r={star.r}
              fill={star.fill}
              opacity={star.opacity}
              className={star.animClass}
              filter={star.hasCross ? 'url(#wb-glow)' : undefined}
              style={{
                animationDelay: star.animDelay,
                animationDuration: star.animDuration,
                transformOrigin: `${star.cx}px ${star.cy}px`,
              }}
            />
          </g>
        ))}
      </svg>
    </div>
  );
};
