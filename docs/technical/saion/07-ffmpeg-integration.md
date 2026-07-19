# 07. FFmpeg Integration (Phases 1-2c)

This chapter documents the current FFmpeg implementation in SAION.

## Goals

1. Keep existing generation behavior stable.
2. Add media processing incrementally behind feature flags.
3. Avoid frontend layout changes while backend capabilities mature.

## Implementation Summary

Current implementation lives in:

- ../../../src/media/ffmpeg.js
- ../../../src/index.js

Delivered phases:

1. Phase 1
   - FFmpeg/FFprobe health probing
   - Capabilities reporting
2. Phase 2a
   - Optional ingest preprocessing for source audio data URI to analysis WAV
   - Optional loudness normalization
   - Optional silence trimming
3. Phase 2b
   - Optional post-generation export conversion (mp3/wav/flac)
   - Temporary artifact URL serving
4. Phase 2c
   - Optional waveform image generation
   - Optional spectrogram image generation

## FFmpeg API Endpoints

### 1) Health

- GET /api/media/ffmpeg/health

Purpose:

- Verify FFmpeg/FFprobe availability and feature readiness.

Response characteristics:

- `ok`: ready state
- `enabled`: feature flag state
- binary probe output
- capabilities snapshot (including phase flags)

### 2) Artifact Retrieval

- GET /api/media/ffmpeg/artifacts/:artifactId

Purpose:

- Fetch temporary generated artifacts (audio/image) by artifact ID.

Behavior:

- Returns 404 when ID is unknown.
- Returns 410 when artifact expired.
- Artifacts are TTL-managed in in-memory registry.

### 3) Visualize Audio

- POST /api/media/ffmpeg/visualize

Request body:

```json
{
  "audioUrl": "https://example.com/audio.mp3"
}
```

Purpose:

- Generate waveform and spectrogram PNG artifacts from a source audio URL/data URI.

Response shape (example):

```json
{
  "ok": true,
  "artifacts": {
    "waveform": {
      "artifactId": "...",
      "artifactUrl": "/api/media/ffmpeg/artifacts/...",
      "mimeType": "image/png",
      "sizeBytes": 12345,
      "resolution": "1200x240"
    },
    "spectrogram": {
      "artifactId": "...",
      "artifactUrl": "/api/media/ffmpeg/artifacts/...",
      "mimeType": "image/png",
      "sizeBytes": 45678,
      "resolution": "1280x720"
    }
  },
  "_pnf": {
    "ffmpegVisual": {
      "applied": true,
      "skipped": false,
      "reason": "visual_artifacts_generated"
    }
  }
}
```

## FFmpeg Environment Flags

Documented in:

- ../../../.env.example
- ../../../SETUP_ENV_KEYS.md

### Core

- FFMPEG_ENABLED
- FFMPEG_BIN
- FFPROBE_BIN
- FFMPEG_TIMEOUT_MS
- FFMPEG_MAX_INPUT_MB

### Phase 2a (Ingest)

- FFMPEG_INGEST_PREPROCESS_ENABLED
- FFMPEG_INGEST_NORMALIZE
- FFMPEG_INGEST_TRIM_SILENCE
- FFMPEG_INGEST_SAMPLE_RATE
- FFMPEG_INGEST_CHANNELS

### Phase 2b (Export)

- FFMPEG_EXPORT_POSTPROCESS_ENABLED
- FFMPEG_EXPORT_FORMAT
- FFMPEG_EXPORT_BITRATE

### Phase 2c (Visual)

- FFMPEG_VISUAL_ARTIFACTS_ENABLED
- FFMPEG_VISUAL_WAVEFORM_ENABLED
- FFMPEG_VISUAL_SPECTROGRAM_ENABLED
- FFMPEG_WAVEFORM_SIZE
- FFMPEG_SPECTROGRAM_SIZE

## Operational Notes

1. All FFmpeg features are optional and safe-fallback by design.
2. Provider response audio URL remains primary; postprocessed outputs are additive.
3. No frontend layout changes are required to use current FFmpeg backend phases.
4. Artifacts currently use in-memory index + temp files (process-local lifecycle).

## Suggested Next Steps

1. Add persistent artifact storage (object storage) for multi-instance deployment.
2. Add async job queue for larger media processing workloads.
3. Add request-level trace IDs for FFmpeg processing steps in logs.
