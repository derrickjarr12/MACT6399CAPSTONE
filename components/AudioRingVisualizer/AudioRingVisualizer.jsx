import React, { useMemo } from "react";

export default function AudioRingVisualizer({ audioData = {} }) {
  const { drive = 0.3, bass = 0.3, treble = 0.3, distortion = 0.3, intensity = 0.3 } = audioData;

  // Compute ring radii and colors from audio bands
  const rings = useMemo(() => {
    const baseRadius = 60;
    return [
      {
        name: "bass",
        radius: baseRadius + bass * 35,
        strokeWidth: 3 + bass * 4,
        color: `hsl(210, 85%, ${35 + bass * 25}%)`,
        opacity: 0.6 + bass * 0.35
      },
      {
        name: "drive",
        radius: baseRadius + drive * 30,
        strokeWidth: 2.5 + drive * 3.5,
        color: `hsl(35, 90%, ${40 + drive * 30}%)`,
        opacity: 0.5 + drive * 0.4
      },
      {
        name: "treble",
        radius: baseRadius + treble * 25,
        strokeWidth: 2 + treble * 3,
        color: `hsl(50, 95%, ${50 + treble * 25}%)`,
        opacity: 0.45 + treble * 0.45
      },
      {
        name: "distortion",
        radius: baseRadius + distortion * 28,
        strokeWidth: 2.5 + distortion * 3,
        color: `hsl(0, 85%, ${45 + distortion * 20}%)`,
        opacity: 0.5 + distortion * 0.35
      },
      {
        name: "intensity",
        radius: baseRadius + intensity * 40,
        strokeWidth: 3.5 + intensity * 4.5,
        color: `hsl(280, 80%, ${45 + intensity * 25}%)`,
        opacity: 0.55 + intensity * 0.4
      }
    ];
  }, [bass, drive, treble, distortion, intensity]);

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      width: "100%",
      height: "100%",
      backgroundColor: "rgba(0, 10, 20, 0.3)"
    }}>
      <svg
        viewBox="0 0 400 400"
        style={{
          width: "100%",
          maxWidth: "500px",
          height: "auto",
          aspectRatio: "1"
        }}
      >
        {/* Center glow */}
        <circle cx="200" cy="200" r="20" fill="rgba(255, 200, 100, 0.4)" filter="url(#glow)" />

        {/* Rings */}
        {rings.map((ring) => (
          <circle
            key={ring.name}
            cx="200"
            cy="200"
            r={ring.radius}
            fill="none"
            stroke={ring.color}
            strokeWidth={ring.strokeWidth}
            opacity={ring.opacity}
            style={{
              transition: "r 0.08s ease-out, stroke-width 0.08s ease-out, opacity 0.1s ease-out",
              filter: "drop-shadow(0 0 2px rgba(255,255,255,0.2))"
            }}
          />
        ))}

        {/* Glow filter */}
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
      </svg>
    </div>
  );
}
