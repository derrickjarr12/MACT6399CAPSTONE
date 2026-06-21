"use client"

import { Button } from "@/components/ui/button"

export function StartScreen({
  ready,
  usingSyntheticData,
  usingSyntheticAudio,
  onStart,
  onManageAssets,
}: {
  ready: boolean
  usingSyntheticData: boolean
  usingSyntheticAudio: boolean
  onStart: () => void
  onManageAssets: () => void
}) {
  return (
    <div className="absolute inset-0 z-20 flex flex-col justify-between bg-background p-6 md:p-10">
      <header className="flex items-center gap-3">
        <span className="h-1 w-10 bg-primary" aria-hidden />
        <p className="font-mono text-xs tracking-[0.25em] text-primary md:text-sm">
          CRCP6390 · MIDTERM PROJECT CONCEPT
        </p>
      </header>

      <div className="max-w-3xl">
        <h1 className="text-balance text-5xl font-light leading-[0.95] tracking-tight text-foreground md:text-8xl">
          Riding the Soundbytes
        </h1>
        <p className="mt-6 font-mono text-sm text-accent md:text-base">
          {"Sound-as-data: the audio IS the dataset."}
        </p>

        <div className="mt-10 flex flex-col items-start gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              size="lg"
              disabled={!ready}
              onClick={onStart}
              className="rounded-none bg-primary px-8 font-mono text-xs tracking-[0.2em] text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {ready ? "ENTER THE COURSE" : "LOADING DATASET…"}
            </Button>
            <button
              onClick={onManageAssets}
              className="font-mono text-xs tracking-[0.2em] text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
            >
              UPLOAD ASSETS
            </button>
          </div>

          <div className="flex flex-col gap-1.5 font-mono text-xs leading-relaxed text-muted-foreground">
            <p>
              {"steer "}
              <Key>{"\u2190"}</Key>
              <Key>{"\u2192"}</Key>
              <Key>A</Key>
              <Key>D</Key>
            </p>
            <p>
              {"speed "}
              <Key>{"\u2191"}</Key>
              <Key>{"\u2193"}</Key>
              <Key>W</Key>
              <Key>S</Key>
            </p>
            <p>
              {"pause "}
              <Key>SPACE</Key>
            </p>
          </div>
        </div>
      </div>

      <footer className="flex flex-col gap-1 font-mono text-[11px] text-muted-foreground md:flex-row md:items-center md:justify-between">
        <span>SMU MACT Group Project · the course is generated entirely from the track</span>
        <span className="text-muted-foreground/70">
          {usingSyntheticData ? "feature dataset: synthetic fallback" : "feature dataset: loaded"}
          {"  ·  "}
          {usingSyntheticAudio ? "audio: silent clock" : "audio: loaded"}
        </span>
      </footer>
    </div>
  )
}

function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="mx-0.5 inline-flex min-w-5 items-center justify-center border border-border px-1.5 py-0.5 text-primary">
      {children}
    </kbd>
  )
}
