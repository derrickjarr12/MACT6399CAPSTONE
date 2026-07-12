import React, { useId, useRef } from "react";

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

export default function ThreeGearDial({ value = 50, variant = "emotion", onChange, accentColor, hideValue, step = 1, fineStep = 0.1 }) {
  const gradientId = useId();
  const glowId = useId();
  const ringId = useId();
  const activePointerIdRef = useRef(null);
  const clamped = clamp01(value / 100);
  const needleAngle = -135 + clamped * 280;
  const isVocal = variant === "vocal";
  let accent = isVocal ? "#89f0ff" : "#ff9a3a";
  let accentSoft = isVocal ? "#d6fbff" : "#ffd6ad";
  if (accentColor) {
    accent = accentColor;
    accentSoft = accentColor + '55';
  }
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


  // --- Interactive dial handlers ---
  // Calculate angle from pointer event

  // Map pointer angle (0-360) to dial value (0-100) freely, with no dead zone
  function getAngleFromEvent(event, svg) {
    const rect = svg.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const x = event.clientX - cx;
    const y = event.clientY - cy;
    let angle = Math.atan2(y, x) * 180 / Math.PI;
    angle = (angle + 450) % 360; // 0 at top, clockwise
    return angle;
  }

  function angleToDialValueFree(angle) {
    // Map 0-360 to 0-100, 0 at top, clockwise
    return Math.max(0, Math.min(100, (angle / 360) * 100));
  }

  function snapValue(rawValue, event) {
    const activeStep = event?.shiftKey ? fineStep : step;
    const snapped = Math.round(rawValue / activeStep) * activeStep;
    return Math.max(0, Math.min(100, Number(snapped.toFixed(2))));
  }

  function handlePointerDown(event) {
    if (!onChange) return;
    event.preventDefault();
    const svg = event.currentTarget;
    const angle = getAngleFromEvent(event, svg);
    onChange(snapValue(angleToDialValueFree(angle), event));
    activePointerIdRef.current = event.pointerId;
    svg.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event) {
    if (!onChange) return;
    if (activePointerIdRef.current !== event.pointerId) return;
    const angle = getAngleFromEvent(event, event.currentTarget);
    onChange(snapValue(angleToDialValueFree(angle), event));
  }

  function handlePointerUp(event) {
    if (activePointerIdRef.current !== event.pointerId) return;
    activePointerIdRef.current = null;
  }

  function handleKeyDown(event) {
    if (!onChange) return;
    const activeStep = event.shiftKey ? fineStep : step;
    if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
      event.preventDefault();
      onChange(Math.max(0, Number((value - activeStep).toFixed(2))));
    }
    if (event.key === "ArrowRight" || event.key === "ArrowUp") {
      event.preventDefault();
      onChange(Math.min(100, Number((value + activeStep).toFixed(2))));
    }
    if (event.key === "Home") {
      event.preventDefault();
      onChange(0);
    }
    if (event.key === "End") {
      event.preventDefault();
      onChange(100);
    }
  }

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
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onKeyDown={handleKeyDown}
      >
        {/* Gear teeth */}
        {teeth}

        {/* Outer shadow for depth */}
        <ellipse cx="150" cy="170" rx="100" ry="30" fill="#000" opacity="0.12" />

        {/* Accent ring with gradient */}
        <circle cx="150" cy="150" r="110" fill="none" stroke="url(#accentRing)" strokeWidth="10" />

        {/* Main dial face with radial gradient */}
        <circle cx="150" cy="150" r="90" fill="url(#dialFace)" stroke="url(#dialEdge)" strokeWidth="4" />

        {/* Dial highlight for gloss */}
        <ellipse cx="150" cy="120" rx="55" ry="18" fill="url(#highlight)" opacity="0.35" />

        {/* Needle with shadow */}
        <g transform={`rotate(${needleAngle} 150 150)`}>
          <rect x="146.5" y="55" width="7" height="70" rx="3.5" fill="url(#needleGrad)" filter="url(#needleShadow)" />
          <circle cx="150" cy="125" r="8" fill={accent} filter="url(#needleShadow)" />
        </g>

        {/* Center cap with 3D effect */}
        <circle cx="150" cy="150" r="26" fill="url(#capGrad)" stroke={accent} strokeWidth="3" />
        <ellipse cx="150" cy="144" rx="12" ry="5" fill="#fff" opacity="0.18" />

        {/* SVG Gradients and Filters */}
        <defs>
          <radialGradient id="dialFace" cx="50%" cy="40%" r="70%">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.18" />
            <stop offset="60%" stopColor="#222" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#111" stopOpacity="1" />
          </radialGradient>
          <linearGradient id="dialEdge" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.5" />
            <stop offset="100%" stopColor={accent} stopOpacity="1" />
          </linearGradient>
          <linearGradient id="accentRing" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={accentSoft} />
            <stop offset="100%" stopColor={accent} />
          </linearGradient>
          <radialGradient id="capGrad" cx="50%" cy="40%" r="70%">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.7" />
            <stop offset="80%" stopColor={accentSoft} stopOpacity="1" />
            <stop offset="100%" stopColor={accent} stopOpacity="1" />
          </radialGradient>
          <linearGradient id="needleGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.7" />
            <stop offset="100%" stopColor={accent} stopOpacity="1" />
          </linearGradient>
          <radialGradient id="highlight" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
          <filter id="needleShadow" x="0" y="0" width="300" height="300">
            <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor={accentSoft} />
          </filter>
        </defs>
      </svg>
    </div>
  );
}
