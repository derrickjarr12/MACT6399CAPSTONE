# Provider Contract v1

This contract standardizes provider integrations for:

- melody generation
- voice synthesis
- lyrics to audio
- text to audio

Use this contract for all providers (Suno, Mureka, ElevenLabs) so the app can route and fallback without changing parser or UI code.

## Canonical Operations

- `melody_generation`
- `voice_synth`
- `lyrics_to_audio`
- `text_to_audio`

## Request Shape

```json
{
  "requestId": "req_123",
  "provider": "elevenlabs",
  "operation": "voice_synth",
  "callbackUrl": "https://example.com/provider/callback",
  "input": {
    "text": "Hello world",
    "lyrics": "optional lyric content",
    "stylePrompt": "warm cinematic pop",
    "language": "en",
    "voice": {
      "voiceId": "voice_abc",
      "modelId": "eleven_multilingual_v2",
      "speakingStyle": "soft",
      "stability": 0.55,
      "similarityBoost": 0.8
    },
    "melody": {
      "tempoBpm": 92,
      "key": "Am",
      "scale": "minor",
      "timeSignature": "4/4",
      "seed": 42,
      "referenceAudioUrl": "https://..."
    },
    "audio": {
      "format": "wav",
      "sampleRate": 44100,
      "channels": 2,
      "targetDurationSec": 30
    },
    "arlns": {
      "sourceText": "[VERSE]: BPM:90 ...",
      "parsedDocument": {
        "type": "DOCUMENT"
      }
    },
    "options": {
      "instrumental": false,
      "seed": 42,
      "stream": false,
      "responseMode": "async",
      "safetyMode": "balanced"
    }
  },
  "metadata": {
    "projectId": "pnf-aims"
  }
}
```

## Minimal Required Fields

- Always required: `provider`, `operation`, `input`
- `melody_generation`: one of `input.stylePrompt`, `input.text`, or `input.lyrics`
- `voice_synth`: `input.voice.voiceId` and one of `input.text` or `input.lyrics`
- `lyrics_to_audio`: `input.lyrics`
- `text_to_audio`: `input.text`

## Normalized Result Shape

```json
{
  "provider": "suno",
  "operation": "lyrics_to_audio",
  "status": "processing",
  "jobId": "job_456",
  "artifacts": [
    {
      "kind": "audio",
      "url": "https://...",
      "mimeType": "audio/wav",
      "durationSec": 29.3,
      "sampleRate": 44100,
      "channels": 2,
      "sha256": "..."
    }
  ],
  "usage": {
    "inputChars": 320,
    "audioSeconds": 29.3,
    "costUsd": 0.14
  },
  "error": null,
  "rawProviderResponse": {}
}
```

## Adapter Contract

Each provider adapter should implement:

- `createJob(request)`
- `getJob(jobId)`
- `cancelJob(jobId)`

Flow for each adapter:

1. Validate with `validateRequest()`.
2. Map canonical request to provider payload.
3. Call provider API.
4. Convert provider response to normalized shape with `normalizeProviderResult()`.

## Persistence And Restart Requirements

- Each provider request should be assigned a stable internal `requestId` before dispatch.
- Each provider response should preserve the provider-specific `jobId` when the provider is asynchronous.
- The adapter or backend should persist `requestId`, `providerJobId`, `normalizedStatus`, `audioUrl`, and compare context so the request can be recovered after a restart.
- MySQL is the preferred persistence layer for the current implementation; if it is not configured, in-memory fallback is acceptable for local development only.
- Status polling should use the provider `jobId`, while application lookup should use the internal `requestId`.

## Security Requirements

- Keep provider keys server-side only.
- Never expose raw secrets in client logs.
- Store provider-specific API responses in `rawProviderResponse` only after removing sensitive fields.

## Persistence And Restart Requirements

- Each provider request should be assigned a stable internal `requestId` before dispatch.
- Each provider response should preserve the provider-specific `jobId` when the provider is asynchronous.
- The adapter or backend should persist `requestId`, `providerJobId`, `normalizedStatus`, `audioUrl`, and compare context so the request can be recovered after a restart.
- MySQL is the preferred persistence layer for the current implementation; if it is not configured, in-memory fallback is acceptable for local development only.
- Status polling should use the provider `jobId`, while application lookup should use the internal `requestId`.

## Routing Addendum (Hybrid + No-Code Fallback)

Current implementation supports routing modes controlled by environment configuration:

- `direct`: canonical provider adapter flow only
- `hybrid`: canonical provider adapter first, then no-code webhook fallback for retriable failures
- `nocode`: no-code webhook dispatch only

For hybrid mode, fallback should only trigger on retriable conditions:

- network/timeouts
- upstream 5xx
- rate-limits or throttling responses

Non-retriable validation errors should be returned directly to caller.

### Internal Request Identity

`requestId` remains the application-level stable identifier and must be carried through all routes.

- Provider `jobId` is provider-scoped and may be absent for webhook-first async starts.
- Request lookup and state reconciliation should always support `requestId` even when `jobId` is unknown.

### No-Code Completion Callback

When no-code execution is async, completion should be posted to backend callback endpoint:

- `POST /api/no-code/callback`

Expected callback payload fields:

- `requestId` (required)
- `generator` (recommended)
- `statusCode` (recommended)
- `response` or `payload` with normalized provider outcome

Callback authentication should use shared secret token (`NOCODE_CALLBACK_TOKEN`) sent as `x-callback-token` or bearer authorization.
