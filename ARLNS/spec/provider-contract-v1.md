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

## Security Requirements

- Keep provider keys server-side only.
- Never expose raw secrets in client logs.
- Store provider-specific API responses in `rawProviderResponse` only after removing sensitive fields.
