## ADDED Requirements

### Requirement: Asset manifest served from local filesystem
The `/api/assets` route SHALL return an `AssetManifest` JSON object by checking whether the three canonical public files exist on the local filesystem, returning their static `/` paths when present and `null` when absent.

#### Scenario: All three asset files are present
- **WHEN** `/public/audio/track.wav`, `/public/data/features.json`, and `/public/textures/spectrogram.png` all exist on disk
- **THEN** `/api/assets` returns `{ "audio": "/audio/track.wav", "features": "/data/features.json", "spectrogram": "/textures/spectrogram.png" }`

#### Scenario: No asset files are present
- **WHEN** none of the three canonical files exist under `/public`
- **THEN** `/api/assets` returns `{ "audio": null, "features": null, "spectrogram": null }`

#### Scenario: Only some asset files are present
- **WHEN** only some of the three files exist on disk
- **THEN** `/api/assets` returns the static path for each present file and `null` for each absent file

### Requirement: Asset upload writes to local public directory
The `/api/blob-upload` route SHALL accept a multipart `FormData` POST containing a `kind` field (`"audio"`, `"features"`, or `"spectrogram"`) and a `file` field, write the uploaded bytes to the canonical path under `/public`, and return the static URL of the written file.

#### Scenario: Successful audio upload
- **WHEN** a POST is made to `/api/blob-upload` with `kind=audio` and a valid audio file
- **THEN** the file is written to `/public/audio/track.wav` and the response is `{ "url": "/audio/track.wav" }`

#### Scenario: Successful features JSON upload
- **WHEN** a POST is made to `/api/blob-upload` with `kind=features` and a valid JSON file
- **THEN** the file is written to `/public/data/features.json` and the response is `{ "url": "/data/features.json" }`

#### Scenario: Successful spectrogram upload
- **WHEN** a POST is made to `/api/blob-upload` with `kind=spectrogram` and a valid image file
- **THEN** the file is written to `/public/textures/spectrogram.png` and the response is `{ "url": "/textures/spectrogram.png" }`

#### Scenario: Invalid kind field
- **WHEN** a POST is made with a `kind` value other than `audio`, `features`, or `spectrogram`
- **THEN** the route returns HTTP 400 with an error message

### Requirement: Asset uploader uses native fetch instead of Vercel Blob client
The `AssetUploader` component SHALL upload files using a native `FormData` POST to `/api/blob-upload`, reporting upload progress, without importing any `@vercel/blob` package.

#### Scenario: User selects a file and upload succeeds
- **WHEN** the user selects a file in the uploader UI
- **THEN** the file is POSTed as `FormData` to `/api/blob-upload`, progress is shown during upload, and the status updates to "done" on success

#### Scenario: Upload failure is shown to user
- **WHEN** the server returns an error during upload
- **THEN** the uploader row displays an error status message

### Requirement: Vercel Analytics removed from layout
The root `layout.tsx` SHALL NOT import or render `@vercel/analytics` in any environment.

#### Scenario: App loads locally without analytics errors
- **WHEN** the app is started with `pnpm dev`
- **THEN** no `@vercel/analytics` import errors appear in the console and no analytics requests are made

### Requirement: Public asset directories exist in the repository
The directories `/public/audio/`, `/public/data/`, and `/public/textures/` SHALL exist in the repository so users know where to place their asset files.

#### Scenario: Fresh clone has correct directory structure
- **WHEN** the repository is cloned to a new machine
- **THEN** the three public subdirectories exist and are empty (with only `.gitkeep`)
