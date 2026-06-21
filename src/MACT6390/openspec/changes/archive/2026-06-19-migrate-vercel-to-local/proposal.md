## Why

This project was scaffolded in v0.dev and relies on Vercel Blob (`@vercel/blob`) for asset storage and `@vercel/analytics` for telemetry — services that require a paid Vercel account. The goal is to remove all Vercel cloud dependencies so the app runs entirely on a local `next dev` server with no external accounts or credentials needed.

## What Changes

- **Remove** Vercel Blob asset listing (`/api/assets`) — replace with a filesystem scan of `/public` for the three known asset files
- **Remove** Vercel Blob client upload handler (`/api/blob-upload`) — replace with a standard multipart `FormData` file upload that writes to `/public`
- **Replace** `@vercel/blob/client` upload call in `AssetUploader` — use native `fetch` + `FormData` POST instead
- **Remove** `@vercel/analytics` from `app/layout.tsx`
- **Remove** `@vercel/blob` and `@vercel/analytics` from `package.json` dependencies
- **Add** `/public/audio/`, `/public/data/`, `/public/textures/` directories with `.gitkeep` so users can drop their own asset files in place

## Capabilities

### New Capabilities

- `local-asset-storage`: Serve and upload audio/features/spectrogram assets from the local `/public` filesystem rather than Vercel Blob

### Modified Capabilities

*(none — no existing spec files to delta)*

## Impact

- **Files changed**: `app/layout.tsx`, `app/api/assets/route.ts`, `app/api/blob-upload/route.ts`, `components/asset-uploader.tsx`, `package.json`
- **New files**: `/public/audio/.gitkeep`, `/public/data/.gitkeep`, `/public/textures/.gitkeep`
- **Dependencies removed**: `@vercel/blob`, `@vercel/analytics`
- **Env vars removed**: No longer need `BLOB_READ_WRITE_TOKEN`
- **Behavior preserved**: Synthetic data fallback, local `/public` file fallback, and all 3D ride experience logic are unchanged
