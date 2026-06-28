# AudioRingVisualizer

A React component that renders 5 concentric pulsing audio-reactive rings. Each ring responds to different audio frequency bands and parameters.

## Usage

```jsx
import AudioRingVisualizer from './components/AudioRingVisualizer';

export function MyComponent() {
  const [audioData, setAudioData] = useState({
    drive: 0.5,
    bass: 0.3,
    treble: 0.7,
    distortion: 0.2,
    intensity: 0.8
  });

  return (
    <div style={{ width: '400px', height: '400px' }}>
      <AudioRingVisualizer audioData={audioData} />
    </div>
  );
}
```

## Props

### `audioData` (Object, optional)
Audio parameter object with the following properties (all 0-1 range):
- **drive** (number): Orange ring - overall drive intensity
- **bass** (number): Blue ring - low frequency response
- **treble** (number): Yellow ring - high frequency response
- **distortion** (number): Red ring - harmonic distortion
- **intensity** (number): Purple ring - overall signal intensity

Default: `{ drive: 0.3, bass: 0.3, treble: 0.3, distortion: 0.3, intensity: 0.3 }`

## Features

- **5 Frequency Rings**: Bass (blue), Drive (orange), Treble (yellow), Distortion (red), Intensity (purple)
- **Smooth Animations**: 80ms transitions on radius, stroke width, and opacity
- **Center Glow**: Central glow effect with Gaussian blur
- **Responsive SVG**: Scales to container size with 1:1 aspect ratio
- **No External Dependencies**: Uses only React

## Styling

The component renders with:
- Dark semi-transparent background: `rgba(0, 10, 20, 0.3)`
- Glowing drop shadows on each ring
- Smooth CSS transitions for audio reactivity
- SVG-based rendering for crisp graphics

## Examples

### Real-time Audio Visualization
```jsx
import { useState, useEffect } from 'react';
import AudioRingVisualizer from './components/AudioRingVisualizer';

export function AudioVisualizer() {
  const [audioData, setAudioData] = useState({});

  useEffect(() => {
    // Update audio data from your audio processing pipeline
    const interval = setInterval(() => {
      setAudioData({
        drive: Math.random() * 0.8 + 0.2,
        bass: Math.random() * 0.6,
        treble: Math.random() * 0.7,
        distortion: Math.random() * 0.5,
        intensity: Math.random() * 0.9
      });
    }, 50);

    return () => clearInterval(interval);
  }, []);

  return <AudioRingVisualizer audioData={audioData} />;
}
```

### Static Display
```jsx
<AudioRingVisualizer audioData={{
  drive: 0.6,
  bass: 0.4,
  treble: 0.8,
  distortion: 0.2,
  intensity: 0.7
}} />
```

## Container Requirements

For best results, ensure the container has:
- A defined width and height (or 1:1 aspect ratio)
- `display: flex` or similar to center content
- Optional: `position: relative` for z-index stacking
