## 1. Install Dependencies

- [x] 1.1 Run `pnpm install` to confirm current state installs cleanly (baseline check)

## 2. Create Public Asset Directories

- [x] 2.1 Create `/public/audio/` directory with a `.gitkeep` file
- [x] 2.2 Create `/public/data/` directory with a `.gitkeep` file
- [x] 2.3 Create `/public/textures/` directory with a `.gitkeep` file
- [x] 2.4 Add entries to `.gitignore` to exclude actual asset files (`/public/audio/*.wav`, `/public/audio/*.mp3`, `/public/data/features.json`, `/public/textures/spectrogram.png`, etc.)

## 3. Rewrite `/api/assets` Route

- [x] 3.1 Remove `@vercel/blob` import from `app/api/assets/route.ts`
- [x] 3.2 Replace `list()` call with `fs.existsSync` checks for `/public/audio/track.wav`, `/public/data/features.json`, and `/public/textures/spectrogram.png`
- [x] 3.3 Return static `/` URLs for files that exist, `null` for those that don't
- [x] 3.4 Remove the `export const dynamic = "force-dynamic"` line (no longer needed for a pure fs check, though harmless to keep)

## 4. Rewrite `/api/blob-upload` Route

- [x] 4.1 Remove `@vercel/blob` import from `app/api/blob-upload/route.ts`
- [x] 4.2 Accept `request.formData()` to extract `kind` and `file` fields
- [x] 4.3 Map `kind` to the canonical output path (`audio` → `public/audio/track.wav`, `features` → `public/data/features.json`, `spectrogram` → `public/textures/spectrogram.png`)
- [x] 4.4 Write the file bytes to disk using `fs.writeFile` (using `Buffer.from(await file.arrayBuffer())`)
- [x] 4.5 Return `{ url: "/audio/track.wav" }` (or appropriate path) on success, `{ error: "..." }` with status 400 on invalid kind

## 5. Update `AssetUploader` Component

- [x] 5.1 Remove `import { upload } from "@vercel/blob/client"` from `components/asset-uploader.tsx`
- [x] 5.2 Replace the `upload()` call in `handleFile` with an `XMLHttpRequest` POST that sends `FormData` with `kind` and `file` fields to `/api/blob-upload`
- [x] 5.3 Wire XHR `progress` event to `set(kind, { progress: percentage })` for the progress bar
- [x] 5.4 Handle XHR `load` event: parse response JSON, call `onUploaded()` on success, set error state on failure
- [x] 5.5 Update the progress hint text in the uploader to remove any Vercel-specific messaging (e.g., "Files stream straight to Blob storage" → "Files are saved locally")

## 6. Remove Vercel Analytics from Layout

- [x] 6.1 Remove `import { Analytics } from '@vercel/analytics/next'` from `app/layout.tsx`
- [x] 6.2 Remove the `{process.env.NODE_ENV === 'production' && <Analytics />}` JSX from the layout body

## 7. Remove Vercel Packages

- [x] 7.1 Remove `@vercel/blob` from `dependencies` in `package.json`
- [x] 7.2 Remove `@vercel/analytics` from `dependencies` in `package.json`
- [x] 7.3 Run `pnpm install` to update the lockfile

## 8. Smoke Test

- [x] 8.1 Run `pnpm dev` and confirm the app loads at `http://localhost:3000` with no console errors
- [x] 8.2 Confirm the start screen shows "using synthetic data" indicators (no real assets yet)
- [x] 8.3 Place a test audio file at `public/audio/track.wav`, reload, and confirm the start screen reflects real audio
- [x] 8.4 Use the Upload Assets UI to upload a file and confirm it saves to disk and the experience reloads with it
- [x] 8.5 Confirm `pnpm build` completes without errors
