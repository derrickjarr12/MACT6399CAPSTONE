# Riding the Soundbytes

**CRCP6390 — Data Expression · Midterm Project**

An interactive 3D experience where audio IS the dataset. A 30-second track is analyzed into a feature set (energy, bass, mid, high, spectral centroid, onsets) and that data alone generates the terrain you ride through.

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 18 or higher | [nodejs.org](https://nodejs.org) |
| pnpm | 8 or higher | `npm install -g pnpm` |

> **Why pnpm?** The project uses pnpm workspaces and a lockfile (`pnpm-lock.yaml`). Using `npm install` or `yarn` may produce mismatched dependencies.

---

## Getting Started

```bash
# 1. Clone the repo
git clone https://github.com/nnurge/CRCP6390Midterm.git
cd CRCP6390Midterm

# 2. Install dependencies
pnpm install

# 3. Start the dev server
pnpm dev
```

Then open **http://localhost:3000** in a real browser (Chrome recommended).

> Do not use the VSCode built-in browser preview — it blocks audio autoplay.

---

## Adding Your Own Assets (Optional)

The app runs with **synthetic data** out of the box — a deterministic procedural track that demonstrates the full experience without any files. To load a real track, drop your files into the correct folders before starting the dev server:

```
public/
  audio/
    track.wav          ← your audio file (WAV, MP3, etc.)
  data/
    features.json      ← precomputed feature dataset (see format below)
  textures/
    spectrogram.png    ← full-track spectrogram image
```

You can also upload assets from within the app using the **UPLOAD ASSETS** button on the start screen — files are saved directly to the folders above.

### Feature JSON Format

The feature file must be an array of frame objects (one per ~33ms at 30 fps):

```json
[
  {
    "frame": 0,
    "time_s": 0.0,
    "height": 0.42,
    "energy": 0.61,
    "bass": 0.55,
    "mid": 0.38,
    "high": 0.22,
    "centroid": 0.31,
    "onset": 0.0
  },
  ...
]
```

All numeric fields except `frame` and `time_s` are normalized to `[0, 1]`.

---

## Controls

| Key | Action |
|-----|--------|
| `←` / `A` | Steer left |
| `→` / `D` | Steer right |
| `↑` / `W` | Speed up |
| `↓` / `S` | Slow down |
| `Space` | Pause / resume |

---

## Project Structure

```
app/
  page.tsx                  — entry point
  layout.tsx                — root layout
  api/
    assets/route.ts         — returns manifest of available local assets
    blob-upload/route.ts    — handles file uploads to /public

components/
  experience.tsx            — top-level orchestrator (audio, phase, state)
  scene.tsx                 — Three.js canvas + render loop
  course-geometry.tsx       — terrain mesh generated from feature data
  rider.tsx                 — the rider object
  chase-camera.tsx          — follow camera
  asset-uploader.tsx        — upload UI
  start-screen.tsx          — start / intro screen
  ride-hud.tsx              — in-ride HUD overlay
  final-reveal.tsx          — end-of-track spectrogram reveal

lib/
  audio-controller.ts       — wraps HTMLAudioElement; drives the clock
  feature-loader.ts         — loads and normalizes the feature JSON
  feature-types.ts          — TypeScript types + asset path constants
  ride-state.ts             — shared mutable state for the ride
  course-config.ts          — tunable course parameters
  terrain-math.ts           — math utilities for terrain generation

public/
  audio/                    — drop track.wav here (git-ignored)
  data/                     — drop features.json here (git-ignored)
  textures/                 — drop spectrogram.png here (git-ignored)
```

---

## Tech Stack

- [Next.js 16](https://nextjs.org) (App Router)
- [React 19](https://react.dev)
- [React Three Fiber](https://docs.pmnd.rs/react-three-fiber) + [Three.js](https://threejs.org)
- [Tailwind CSS v4](https://tailwindcss.com)
- [TypeScript](https://www.typescriptlang.org)

---

## Available Scripts

```bash
pnpm dev      # start dev server (hot reload)
pnpm build    # production build
pnpm start    # serve production build
pnpm lint     # run ESLint
```
