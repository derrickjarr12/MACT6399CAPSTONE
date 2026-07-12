import { useEffect, useRef, useCallback } from "react";

/**
 * GyroscopicDial
 *
 * Props:
 *   value   {number}  0–100
 *   label   {string}  text beneath the dial
 *   color   {object}  { glow, ring1, ring2, arc, needle } — all CSS color strings
 *                     Defaults to amber/orange futuristic theme.
 *   size    {number}  canvas pixel size (default 220)
 */

const AMBER = {
  glow:   "rgba(255, 160, 40, 0.18)",
  ring1:  "rgba(255, 180, 60, 0.40)",
  ring2:  "rgba(255, 120, 20, 0.30)",
  ring3:  "rgba(255, 200, 80, 0.20)",
  arc:    "rgba(255, 150, 30, 0.85)",
  needle: "rgba(255, 110, 20, 0.95)",
  tick:   "rgba(255, 180, 80, 0.55)",
  tickLit:"rgba(255, 130, 30, 0.90)",
  glass:  "rgba(255, 200, 100, 0.08)",
  label:  "rgba(255, 190, 80, 0.75)",
};

function drawDial(ctx, size, value, color, gyroA, innerA, ringA) {
  const cx = size / 2, cy = size / 2;
  const outerR = size * 0.46;
  const midR   = size * 0.36;
  const innerR = size * 0.25;

  ctx.clearRect(0, 0, size, size);

  // ── outer glow halo ─────────────────────────────────────────────
  const halo = ctx.createRadialGradient(cx, cy, innerR, cx, cy, outerR + size * 0.06);
  halo.addColorStop(0, color.glow);
  halo.addColorStop(1, "rgba(0,0,0,0)");
  ctx.beginPath();
  ctx.arc(cx, cy, outerR + size * 0.06, 0, Math.PI * 2);
  ctx.fillStyle = halo;
  ctx.fill();

  // ── outer glass body ────────────────────────────────────────────
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
  const bodyGrad = ctx.createRadialGradient(cx - outerR * 0.3, cy - outerR * 0.3, outerR * 0.1, cx, cy, outerR);
  bodyGrad.addColorStop(0, "rgba(255,255,255,0.07)");
  bodyGrad.addColorStop(0.6, color.glass);
  bodyGrad.addColorStop(1, "rgba(0,0,0,0.18)");
  ctx.fillStyle = bodyGrad;
  ctx.fill();
  ctx.strokeStyle = color.ring1;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();

  // ── glass specular arc (top-left) ───────────────────────────────
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx - outerR * 0.12, cy - outerR * 0.12, outerR * 0.82, Math.PI * 1.08, Math.PI * 1.72);
  const specGrad = ctx.createLinearGradient(cx - outerR, cy - outerR, cx, cy);
  specGrad.addColorStop(0, "rgba(255,255,255,0.22)");
  specGrad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.strokeStyle = specGrad;
  ctx.lineWidth = size * 0.038;
  ctx.stroke();
  ctx.restore();

  // ── gyro ring 1 — horizontal orbit ──────────────────────────────
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(gyroA);
  ctx.scale(1, 0.22);
  ctx.beginPath();
  ctx.arc(0, 0, outerR - size * 0.02, 0, Math.PI * 2);
  ctx.strokeStyle = color.ring1;
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.restore();

  // ── gyro ring 2 — vertical orbit ────────────────────────────────
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-gyroA * 0.65 + Math.PI / 5);
  ctx.scale(0.20, 1);
  ctx.beginPath();
  ctx.arc(0, 0, midR + size * 0.03, 0, Math.PI * 2);
  ctx.strokeStyle = color.ring2;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();

  // ── gyro ring 3 — dashed fast spin ──────────────────────────────
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(ringA);
  ctx.scale(1, 0.14);
  ctx.beginPath();
  ctx.arc(0, 0, innerR + size * 0.04, 0, Math.PI * 2);
  ctx.strokeStyle = color.ring3;
  ctx.lineWidth = 3;
  ctx.setLineDash([size * 0.06, size * 0.10]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // ── scale ticks (270° sweep, 135°→405°) ─────────────────────────
  const startA = (135 * Math.PI) / 180;
  const sweep  = (270 * Math.PI) / 180;

  for (let i = 0; i <= 100; i++) {
    const a = startA + (i / 100) * sweep;
    const major = i % 10 === 0;
    const mid   = i % 5 === 0;
    const r0 = midR - (major ? size * 0.065 : mid ? size * 0.044 : size * 0.026);
    const r1 = midR - size * 0.008;
    const lit = i <= value;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
    ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    ctx.strokeStyle = lit ? color.tickLit : color.tick;
    ctx.lineWidth = major ? 2 : 1;
    ctx.globalAlpha = major ? 1 : mid ? 0.85 : 0.55;
    ctx.stroke();
    ctx.globalAlpha = 1;

    if (major) {
      const lr = midR - size * 0.105;
      ctx.fillStyle = lit ? color.tickLit : color.label;
      ctx.font = `${Math.round(size * 0.038)}px monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(i, cx + Math.cos(a) * lr, cy + Math.sin(a) * lr);
    }
  }

  // ── progress arc ────────────────────────────────────────────────
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, midR - size * 0.012, startA, startA + (value / 100) * sweep);
  ctx.strokeStyle = color.arc;
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.shadowColor = color.arc;
  ctx.shadowBlur = size * 0.04;
  ctx.stroke();
  ctx.restore();

  // ── inner glass cap ─────────────────────────────────────────────
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
  const capGrad = ctx.createRadialGradient(cx - innerR * 0.4, cy - innerR * 0.4, 2, cx, cy, innerR);
  capGrad.addColorStop(0, "rgba(255,255,255,0.10)");
  capGrad.addColorStop(1, "rgba(0,0,0,0.10)");
  ctx.fillStyle = capGrad;
  ctx.fill();
  ctx.strokeStyle = color.ring2;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();

  // ── needle ───────────────────────────────────────────────────────
  const needleA = startA + (value / 100) * sweep;
  const needleLen = innerR - size * 0.02;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(needleA);
  // glow
  ctx.shadowColor = color.needle;
  ctx.shadowBlur = size * 0.06;
  // body
  ctx.beginPath();
  ctx.moveTo(0, size * 0.016);
  ctx.lineTo(needleLen, 0);
  ctx.lineTo(0, -size * 0.016);
  ctx.fillStyle = color.needle;
  ctx.fill();
  // counterweight
  ctx.beginPath();
  ctx.moveTo(0, size * 0.012);
  ctx.lineTo(-innerR * 0.28, 0);
  ctx.lineTo(0, -size * 0.012);
  ctx.fillStyle = "rgba(255,255,255,0.30)";
  ctx.fill();
  ctx.restore();

  // ── center pivot ─────────────────────────────────────────────────
  ctx.save();
  ctx.shadowColor = color.ring1;
  ctx.shadowBlur = size * 0.04;
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.032, 0, Math.PI * 2);
  ctx.fillStyle = color.ring1;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx - size * 0.008, cy - size * 0.008, size * 0.012, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.fill();
  ctx.restore();
}

export function GyroscopicDial({ value = 50, label = "", color = AMBER, size = 220, onChange, step = 1, fineStep = 0.1 }) {
  const canvasRef = useRef(null);
  const stateRef  = useRef({ gyroA: 0, innerA: 0, ringA: 0, raf: null });
  const activePointerIdRef = useRef(null);

  const angleToDialValueFree = useCallback((angle) => {
    return Math.max(0, Math.min(100, (angle / 360) * 100));
  }, []);

  const snapValue = useCallback((rawValue, event) => {
    const activeStep = event?.shiftKey ? fineStep : step;
    const snapped = Math.round(rawValue / activeStep) * activeStep;
    return Math.max(0, Math.min(100, Number(snapped.toFixed(2))));
  }, [step, fineStep]);

  const updateFromPointer = useCallback((event) => {
    const canvas = event.currentTarget;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    let angle = (Math.atan2(event.clientY - centerY, event.clientX - centerX) * 180) / Math.PI;
    angle = (angle + 450) % 360;
    return snapValue(angleToDialValueFree(angle), event);
  }, [angleToDialValueFree, snapValue]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const s = stateRef.current;
    s.gyroA  += 0.007;
    s.innerA -= 0.015;
    s.ringA  += 0.022;
    drawDial(ctx, size, value, color, s.gyroA, s.innerA, s.ringA);
    s.raf = requestAnimationFrame(draw);
  }, [value, color, size]);

  useEffect(() => {
    const s = stateRef.current;
    s.raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(s.raf);
  }, [draw]);

  const handlePointerDown = (event) => {
    if (!onChange) return;
    const nextValue = updateFromPointer(event);
    if (nextValue !== null) onChange(nextValue);
    activePointerIdRef.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event) => {
    if (!onChange) return;
    if (activePointerIdRef.current !== event.pointerId) return;
    const nextValue = updateFromPointer(event);
    if (nextValue !== null) onChange(nextValue);
  };

  const handlePointerUp = (event) => {
    if (activePointerIdRef.current !== event.pointerId) return;
    activePointerIdRef.current = null;
  };

  const handleKeyDown = (event) => {
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
  };

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "10px",
    }}>
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        style={{ display: "block", cursor: onChange ? "grab" : "default", touchAction: "none" }}
        role={onChange ? "slider" : undefined}
        tabIndex={onChange ? 0 : -1}
        aria-label={label || "Gyroscopic dial"}
        aria-valuemin={onChange ? 0 : undefined}
        aria-valuemax={onChange ? 100 : undefined}
        aria-valuenow={onChange ? Math.round(value) : undefined}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onKeyDown={handleKeyDown}
      />
      <span style={{
        fontFamily: "monospace",
        fontSize: "11px",
        letterSpacing: "0.18em",
        textTransform: "uppercase",
        color: color.label,
      }}>
        {label}
      </span>
    </div>
  );
}

export { AMBER };
export default GyroscopicDial;
