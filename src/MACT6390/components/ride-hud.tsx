"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import type { AudioController } from "@/lib/audio-controller"
import type { RideState } from "@/lib/ride-state"

type Phase = "ride" | "reveal" | "summary"

// Deliberately minimal HUD: a thin progress line and a small mono readout.
// Updated via rAF (reading refs) so it never re-renders the React tree per frame.
export function RideHud({
  controller,
  shared,
  duration,
  phase,
  onReplay,
  onFinish,
  onHome,
}: {
  controller: AudioController
  shared: RideState
  duration: number
  phase: Phase
  onReplay: () => void
  onFinish: () => void
  onHome: () => void
}) {
  const barRef = useRef<HTMLDivElement>(null)
  const readoutRef = useRef<HTMLSpanElement>(null)

  // Delay the subtle "finish" prompt so the reveal animation reads first.
  const [promptVisible, setPromptVisible] = useState(false)
  useEffect(() => {
    if (phase !== "reveal") {
      setPromptVisible(false)
      return
    }
    const id = setTimeout(() => setPromptVisible(true), 1400)
    return () => clearTimeout(id)
  }, [phase])

  useEffect(() => {
    let raf = 0
    const fmt = (n: number) => n.toFixed(2).padStart(5, "0")
    const loop = () => {
      const t = Math.min(controller.time, duration)
      if (barRef.current) barRef.current.style.transform = `scaleX(${duration ? t / duration : 0})`
      if (readoutRef.current) {
        readoutRef.current.textContent = `t ${fmt(t)}s / ${duration.toFixed(0)}s   rate ${controller.rate.toFixed(2)}x`
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [controller, duration])

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      {/* top-left context tag */}
      <div className="absolute left-6 top-6 flex items-center gap-2">
        <span className="h-1 w-6 bg-primary" aria-hidden />
        <span className="font-mono text-[10px] tracking-[0.25em] text-primary/80">RIDING THE SOUNDBYTES</span>
      </div>

      {/* bottom readout + progress line */}
      <div className="absolute inset-x-6 bottom-6">
        <span ref={readoutRef} className="font-mono text-[10px] tracking-[0.18em] text-mint/80" />
        <div className="mt-2 h-px w-full bg-border">
          <div ref={barRef} className="h-px w-full origin-left scale-x-0 bg-primary" />
        </div>
      </div>

      {/* reveal: leave the data field unobstructed, show a subtle top-right prompt */}
      {phase === "reveal" && (
        <div
          className={`pointer-events-auto absolute right-6 top-6 max-w-[240px] border border-border bg-background/70 p-4 backdrop-blur-sm transition-all duration-700 ${
            promptVisible ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"
          }`}
        >
          <div className="mb-2 flex items-center gap-2">
            <span className="h-1 w-6 bg-primary" aria-hidden />
            <p className="font-mono text-[10px] tracking-[0.25em] text-primary">FULL-TRACK DATA FIELD</p>
          </div>
          <p className="mb-3 font-mono text-[10px] leading-relaxed tracking-wide text-muted-foreground">
            The whole track, flattened into data.
          </p>
          <button
            onClick={onFinish}
            className="font-mono text-[11px] tracking-[0.2em] text-foreground underline-offset-4 hover:text-primary hover:underline"
          >
            END RIDE →
          </button>
        </div>
      )}

      {/* summary: centered options to replay or return home for new assets */}
      {phase === "summary" && (
        <div className="pointer-events-auto absolute inset-0 flex flex-col items-center justify-center gap-5 bg-background/65 backdrop-blur-[2px]">
          <div className="flex items-center gap-2">
            <span className="h-1 w-6 bg-primary" aria-hidden />
            <p className="font-mono text-[10px] tracking-[0.25em] text-primary">FULL-TRACK DATA FIELD</p>
          </div>
          <h2 className="text-balance text-center text-3xl font-light tracking-tight text-foreground md:text-4xl">
            The whole track, flattened into data.
          </h2>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
            <Button
              onClick={onReplay}
              className="rounded-none bg-primary px-8 font-mono text-xs tracking-[0.2em] text-primary-foreground hover:bg-primary/90"
            >
              RIDE AGAIN
            </Button>
            <Button
              variant="outline"
              onClick={onHome}
              className="rounded-none border-border bg-transparent px-8 font-mono text-xs tracking-[0.2em] text-foreground hover:bg-secondary hover:text-foreground"
            >
              LOAD NEW TRACK
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
