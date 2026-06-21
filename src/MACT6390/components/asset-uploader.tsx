"use client"

import { useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import type { AssetKind, AssetManifest } from "@/app/api/assets/route"

const ACCEPT: Record<AssetKind, string> = {
  audio: "audio/*,.wav,.mp3,.m4a,.aac,.ogg",
  features: "application/json,.json",
  spectrogram: "image/*,.png,.jpg,.jpeg,.webp",
}

const LABEL: Record<AssetKind, string> = {
  audio: "AUDIO TRACK",
  features: "FEATURE JSON",
  spectrogram: "SPECTROGRAM",
}

const HINT: Record<AssetKind, string> = {
  audio: "the 30s .wav (large files OK)",
  features: "frame/time_s/height/energy/bass/mid/high/centroid/onset",
  spectrogram: "full-track image for the reveal",
}

type RowState = { status: "idle" | "uploading" | "done" | "error"; progress: number; message?: string }

export function AssetUploader({
  manifest,
  onClose,
  onUploaded,
}: {
  manifest: AssetManifest | undefined
  onClose: () => void
  onUploaded: () => void
}) {
  const kinds: AssetKind[] = ["audio", "features", "spectrogram"]
  const [state, setState] = useState<Record<AssetKind, RowState>>({
    audio: { status: "idle", progress: 0 },
    features: { status: "idle", progress: 0 },
    spectrogram: { status: "idle", progress: 0 },
  })

  const set = (kind: AssetKind, patch: Partial<RowState>) =>
    setState((s) => ({ ...s, [kind]: { ...s[kind], ...patch } }))

  function handleFile(kind: AssetKind, file: File) {
    set(kind, { status: "uploading", progress: 0, message: undefined })

    const form = new FormData()
    form.append("kind", kind)
    form.append("file", file)

    const xhr = new XMLHttpRequest()

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) {
        set(kind, { progress: Math.round((e.loaded / e.total) * 100) })
      }
    })

    xhr.addEventListener("load", () => {
      try {
        const json = JSON.parse(xhr.responseText) as { url?: string; error?: string }
        if (xhr.status >= 200 && xhr.status < 300 && json.url) {
          set(kind, { status: "done", progress: 100, message: file.name })
          onUploaded()
        } else {
          set(kind, { status: "error", message: json.error ?? "Upload failed" })
        }
      } catch {
        set(kind, { status: "error", message: "Invalid server response" })
      }
    })

    xhr.addEventListener("error", () => {
      set(kind, { status: "error", message: "Network error" })
    })

    xhr.open("POST", "/api/blob-upload")
    xhr.send(form)
  }

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-background/95 p-6 backdrop-blur-sm">
      <div className="w-full max-w-xl border border-border bg-card p-6 md:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-xs tracking-[0.25em] text-primary">UPLOAD ASSETS</p>
            <p className="mt-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
              Files are saved locally — no size cap on the audio.
            </p>
          </div>
          <button
            onClick={onClose}
            className="font-mono text-xs tracking-[0.2em] text-muted-foreground hover:text-foreground"
            aria-label="Close uploader"
          >
            CLOSE
          </button>
        </div>

        <div className="mt-6 flex flex-col gap-px bg-border">
          {kinds.map((kind) => (
            <UploadRow
              key={kind}
              kind={kind}
              row={state[kind]}
              loaded={!!manifest?.[kind]}
              onFile={(file) => handleFile(kind, file)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function UploadRow({
  kind,
  row,
  loaded,
  onFile,
}: {
  kind: AssetKind
  row: RowState
  loaded: boolean
  onFile: (file: File) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const active = loaded || row.status === "done"

  return (
    <div className="flex items-center gap-4 bg-card p-4">
      <span
        className={`h-2 w-2 shrink-0 ${active ? "bg-primary" : "bg-muted-foreground/40"}`}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <p className="font-mono text-xs tracking-[0.15em] text-foreground">{LABEL[kind]}</p>
        <p className="truncate font-mono text-[11px] text-muted-foreground">
          {row.status === "uploading"
            ? `uploading… ${Math.round(row.progress)}%`
            : row.status === "error"
              ? `error: ${row.message}`
              : row.status === "done"
                ? `uploaded: ${row.message}`
                : loaded
                  ? "already loaded · replace?"
                  : HINT[kind]}
        </p>
        {row.status === "uploading" && (
          <div className="mt-2 h-0.5 w-full bg-border">
            <div className="h-full bg-primary transition-all" style={{ width: `${row.progress}%` }} />
          </div>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT[kind]}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onFile(file)
          e.target.value = ""
        }}
      />
      <Button
        size="sm"
        variant="outline"
        disabled={row.status === "uploading"}
        onClick={() => inputRef.current?.click()}
        className="shrink-0 rounded-none border-border bg-transparent font-mono text-[11px] tracking-[0.15em] text-foreground hover:bg-secondary"
      >
        {row.status === "uploading" ? "…" : "CHOOSE"}
      </Button>
    </div>
  )
}
