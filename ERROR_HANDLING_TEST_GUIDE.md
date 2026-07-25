# PNF-AIMS Error Handling Test Guide

## Overview

This guide walks through testing the production error handling improvements:
- Retry logic with exponential backoff
- Enhanced error messages
- Network failure resilience
- Storage quota handling

## Prerequisites

1. App running at http://localhost:5175/
2. Browser DevTools open (F12 or Cmd+Option+I)
3. Console tab visible

## Test Suite

The error simulator is automatically loaded in development mode and available as:
```javascript
window.ErrorSimulator    // Enables/disables error simulation
window.TEST_SCENARIOS    // Pre-configured test scenarios
```

---

## Test 1: Timeout Handling ✓

**Objective**: Verify that network timeouts are caught and retried automatically

**Steps**:
```javascript
// In browser console:
window.TEST_SCENARIOS.testTimeout()
```

**Expected Behavior**:
1. Console shows: `🧪 Error Simulation Enabled: timeout`
2. Click "Generate Audio" button in GENERATE tab
3. Transport status changes to "GENERATING"
4. After ~100ms, first request fails with AbortError
5. Retry logic triggers automatically (exponential backoff: 1s, 2s, 4s)
6. After 3 failed attempts (total ~7 seconds), generation fails
7. Transport notice shows: **"Request timeout. Network may be slow or backend unreachable."**
8. Status bar shows: `GENERATION FAILED`

**Cleanup**:
```javascript
window.ErrorSimulator.disable()
```

---

## Test 2: Intermittent Failure with Automatic Recovery ✓

**Objective**: Verify that temporary failures are recovered automatically

**Steps**:
```javascript
// In browser console:
window.TEST_SCENARIOS.testIntermittentFailure()
```

**Expected Behavior**:
1. Console shows: `🧪 Error Simulation Enabled: intermittent`
2. Console logs: `📡 Request #1`, `📡 Request #2` (both fail), `📡 Request #3` (succeeds)
3. Click "Generate Audio" button
4. First request fails
5. Waits ~1 second, retries
6. Second request fails
7. Waits ~2 seconds, retries
8. Third request succeeds
9. Transport notice shows: **"Signal received. Audio is ready."** ✅
10. Generated audio appears in "After Audio" section

**Key Observation**: The app recovered from failures without user intervention!

**Cleanup**:
```javascript
window.ErrorSimulator.disable()
```

---

## Test 3: 401 Unauthorized (Invalid API Key) ✗

**Objective**: Verify proper error message when API keys are missing/invalid

**Steps**:
```javascript
// In browser console:
window.TEST_SCENARIOS.testUnauthorized()
```

**Expected Behavior**:
1. Console shows: `🧪 Error Simulation Enabled: 401`
2. Click "Generate Audio" button
3. Request fails immediately with HTTP 401
4. No automatic retry (fail-fast on client errors)
5. Transport notice shows: **"Unauthorized (401). Check API keys in environment config."**
6. Status bar shows: `UNAUTHORIZED (401). CHECK API KEYS IN ENVIRONMENT...`

**Key Detail**: This is a client error (4xx), so retry logic correctly does NOT attempt retry.

**Cleanup**:
```javascript
window.ErrorSimulator.disable()
```

**Production Fix**: 
```bash
# Verify API key in environment:
echo $VITE_ELEVENLABS_API_KEY

# If empty, set it:
export VITE_ELEVENLABS_API_KEY=sk_xxxxx
```

---

## Test 4: 429 Rate Limited ✓

**Objective**: Verify graceful handling of rate limiting

**Steps**:
```javascript
// In browser console:
window.TEST_SCENARIOS.testRateLimited()
```

**Expected Behavior**:
1. Console shows: `🧪 Error Simulation Enabled: 429`
2. Click "Generate Audio" button
3. Request returns HTTP 429
4. Transport notice shows: **"Rate limited (429). Provider service is busy. Wait and retry."**
5. Status bar shows: `RATE LIMITED (429). PROVIDER SERVICE IS BUSY. WAIT A...`

