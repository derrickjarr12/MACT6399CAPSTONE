"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import useSWR from "swr"
import { loadFeatures } from "@/lib/feature-loader"
import { AudioController } from "@/lib/audio-controller"
import { createRideState } from "@/lib/ride-state"
import { ASSET_PATHS } from "@/lib/feature-types"
import type { AssetManifest } from "@/app/api/assets/route"
import { Scene } from "./scene"
import { StartScreen } from "./start-screen"
import { RideHud } from "./ride-hud"
import { AssetUploader } from "./asset-uploader"

type Phase = "start" | "ride" | "reveal" | "summary"

const fetchManifest = (url: string): Promise<AssetManifest> => fetch(url).then((r) => r.json())

export function Experience() {
  // 1) Discover uploaded Blob assets (audio / features / spectrogram).
  const { data: manifest, mutate: mutateManifest } = useSWR<AssetManifest>("/api/assets", fetchManifest, {
    revalidateOnFocus: false,
  })

  // 2) Once the manifest has resolved, load the feature dataset, preferring the
  //    Blob URL, then the local /public file, then the synthetic fallback.
  const manifestReady = manifest !== undefined
  const featuresUrl = manifest?.features ?? null
  const { data } = useSWR(manifestReady ? ["features", featuresUrl] : null, () => loadFeatures(featuresUrl), {
    revalidateOnFocus: false,
    revalidateIfStale: false,
    keepPreviousData: true,
  })

  const audioSrc = manifest?.audio ?? ASSET_PATHS.audio
  const spectrogramUrl = manifest?.spectrogram ?? ASSET_PATHS.spectrogram

  const [phase, setPhase] = useState<Phase>("start")
  const [showUploader, setShowUploader] = useState(false)

  const controllerRef = useRef<AudioController | null>(null)
  if (!controllerRef.current) controllerRef.current = new AudioController()
  const controller = controllerRef.current

  const sharedRef = useRef(createRideState())
  const shared = sharedRef.current

  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    controller.attach(audioRef.current)
  }, [controller])

  // Input: steering (Left/Right, A/D) and speed (Up/Down, W/S). Steering sign
  // is +1 = move the dot LEFT on screen, -1 = move RIGHT, because the chase
  // camera looks down the course where +X renders on the left.
  useEffect(() => {
    if (phase !== "ride") return
    const STEER_LEFT = 1
    const STEER_RIGHT = -1
    // Track held steering keys so arrows and A/D don't fight each other.
    const held = new Set<string>()

    const applyKeySteer = () => {
      const left = held.has("left")
      const right = held.has("right")
      if (left && !right) shared.steerTarget = STEER_LEFT
      else if (right && !left) shared.steerTarget = STEER_RIGHT
      else shared.steerTarget = 0
    }

    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      switch (k) {
        case "arrowleft":
        case "a":
          held.add("left")
          applyKeySteer()
          break
        case "arrowright":
        case "d":
          held.add("right")
          applyKeySteer()
          break
        case "arrowup":
        case "w":
          e.preventDefault()
          if (!e.repeat) controller.stepRate(1)
          break
        case "arrowdown":
        case "s":
          e.preventDefault()
          if (!e.repeat) controller.stepRate(-1)
          break
        case " ":
          e.preventDefault()
          if (controller.playing) controller.pause()
          else controller.play()
          break
      }
    }
    const up = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      if (k === "arrowleft" || k === "a") held.delete("left")
      if (k === "arrowright" || k === "d") held.delete("right")
      applyKeySteer()
    }

    window.addEventListener("keydown", down)
    window.addEventListener("keyup", up)
    return () => {
      window.removeEventListener("keydown", down)
      window.removeEventListener("keyup", up)
      shared.steerTarget = 0
    }
  }, [controller, shared, phase])

  const start = useCallback(() => {
    setPhase("ride")
    void controller.play()
  }, [controller])

  const replay = useCallback(() => {
    controller.reset()
    shared.reveal = 0
    shared.lateral = 0
    shared.steerTarget = 0
    shared.time = 0
    setPhase("ride")
    void controller.play()
  }, [controller, shared])

  // Return to the start screen so a new track / new assets can be loaded.
  const home = useCallback(() => {
    controller.pause()
    controller.reset()
    shared.reveal = 0
    shared.lateral = 0
    shared.steerTarget = 0
    shared.time = 0
    setPhase("start")
  }, [controller, shared])

  // The ride finished: show the unobstructed reveal first.
  const onEnded = useCallback(() => setPhase("reveal"), [])
  // User dismissed the reveal: bring up the summary screen.
  const finish = useCallback(() => setPhase("summary"), [])

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-background">
      <audio
        ref={audioRef}
        src={audioSrc}
        preload="auto"
        crossOrigin="anonymous"
        onLoadedMetadata={(e) => controller.setReady(e.currentTarget.duration)}
        className="hidden"
        aria-hidden
      />

      {data && (
        <Scene
          dataset={data}
          controller={controller}
          shared={shared}
          spectrogramUrl={spectrogramUrl}
          onEnded={onEnded}
        />
      )}

      {phase !== "start" && (
        <RideHud
          controller={controller}
          shared={shared}
          duration={data?.duration ?? 30}
          phase={phase}
          onReplay={replay}
          onFinish={finish}
          onHome={home}
        />
      )}

      {phase === "start" && (
        <StartScreen
          ready={!!data}
          usingSyntheticData={data ? !data.real : true}
          usingSyntheticAudio={!manifest?.audio}
          onStart={start}
          onManageAssets={() => setShowUploader(true)}
        />
      )}

      {showUploader && (
        <AssetUploader
          manifest={manifest}
          onClose={() => setShowUploader(false)}
          onUploaded={() => void mutateManifest()}
        />
      )}
    </main>
  )
}
