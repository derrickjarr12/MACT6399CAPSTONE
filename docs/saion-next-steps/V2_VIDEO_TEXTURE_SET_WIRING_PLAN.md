# V2 Video Texture Set Wiring Plan

Status: deferred to V2
Owner: GUI/Visualizer
Last updated: 2026-08-03

## Goal
Add support for a video-based texture set in the Orb Module so preset thumbnails can be video previews and selected presets can drive animated globe textures.

## Scope
In scope:
- Video thumbnails in the texture preset rails
- Video textures for globe rendering
- Safe lifecycle handling for media elements and textures
- Backward compatibility with existing image presets

Out of scope for this pass:
- Audio-reactive extraction from thumbnail videos
- Full media management UI (upload manager, library admin)
- Server-side transcoding pipeline

## Target Files
- gui/src/App-new.jsx
- gui/src/HolographicGlobe.jsx
- gui/src/styles-match.css

## Data Model Update
Extend texture presets with media metadata.

Example shape:

```js
{
  id: "preset-id",
  label: "Preset Label",
  mediaType: "image" | "video",
  thumbnailUrl: "...",
  textureUrl: "...",
  normalMapUrl: null,
  videoOptions: {
    muted: true,
    loop: true,
    playsInline: true,
    preload: "metadata"
  }
}
```

## Implementation Plan
1. Update texture preset schema in App-new
- Add mediaType with default fallback to image.
- Allow mixed preset arrays (image and video).

2. Render thumbnail media by mediaType
- image: use img tag (current behavior)
- video: use video tag with autoplay, muted, loop, playsInline
- Add poster fallback when available.

3. Add VideoTexture path in HolographicGlobe
- Keep current TextureLoader path for image presets.
- For video presets:
  - create HTMLVideoElement
  - set muted=true, loop=true, playsInline=true
  - call play() with safe promise handling
  - create THREE.VideoTexture(videoEl)
  - configure min/mag filters + color space to match image path

4. Cleanup lifecycle
- On preset change and unmount:
  - pause video element
  - clear src and call load() where needed
  - dispose VideoTexture
  - revoke object URLs if created dynamically

5. Backward compatibility
- If mediaType is missing, treat as image.
- Preserve current normalMap behavior for image presets.

6. UX polish
- Add tiny "VIDEO" badge on video thumbnails.
- Keep active state visuals identical to image thumbnails.

## Acceptance Criteria
- Selecting a video preset animates globe texture without console errors.
- Switching between image and video presets does not leak media elements.
- Existing image presets still work unchanged.
- Thumbnail rail supports both static and moving thumbnails.
- No regressions in performance mode playback controls.

## Risks
- Browser autoplay restrictions for unmuted videos.
- GPU/memory pressure when rapidly switching video presets.
- Cross-origin issues if video assets are hosted remotely.

## Test Checklist
- Desktop: Chrome, Edge, Safari
- Mobile: iOS Safari, Android Chrome
- Rapid preset switching (20+ switches)
- Tab changes (Performance/Visualize/Generate/Controls)
- Return to an image preset after video preset

## Rollout Note
Ship under a V2 feature flag (recommended):
- enableVideoTexturePresets

This allows fallback to image-only behavior if stability issues appear during final V2 QA.
