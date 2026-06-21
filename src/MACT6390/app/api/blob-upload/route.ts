import { writeFile, mkdir } from "fs/promises"
import { join } from "path"
import { type NextRequest, NextResponse } from "next/server"
import type { AssetKind } from "@/app/api/assets/route"

const DEST_MAP: Record<AssetKind, string> = {
  audio: join(process.cwd(), "public", "audio", "track.wav"),
  features: join(process.cwd(), "public", "data", "features.json"),
  spectrogram: join(process.cwd(), "public", "textures", "spectrogram.png"),
}

const URL_MAP: Record<AssetKind, string> = {
  audio: "/audio/track.wav",
  features: "/data/features.json",
  spectrogram: "/textures/spectrogram.png",
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const form = await request.formData()
    const kind = form.get("kind") as string
    const file = form.get("file") as File | null

    if (!kind || !(kind in DEST_MAP)) {
      return NextResponse.json({ error: `Invalid kind: ${kind}` }, { status: 400 })
    }
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    const assetKind = kind as AssetKind
    const destPath = DEST_MAP[assetKind]
    const bytes = Buffer.from(await file.arrayBuffer())

    await mkdir(join(destPath, ".."), { recursive: true })
    await writeFile(destPath, bytes)

    return NextResponse.json({ url: URL_MAP[assetKind] })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
