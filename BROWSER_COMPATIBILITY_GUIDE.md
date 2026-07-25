# PNF-AIMS Browser Compatibility Testing Guide

## Overview

This guide covers testing PNF-AIMS across major browsers to ensure Web Audio API, localStorage, and UI compatibility.

## Supported Browsers

| Browser | Min Version | Recommended | Status |
|---------|-------------|-------------|--------|
| Chrome | 90+ | 120+ | ✅ Full Support |
| Edge | 90+ | 120+ | ✅ Full Support |
| Firefox | 88+ | 115+ | ✅ Full Support |
| Safari | 14+ | 17+ | ⚠️ Partial Support |
| Opera | 76+ | 105+ | ✅ Full Support |

## Critical Features by Browser

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| Web Audio API | ✅ | ✅ | ✅ | ✅ |
| ConvolverNode | ✅ | ✅ | ⚠️ Limited | ✅ |
| DynamicsCompressor | ✅ | ✅ | ⚠️ Limited | ✅ |
| DelayNode | ✅ | ✅ | ✅ | ✅ |
| BiquadFilter | ✅ | ✅ | ✅ | ✅ |
| Analyser (FFT) | ✅ | ✅ | ✅ | ✅ |
| EventSource (SSE) | ✅ | ✅ | ✅ | ✅ |
| localStorage | ✅ | ✅ | ✅ | ✅ |
| Fetch API | ✅ | ✅ | ✅ | ✅ |
| AbortController | ✅ | ✅ | ✅ | ✅ |
| Crypto.randomUUID | ✅ | ✅ | ✅ | ✅ |
| Vite Build | ✅ | ✅ | ✅ | ✅ |

---

## Testing Checklist

### Chrome / Edge / Opera (Chromium)

**Expected**: Full functionality

- [ ] **UI**: All buttons, dials, tabs responsive
- [ ] **Web Audio**: FX chain (reverb/compression/delay) audible
- [ ] **FFT Analysis**: Visualizer responds to audio in real-time
- [ ] **localStorage**: Sessions save/load correctly
- [ ] **Fetch**: API calls complete, retries work
- [ ] **Performance**: No console errors, <50MB memory usage
- [ ] **Export**: Download notation works

**Known Issues**: None

---

### Firefox

**Expected**: Full functionality

**Testing Steps**:

1. **Visit http://localhost:5175/**
   - [ ] Page loads without errors
   - [ ] No warnings in console

2. **Navigate all tabs**
   - [ ] PERFORMANCE: All dials and buttons responsive
   - [ ] CONTROLS: Settings persist
   - [ ] GENERATE: Generation completes
   - [ ] VISUALIZE: 3D globe renders (may be slower than Chrome)

3. **Test Web Audio FX**
   - [ ] Play audio with reverb enabled
   - [ ] Adjust sliders: Should hear immediate change
   - [ ] Compression/Delay: Audio processing audible

4. **Test Storage**
   - [ ] Save a session
   - [ ] Refresh page
   - [ ] Load session: All settings restored

5. **Test Generation**
   - [ ] Click Generate Audio
   - [ ] If backend available: Should complete
   - [ ] If error: Shows readable error message

6. **Performance Check**
   ```javascript
   // In console:
   window.PERF_TEST_SCENARIOS.quickMemoryCheck()
   window.PERF_TEST_SCENARIOS.fftBenchmark()
   ```
   - [ ] Memory < 60%
   - [ ] FFT performance consistent with Chrome

**Known Firefox Issues**:
- ⚠️ 3D visualizer may render slower (use Firefox Quantum if available)
- ⚠️ Web Workers may use more memory
- ⚠️ Private window blocks localStorage (expected)

**Firefox Fix** (if needed):
```
about:config → dom.workers.enabled = true
about:config → dom.enable_performance_navigation_timing = true
```

---

### Safari (macOS/iOS)

**Expected**: 80-90% functionality (missing some advanced FX)

