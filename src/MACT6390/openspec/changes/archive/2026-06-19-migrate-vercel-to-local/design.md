## Context

The app was built in v0.dev targeting Vercel's hosting platform. Three Vercel services are in use:

1. **Vercel Blob** — cloud object storage for the three user-supplied assets (audio WAV, features JSON, spectrogram PNG). Used in two routes and the uploader component.
2. **Vercel Analytics** — page-view tracking injected in `layout.tsx`, gated to `NODE_ENV === 'production'`.

The app already has graceful local fallbacks baked in: `lib/feature-loader.ts` tries blob URLs first, then `/public/data/features.json`, then a synthetic dataset. The same pattern applies to audio (`/public/audio/track.wav`) and spectrogram (`/public/textures/spectrogram.png`). This means the 3D experience already works locally — only the asset upload UI is broken.

```
CURRENT ASSET FLOW (Vercel)
────────────────────────────────────────────────────────
Browser
  └─ AssetUploader
       └─ @vercel/blob/client upload()
            └─ /api/blob-upload  (Vercel Blob token handler)
                  └─ Vercel Blob cloud storage  ←── paid service

  └─ Experience (SWR)
       └─ /api/assets  (list from Vercel Blob)
            └─ Blob URLs returned to client

TARGET ASSET FLOW (local)
────────────────────────────────────────────────────────
Browser
  └─ AssetUploader
       └─ fetch() + FormData POST
            └─ /api/blob-upload  (fs.writeFile to /public)
                  └─ /public/{audio,data,textures}/  ←── local disk

  └─ Experience (SWR)
       └─ /api/assets  (stat /public files)
            └─ Static /public URLs returned to client
```

## Goals / Non-Goals

**Goals:**
- App runs with `pnpm install && pnpm dev` — no Vercel account, no env vars
- Asset upload UI continues to work (drop a WAV, JSON, or PNG and the experience reloads)
- All existing game logic, 3D rendering, audio sync, and keyboard controls are untouched
- Easy to maintain: no new frameworks, no added abstraction layers

**Non-Goals:**
- Multi-user or networked asset sharing
- Persistence across server restarts for uploaded files (files written to `/public` survive restarts naturally — this is not an issue)
- Keeping `@vercel/analytics` in any form
- Supporting deployment back to Vercel (the Vercel routes will still work on Vercel if the env var is present, but that is not a goal)

## Decisions

### 1. Replace Vercel Blob listing with filesystem stat calls

**Decision:** `/api/assets/route.ts` uses `fs.existsSync` / `fs.readdirSync` (Node.js `fs`) to check whether the three canonical files exist under `public/`.

**Rationale:** The asset paths are already fixed constants in `lib/feature-types.ts` (`ASSET_PATHS`). There's no need for a dynamic listing — just check if those exact files exist and return their static `/` URLs if they do.

**Alternative considered:** Keep a JSON manifest file in `/public` that the uploader writes to. Rejected — unnecessary indirection when three hardcoded paths suffice.

### 2. Replace Vercel Blob upload handler with `fs.writeFile`

**Decision:** `/api/blob-upload/route.ts` accepts a standard multipart `FormData` POST (using Next.js `request.formData()`), writes the file to the appropriate `/public` subdirectory, and returns the static URL.

**File naming:** Use the same fixed names (`track.wav`, `features.json`, `spectrogram.png`) rather than timestamp-suffixed names. This keeps the asset manifest simple and makes the files replaceable by direct copy.

**Rationale:** The original timestamp-suffixed naming existed to support multiple versions in Blob storage. Locally, we just overwrite.

### 3. Replace `@vercel/blob/client` in AssetUploader with native fetch

**Decision:** `AssetUploader` builds a `FormData` with a `kind` field and the `File`, then POSTs to `/api/blob-upload`. Progress reporting uses `XMLHttpRequest` `progress` event (since `fetch` doesn't expose upload progress natively in all browsers).

**Alternative considered:** Use a library like `axios` for progress. Rejected — XHR upload progress is native and avoids a new dependency.

### 4. Remove `@vercel/analytics` entirely

**Decision:** Delete the import and `<Analytics />` from `layout.tsx`. Remove the package from `package.json`.

**Rationale:** It only fires in production (`NODE_ENV === 'production'`), so it never ran locally anyway. No local equivalent is needed — this is a student project.

### 5. Canonical public directory structure

```
public/
  audio/
    track.wav          ← user drops their WAV here
  data/
    features.json      ← user drops their feature JSON here
  textures/
    spectrogram.png    ← user drops their spectrogram PNG here
```

Each directory gets a `.gitkeep` so the structure is committed but the large binary assets are not (`.gitignore` already excludes them via patterns or users can add them).

## Risks / Trade-offs

- **No upload progress on older browsers** → XHR progress event is supported in all modern browsers; not a concern for a student project
- **File size**: Large WAV files (50–200 MB) written via `fs.writeFile` buffer entirely in memory. → For a local dev server with one user, this is acceptable. Next.js serverless would time out on Vercel for large files, but we're not targeting Vercel.
- **No cleanup of old uploads** → Files are overwritten in place, so there's no accumulation. Not a risk.
- **Next.js config `bodyParser` limit** → Next.js App Router does not apply the old Pages Router body size limit to route handlers, so large file uploads work by default.

## Migration Plan

1. Create the `/public/audio/`, `/public/data/`, `/public/textures/` directories
2. Rewrite the two API routes
3. Update `AssetUploader` to use native fetch/XHR
4. Strip `@vercel/analytics` from `layout.tsx`
5. Run `pnpm install` to remove orphaned Vercel packages
6. Smoke-test: `pnpm dev`, open browser, verify app loads with synthetic data, upload a test file, verify it loads

**Rollback:** All changes are local file edits. `git checkout` (once initialized) or simply reverting the four changed files restores Vercel behavior.

## Open Questions

- Should the `.gitignore` explicitly exclude `public/audio/`, `public/data/`, `public/textures/` to avoid accidentally committing large binary assets? → Recommended yes; add entries in the tasks.
