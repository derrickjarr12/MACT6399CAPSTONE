import { existsSync } from "fs"
import { join } from "path"
import { NextResponse } from "next/server"

export type AssetKind = "audio" | "features" | "spectrogram"
export type AssetManifest = Record<AssetKind, string | null>

const ASSET_MAP: Record<AssetKind, { fsPath: string; url: string }> = {
  audio: { fsPath: join(process.cwd(), "public", "audio", "track.wav"), url: "/audio/track.wav" },
  features: { fsPath: join(process.cwd(), "public", "data", "features.json"), url: "/data/features.json" },
  spectrogram: { fsPath: join(process.cwd(), "public", "textures", "spectrogram.png"), url: "/textures/spectrogram.png" },
}

export async function GET() {
  const manifest: AssetManifest = {
    audio: existsSync(ASSET_MAP.audio.fsPath) ? ASSET_MAP.audio.url : null,
    features: existsSync(ASSET_MAP.features.fsPath) ? ASSET_MAP.features.url : null,
    spectrogram: existsSync(ASSET_MAP.spectrogram.fsPath) ? ASSET_MAP.spectrogram.url : null,
  }
  return NextResponse.json(manifest)
}