**Important**: Safari has limited Web Audio support

**Testing Steps**:

1. **Load app at http://localhost:5175/**
   - [ ] Page loads
   - [ ] Navigation works
   - [ ] Dials responsive

2. **Check for console warnings**
   ```
   Look for warnings about:
   - ConvolverNode (may have limited support)
   - DynamicsCompressor parameters
   - AudioWorklet (not supported)
   ```

3. **Test Core Functionality**
   - [ ] Performance dials move
   - [ ] Generate button responds
   - [ ] Save/load sessions works
   - [ ] UI feels responsive

4. **Test Web Audio (Limited)**
   - [ ] Play audio (basic audio playback works)
   - [ ] Adjust volume: Works
   - [ ] Reverb: May not have all parameters
   - [ ] Compression: May not work fully
   - [ ] Delay: Usually works

5. **Performance Check**
   ```javascript
   window.PerformanceProfiler.measureWebAudioLatency()
   window.PerformanceProfiler.measureMemory()
   ```
   - [ ] Memory < 60% (Safari may use more)
   - [ ] Audio latency reported

**Known Safari Limitations** ⚠️:

1. **ConvolverNode**: Limited impulse response support
   - May not support very long reverb tails
   - Workaround: Use shorter impulse response (~1-2s vs 2.4s)

2. **DynamicsCompressor**: Parameter support incomplete
   - knee parameter may not work as expected
   - Workaround: Use standard threshold/ratio/attack/release

3. **BiquadFilter**: All filter types supported ✅

4. **DelayNode**: Fully supported ✅

5. **localStorage**: Works in normal windows
   - Private/Incognito: Not available
   - Limit: Usually 5-50MB per domain

6. **Safari iOS** (iPad/iPhone): Additional limitations
   - AutoPlay restricted (user must interact first)
   - Audio latency higher (~200ms vs 100ms desktop)
   - GPU-accelerated canvas may be slower

**Safari Fallback Code** (already implemented):
```javascript
// App gracefully degrades for Safari
if (isSafari) {
  // Use simpler reverb impulse
  // Disable advanced compression features
  // Show warning message
}
```

**Testing on Real iOS Device**:

1. Open Safari on iPhone/iPad
2. Navigate to your production domain (requires HTTPS)
3. Pin to home screen for app-like experience
4. Test:
   - [ ] Audio generation works
   - [ ] Performance dials responsive
   - [ ] Touch sensitivity acceptable
   - [ ] No audio playback until user interaction

---

### Private/Incognito Mode

**Expected**: Full functionality except localStorage

**Testing Steps** (in any browser):

1. Open app in **Private Window**
2. Try to save session
   - [ ] Should show: **"localStorage not available (private browsing or disabled)"**
   - [ ] App continues to work normally
   - [ ] Audio generation works
   - [ ] Dials responsive

3. Generate audio successfully
   - [ ] No localStorage needed for generation
   - [ ] Settings work in-memory only

4. Refresh page
   - [ ] Settings lost (expected)
   - [ ] App resets to defaults
   - [ ] No errors in console

---

## Cross-Browser Feature Matrix

### Tier 1: Essential (Must work everywhere)
- ✅ UI Navigation
- ✅ Dial interaction
- ✅ Button clicks
- ✅ Fetch API
- ✅ Retry logic

### Tier 2: Important (All Chromium + Firefox)
- ✅ Web Audio playback
- ✅ Basic FX (volume, delay)
- ✅ localStorage sessions
- ✅ FFT analysis
- ✅ EventSource (live updates)

### Tier 3: Enhanced (Chrome/Edge/Firefox only)
- ✅ Advanced FX (ConvolverNode, dynamics)
- ✅ Full CompressorNode features
- ✅ Performance.memory API

### Tier 4: Experimental (Dev only)
- ⚠️ AudioWorklet (not widely supported)
- ⚠️ WebGL compute shaders

---

## Testing Workflow

### Quick Smoke Test (2 minutes)

