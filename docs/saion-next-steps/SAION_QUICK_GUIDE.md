# SAION Quick Guide

Use the section that matches your comfort level:

- **Simple Mode (Non-Technical)**: fast, plain-language steps.
- **Technical Mode (Light Technical)**: practical setup details without deep backend internals.

## Simple Mode (Non-Technical)

### 1. Open SAION

1. Start the SAION app.
2. Open it in your browser at **http://localhost:5174**.

### 2. Make a First Output

1. Adjust the main on-screen controls to set the mood/style.
2. Type or edit your prompt.
3. Click the generate action in the app.
4. Wait for the new output to appear.
5. Play it back and adjust controls for the next version.

### 3. Optional: Update Globe Visual Texture

1. Go to **CONTROLS**.
2. Find **Globe Textures (Digital Ocean)**.
3. Paste a public image URL into **Texture URL**.
4. Confirm you see a success message.

### 4. If Something Fails

1. Refresh the page.
2. Confirm the app is running.
3. Retry with a simpler prompt.
4. If texture fails, check the image link is public.

## Technical Mode (Light Technical)

### 1. Start Local GUI

From project root:

```bash
cd gui
npm install
npm run dev
```

Expected local URL: **http://localhost:5174**

### 2. Runtime Checklist

1. Confirm local environment variables are set in `.env`.
2. Confirm API target/base URL values are valid.
3. Confirm required services are reachable before generation tests.

### 3. Generation Loop

1. Adjust performance controls.
2. Send generation request.
3. Validate output readiness and playback.
4. Iterate parameters and compare versions.

### 4. Texture/CDN Notes (Optional)

1. Texture URL must be publicly readable.
2. CORS must allow your local origin.
3. Use stable filename strategy if you are testing polling-based refresh.

See also:
- `DIGITAL_OCEAN_README.md`
- `DIGITAL_OCEAN_TEXTURE_GUIDE.md`

### 5. Quick Smoke Test

1. App opens on local URL.
2. Controls update UI state.
3. One generation request completes.
4. Playback starts successfully.
5. Optional texture load shows success indicator.
