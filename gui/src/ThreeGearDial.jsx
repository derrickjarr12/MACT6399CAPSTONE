import React, { useId } from "react";

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function polarPoint(cx, cy, radius, degrees) {
  const radians = ((degrees - 90) * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(radians),
    y: cy + radius * Math.sin(radians)
  };
}

function normalizeAngle(degrees) {
  let normalized = degrees;
  while (normalized < -180) normalized += 360;
  while (normalized > 180) normalized -= 360;
  return normalized;
}

function angleToValue(degrees) {
  const start = -135;
  const sweep = 280;
  const normalized = normalizeAngle(degrees);
  const offset = normalized < start ? normalized + 360 - start : normalized - start;
  const progress = Math.max(0, Math.min(1, offset / sweep));
  return Math.round(progress * 100);
}

export default function ThreeGearDial({ value = 50, variant = "emotion", onChange }) {
  const gradientId = useId();
  const glowId = useId();
  const ringId = useId();
  const clamped = clamp01(value / 100);
  const needleAngle = -135 + clamped * 280;
  const isVocal = variant === "vocal";
  const accent = isVocal ? "#89f0ff" : "#ff9a3a";
  const accentSoft = isVocal ? "#d6fbff" : "#ffd6ad";

  const teeth = Array.from({ length: 24 }).map((_, index) => {
    const angle = (index / 24) * 360;
    const isLongTooth = index % 2 === 0;
    const rotate = `translate(150 150) rotate(${angle}) scale(0.98) translate(-150 -150)`;
    return (
      <path
        key={`tooth-${index}`}
        d={isLongTooth ? "M140 4 L160 4 L172 32 L172 62 L128 62 L128 32 Z" : "M142 16 L158 16 L167 38 L167 58 L133 58 L133 38 Z"}
        transform={rotate}
        className="gear-tooth-shape"
      />
    );
  });

  const miniScrews = [45, 135, 225, 315].map((angle, index) => {
    const point = polarPoint(150, 150, 110, angle);
    return <circle key={`screw-${index}`} cx={point.x} cy={point.y} r="5" className="gear-screw" />;
  });

  const tickMarks = Array.from({ length: 48 }).map((_, index) => {
    const angle = (index / 48) * 360;
    const major = index % 4 === 0;
    const outer = major ? 129 : 126;
    const inner = major ? 118 : 122;
    const start = polarPoint(150, 150, inner, angle);
    const end = polarPoint(150, 150, outer, angle);
    return <line key={`tick-${index}`} x1={start.x} y1={start.y} x2={end.x} y2={end.y} className={major ? "gear-tick gear-tick-major" : "gear-tick gear-tick-minor"} />;
  });

  const subTicks = Array.from({ length: 24 }).map((_, index) => {
    const angle = (index / 24) * 360 + 7;
    const start = polarPoint(150, 150, 85, angle);
    const end = polarPoint(150, 150, 94, angle);
    return <line key={`subtick-${index}`} x1={start.x} y1={start.y} x2={end.x} y2={end.y} className="gear-subtick" />;
  });

  const highlightLine = polarPoint(150, 150, 88, needleAngle);
  const highlightTip = polarPoint(150, 150, 124, needleAngle);

  const updateFromPointer = (event) => {
    if (!onChange) return;
    const svg = event.currentTarget;
    const rect = svg.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const angle = (Math.atan2(event.clientY - centerY, event.clientX - centerX) * 180) / Math.PI + 90;
    onChange(angleToValue(angle));
  };

  const handlePointerDown = (event) => {
    updateFromPointer(event);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event) => {
    if ((event.buttons & 1) !== 1) return;
    updateFromPointer(event);
  };

  const handleKeyDown = (event) => {
    if (!onChange) return;

    if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
      event.preventDefault();
      onChange(Math.max(0, value - 1));
    }

    if (event.key === "ArrowRight" || event.key === "ArrowUp") {
      event.preventDefault();
      onChange(Math.min(100, value + 1));
    }

    if (event.key === "Home") {
      event.preventDefault();
      onChange(0);
    }

    if (event.key === "End") {
      event.preventDefault();
      onChange(100);
    }
  };

  return (
    <div className="gear2d-shell">
      <div className="gear-top-value">{Math.round(value)}%</div>
      <svg
        className="gear2d-stage"
        viewBox="0 0 300 300"
        role="slider"
        tabIndex={0}
        aria-label={isVocal ? "Vocal delivery dial" : "Emotion dial"}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(value)}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onKeyDown={handleKeyDown}
      >
        <defs>
          <radialGradient id={`${gradientId}-metal`} cx="32%" cy="26%" r="72%">
            <stop offset="0%" stopColor="#f9fbfd" />
            <stop offset="18%" stopColor="#d8dfe6" />
            <stop offset="43%" stopColor="#9098a2" />
            <stop offset="68%" stopColor="#454e57" />
            <stop offset="100%" stopColor="#131820" />
          </radialGradient>
          <radialGradient id={`${gradientId}-core`} cx="38%" cy="32%" r="68%">
            <stop offset="0%" stopColor="#f5f8fb" />
            <stop offset="28%" stopColor="#9ea7b2" />
            <stop offset="63%" stopColor="#2a313a" />
            <stop offset="100%" stopColor="#090d12" />
          </radialGradient>
          <radialGradient id={`${gradientId}-hub`} cx="35%" cy="30%" r="72%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="22%" stopColor={accentSoft} />
            <stop offset="50%" stopColor="#66707b" />
            <stop offset="100%" stopColor="#0b1017" />
          </radialGradient>
          <linearGradient id={`${gradientId}-needle`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="45%" stopColor={accentSoft} />
            <stop offset="100%" stopColor={accent} />
          </linearGradient>
          <filter id={`${glowId}-shadow`} x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor={accent} floodOpacity="0.45" />
            <feDropShadow dx="0" dy="0" stdDeviation="10" floodColor="#000000" floodOpacity="0.45" />
          </filter>
          <mask id={`${ringId}-mask`}>
            <rect width="300" height="300" fill="white" />
            <circle cx="150" cy="150" r="86" fill="black" />
          </mask>
        </defs>

        <circle cx="150" cy="150" r="141" className="gear-back-plate" />
        <circle cx="150" cy="150" r="138" className="gear-outer-shadow" />
        <g filter={`url(#${glowId}-shadow)`}>
          <g className="gear-teeth-group">{teeth}</g>
          <circle cx="150" cy="150" r="120" fill={`url(#${gradientId}-metal)`} className="gear-rim" />
        </g>

        <circle cx="150" cy="150" r="112" className="gear-rim-inner" />
        <g className="gear-ticks-group">{tickMarks}</g>
        <g className="gear-subticks-group">{subTicks}</g>

        <circle cx="150" cy="150" r="84" className="gear-center-plate" />
        <circle cx="150" cy="150" r="64" fill={`url(#${gradientId}-core)`} className="gear-center-core" />

        <g mask={`url(#${ringId}-mask)`} className="gear-sheen-group">
          <ellipse cx="118" cy="100" rx="78" ry="52" className="gear-sheen" />
        </g>

        <g transform={`rotate(${needleAngle} 150 150)`} className="gear-needle-group">
          <line x1={highlightLine.x} y1={highlightLine.y} x2={highlightTip.x} y2={highlightTip.y} className="gear-needle" />
          <polygon points="150,38 144,54 156,54" fill={`url(#${gradientId}-needle)`} className="gear-needle-tip" />
        </g>

        <circle cx="150" cy="150" r="42" className="gear-hub-ring" />
        <circle cx="150" cy="150" r="30" fill={`url(#${gradientId}-hub)`} className="gear-hub" />
        <circle cx="150" cy="150" r="18" className="gear-hub-core" />
        <circle cx="150" cy="150" r="7" className="gear-hub-bolt" />

        <g className="gear-bolts">{miniScrews}</g>
      </svg>
    </div>
  );
}