```javascript
// 1. Open http://localhost:5175/
// 2. Run in console:
await window.PERF_TEST_SCENARIOS.quickMemoryCheck()
window.PerformanceProfiler.measureWebAudioLatency()

// 3. Expected:
// - Memory report shown
// - Audio context ready
// - No errors
```

### Full Browser Test (10 minutes)

1. **UI Responsiveness** (1 min)
   - [ ] Move all dials smoothly
   - [ ] Click all buttons
   - [ ] No lag or stutter
   - [ ] Dropdowns work

2. **Audio Pipeline** (3 min)
   - [ ] Upload or paste audio URL
   - [ ] Play audio: audible output
   - [ ] Adjust FX sliders: Hear changes
   - [ ] Test reverb, compression, delay
   - [ ] Stop/pause: Works

3. **Session Management** (3 min)
   - [ ] Fill performance dials
   - [ ] Enter prompt text
   - [ ] Save session
   - [ ] Load session
   - [ ] Settings match what was saved

4. **Error Handling** (2 min)
   - [ ] Disconnect backend
   - [ ] Try to generate: See error message
   - [ ] Message is readable
   - [ ] Reconnect: Generation works

5. **Performance** (1 min)
   ```javascript
   window.PERF_TEST_SCENARIOS.quickMemoryCheck()
   ```
   - [ ] Memory < 70%
   - [ ] No memory leaks after 5 mins

### Regression Testing (5 minutes per browser)

Compare to previous version:
```javascript
// Before update:
const baselineAudit = await window.PERF_TEST_SCENARIOS.fullAudit()
localStorage.setItem('perf-baseline', JSON.stringify(baselineAudit))

// After update:
const currentAudit = await window.PERF_TEST_SCENARIOS.fullAudit()
const baseline = JSON.parse(localStorage.getItem('perf-baseline'))

// Compare key metrics:
console.log('Memory:', baseline.memory.heapUsedMB, '→', currentAudit.memory.heapUsedMB)
console.log('FFT256:', baseline.fft256.averageTimePerCallMs, '→', currentAudit.fft256.averageTimePerCallMs)
console.log('Bundle:', baseline.dom.resourcesData.javascript.totalKB, '→', currentAudit.dom.resourcesData.javascript.totalKB)
```

---

## Browser-Specific Issues & Fixes

### Issue: "Cannot read property 'numberOfOutputs' of undefined"
**Cause**: Web Audio node not initialized properly
**Browsers**: Safari, Firefox (sometimes)
**Fix**: Already implemented - graceful fallback

### Issue: Audio crackles/distorts
**Cause**: Web Audio parameter updates not smoothed
**Browsers**: All browsers with aggressive parameter changes
**Fix**: Already implemented - 20ms glide ramps

### Issue: FFT analysis is slow
**Cause**: Browser CPU-bound FFT or main thread blocking
**Browsers**: Firefox (sometimes), Safari iOS
**Fix**: Reduce FFT frequency or size:
```javascript
// In config:
FFT_ANALYSIS_INTERVAL = 50 // was 30ms
// or
FFT_SIZE = 256 // keep same, already small
```

### Issue: localStorage quota exceeded
**Cause**: Too many sessions saved
**Browsers**: All browsers
**Fix**: Already implemented - shows error, suggests clearing

### Issue: CORS errors
**Cause**: Backend on different origin
**Browsers**: All browsers
**Fix**: Add CORS headers to backend:
```javascript
app.use(cors({
  origin: 'https://your-frontend-domain.com',
  credentials: true
}));
```

---

## Browser Compatibility Checklist

Before release, test these items on each browser:

### Chrome/Edge/Opera
- [ ] ✅ All features working
- [ ] ✅ No console errors
- [ ] ✅ No performance issues

### Firefox
- [ ] ✅ UI responsive
- [ ] ✅ Web Audio working
- [ ] ✅ Memory < 60%
- [ ] ✅ No console errors
- [ ] ⚠️ Visualizer may be slower (acceptable)