**Key Observation**: Message tells user to wait, not to spam retry button

**Production Mitigation**:
- Implement frontend rate limiting (cool-down timer)
- Show countdown: "Retry in 60 seconds"
- Disable Generate button during cooldown

**Cleanup**:
```javascript
window.ErrorSimulator.disable()
```

---

## Test 5: 500 Server Error ✓

**Objective**: Verify handling of provider service failures

**Steps**:
```javascript
// In browser console:
window.TEST_SCENARIOS.testServerError()
```

**Expected Behavior**:
1. Console shows: `🧪 Error Simulation Enabled: 500`
2. Click "Generate Audio" button
3. Request returns HTTP 500
4. Retry logic attempts 2 retries (may succeed if backend recovers)
5. If all fail, transport notice shows: **"Provider server error (500). Try again in a moment."**

**Key Observation**: This is a server error, so retry logic will attempt recovery

**Production Monitoring**: Set up alerts when 500 errors spike

**Cleanup**:
```javascript
window.ErrorSimulator.disable()
```

---

## Test 6: Slow Response (30s Timeout) ✓

**Objective**: Verify timeout enforcement for slow backends

**Steps**:
```javascript
// In browser console:
window.TEST_SCENARIOS.testSlowResponse()
```

**Expected Behavior**:
1. Console shows: `🧪 Error Simulation Enabled: slow`
2. Click "Generate Audio" button
3. Waits 5 seconds (simulated slow response)
4. Times out after 30s timeout (test won't wait full 30s)
5. Transport notice shows timeout message

**Production Context**: 
- Frontend timeout: 30 seconds for initial generate
- Frontend timeout: 15 seconds for status polling
- If backend is legitimately slow, increase timeouts in `fetchWithRetry()`

**Cleanup**:
```javascript
window.ErrorSimulator.disable()
```

---

## Test 7: Corrupted Response ✓

**Objective**: Verify handling of malformed JSON responses

**Steps**:
```javascript
// In browser console:
window.TEST_SCENARIOS.testCorruptedResponse()
```

**Expected Behavior**:
1. Console shows: `🧪 Error Simulation Enabled: corrupted`
2. Click "Generate Audio" button
3. Request returns valid HTTP 200 but invalid JSON
4. Error handler gracefully catches JSON parse error
5. Transport notice shows generic error message
6. Console shows: `🔴 Generation error: { detailedError: "..." }`

**Key Safety**: The app doesn't crash on invalid responses

**Cleanup**:
```javascript
window.ErrorSimulator.disable()
```

---

## Test 8: localStorage Quota Exceeded ✗

**Objective**: Verify handling when browser storage is full

**Steps**:
```javascript
// Browser console:
// First, fill up storage:
for (let i = 0; i < 100; i++) {
  localStorage.setItem(`test-${i}`, 'x'.repeat(10000));
}

// Then try to save a session in the app
// Click "Save Session" button
```

**Expected Behavior**:
1. Click "Save Session" button
2. Saves normally if space available
3. If storage quota exceeded (rare in modern browsers), shows:
   **"SAVE FAILED: Storage quota exceeded. Delete old sessions."**

**Cleanup**:
```javascript
// Clear test data:
for (let i = 0; i < 100; i++) {
  localStorage.removeItem(`test-${i}`);
}
```

---

## Test 9: Private Browsing Mode ✗

**Objective**: Verify handling when localStorage is unavailable

**Steps**:
1. Open app in **Private/Incognito window**
2. Try to save a session
3. Click "Save Session" button

**Expected Behavior**:
1. Transport notice shows:
   **"SAVE FAILED: localStorage not available (private browsing or disabled)"**
2. Session is NOT saved
3. App remains functional otherwise

**Production Context**:
- Private mode blocks localStorage in some browsers
- Graceful error message explains limitation
- App continues to work in memory (can generate audio, etc.)

---

## Test 10: Backend Connection Failure ✗

**Objective**: Verify handling when backend is unreachable

**Steps**:
```javascript
// Stop backend:
# In terminal where backend runs:
Ctrl+C

// Then try to generate audio in app
```

**Expected Behavior**:
1. Click "Generate Audio" button
2. Retries 3 times with backoff
3. Transport notice shows:
   **"Cannot reach local backend. Ensure backend is running on port 3000."**
4. Status bar shows: `CANNOT REACH LOCAL BACKEND...`

**Recovery**:
```bash
# Restart backend in src directory
npm start
```

**Production Context**: 
- Detect localhost vs production URLs
- Show appropriate error messages
- Suggest recovery steps

---

## Full Test Checklist

Run through all scenarios to verify production readiness:

- [ ] **Test 1**: Timeout handling → Retries 3x, shows timeout message
- [ ] **Test 2**: Intermittent failure → Recovers after 3 attempts
- [ ] **Test 3**: 401 Unauthorized → Fail-fast, shows API key error
- [ ] **Test 4**: 429 Rate limited → Shows "wait and retry" message
- [ ] **Test 5**: 500 Server error → Retries with backoff
- [ ] **Test 6**: Slow response → Timeout after 30s
- [ ] **Test 7**: Corrupted JSON → Graceful error, app doesn't crash
- [ ] **Test 8**: Storage quota → Clear error message
- [ ] **Test 9**: Private browsing → Explains limitation
- [ ] **Test 10**: Backend down → Specific error about port 3000

---

## Monitoring & Debugging

### View All Error Logs
```javascript
// In browser console:
// Errors are logged with 🔴 prefix
// Search console for red circle emoji
```

### Get Retry Statistics
```javascript
// In browser console:
window.ErrorSimulator.getStats()
// Returns: { simulationMode: null, requestsAttempted: 0 }
```

### Disable All Simulations
```javascript
window.ErrorSimulator.disable()
```

---

## Success Criteria ✅

All tests pass when:

1. **Retry logic works**: Failed requests retry with exponential backoff (1s → 2s → 4s)
2. **Error messages are clear**: User knows what went wrong and what to do
3. **No crashes**: Corrupted responses don't break the app
4. **Storage handled**: Quota errors show helpful message
5. **Network resilience**: Intermittent failures recover automatically
6. **Fail-fast on 4xx**: Client errors don't waste retries
7. **Retry on 5xx**: Server errors attempt recovery
8. **Timeouts enforced**: Slow responses timeout correctly
9. **Private browsing**: App gracefully handles no localStorage
10. **Backend detection**: App suggests running backend on port 3000

---

## Production Deployment Considerations

After testing locally, before deploying to production:

1. **Set appropriate timeouts** based on your provider's SLA
2. **Monitor error rates** with Sentry or DataDog
3. **Set up alerts** for spikes in 5xx errors
4. **Implement rate limiting** at proxy (nginx/Caddy) level
5. **Test with real provider API keys** (but with dry-run mode if available)
6. **Monitor localStorage usage** for quota issues
7. **Log all generation failures** for debugging

---

## Appendix: Error Message Map

| Status | Message | Action |
|--------|---------|--------|
| Timeout (AbortError) | "Request timeout. Network may be slow or backend unreachable." | Check network, retry |
| Network Error | "Failed to fetch" | Check backend is running |
| 401 | "Unauthorized (401). Check API keys in environment config." | Verify API key |
| 429 | "Rate limited (429). Provider service is busy. Wait and retry." | Wait 60s, retry |
| 500 | "Provider server error (500). Try again in a moment." | Automatic retry or wait |
| No Audio URL | "Generation completed but no audio returned. Provider may have failed." | Check provider logs |
| Timeout (poll) | "Generation timed out while polling status. Check network and try again." | Retry generation |
| Storage Quota | "Storage quota exceeded. Delete old sessions." | Clear old sessions |
| No localStorage | "localStorage not available (private browsing or disabled)" | Use non-private window |
| No Backend | "Cannot reach local backend. Ensure backend is running on port 3000." | Start backend |