### Safari (macOS)
- [ ] ✅ Core UI working
- [ ] ✅ Generation works
- [ ] ✅ localStorage works
- [ ] ⚠️ Advanced FX may be limited
- [ ] ⚠️ Reverb may not have full effect

### Safari (iOS)
- [ ] ✅ Page loads on mobile
- [ ] ✅ Dials touch-responsive
- [ ] ✅ Can play audio (after user gesture)
- [ ] ⚠️ Latency higher than desktop
- [ ] ⚠️ Visualizer may skip frames

### Private Mode (All browsers)
- [ ] ✅ UI works
- [ ] ✅ Generation works
- [ ] ✅ Proper error for no localStorage
- [ ] ✅ No crash on session save attempt

---

## Reporting Browser Issues

When you find a bug in a specific browser:

```
Title: [Browser] Feature - Description
Browser: [Name Version] (e.g., Safari 17.1)
OS: [e.g., macOS 14.2]
Reproduction Steps:
1. ...
2. ...
3. ...
Expected Result: ...
Actual Result: ...
Console Errors: [paste any errors]
Performance Stats:
- Memory: [MB]
- FFT: [ms]
- Bundle: [KB]
```

---

## Production Deployment Considerations

### Browser Support Statement

**PNF-AIMS is optimized for modern browsers:**

✅ **Fully Supported**:
- Chrome 90+
- Edge 90+
- Firefox 88+
- Opera 76+

⚠️ **Partially Supported**:
- Safari 14+ (limited advanced audio effects)
- Mobile browsers (requires user interaction for audio)

❌ **Not Supported**:
- Internet Explorer 11 or older
- Legacy Android browsers

### Feature Detection

```javascript
// The app automatically detects capabilities:

if (!window.AudioContext && !window.webkitAudioContext) {
  // Show warning: Web Audio not available
}

if (!window.localStorage) {
  // Show warning: Can't save sessions
}

if (!window.fetch || !window.AbortController) {
  // Show warning: No fetch with cancellation
}
```

### Recommended User Message

"For best experience, use Chrome, Firefox, or Edge. Safari users may experience limited audio effects. Mobile users require user interaction to play audio."

---

## Browser Testing Tools

### Automated Testing (Playwright)
```bash
# Test across browsers
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit
```

### Manual Testing Services
- BrowserStack (cloud browsers)
- Lambdatest (cross-browser testing)
- Sauce Labs (automated testing)

### Local Testing
- Docker containers for Firefox
- macOS Safari (native)
- Windows Edge (native)
- Chrome DevTools device emulation

---

## Appendix: Web Audio API Compatibility

| API | Chrome | Firefox | Safari | Edge |
|-----|--------|---------|--------|------|
| AudioContext | ✅ | ✅ | ✅ (webkit) | ✅ |
| MediaElementSource | ✅ | ✅ | ✅ | ✅ |
| ConvolverNode | ✅ | ✅ | ⚠️ | ✅ |
| DynamicsCompressor | ✅ | ✅ | ⚠️ | ✅ |
| DelayNode | ✅ | ✅ | ✅ | ✅ |
| GainNode | ✅ | ✅ | ✅ | ✅ |
| BiquadFilter | ✅ | ✅ | ✅ | ✅ |
| WaveShaper | ✅ | ✅ | ✅ | ✅ |
| Analyser | ✅ | ✅ | ✅ | ✅ |
| AnalyserNode.getByteFrequencyData | ✅ | ✅ | ✅ | ✅ |
| AudioWorklet | ✅ | ✅ | ⚠️ | ✅ |
| OfflineAudioContext | ✅ | ✅ | ✅ | ✅ |

---

## References

- [MDN Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [Can I Use - Web Audio](https://caniuse.com/web-audio)
- [Safari Release Notes](https://developer.apple.com/safari/release-notes/)
- [Firefox Platform Status](https://platform-status.mozilla.org/)
