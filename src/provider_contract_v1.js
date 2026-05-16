// provider_contract_v1.js
// Unified provider contract for Suno, Mureka, ElevenLabs integrations.

const OPERATIONS = Object.freeze({
  MELODY_GENERATION: "melody_generation",
  VOICE_SYNTH: "voice_synth",
  LYRICS_TO_AUDIO: "lyrics_to_audio",
  TEXT_TO_AUDIO: "text_to_audio"
});

const JOB_STATUS = Object.freeze({
  QUEUED: "queued",
  PROCESSING: "processing",
  SUCCEEDED: "succeeded",
  FAILED: "failed"
});

const ARTIFACT_KIND = Object.freeze({
  AUDIO: "audio",
  STEMS: "stems",
  MIDI: "midi",
  LYRICS: "lyrics",
  ALIGNMENT: "alignment",
  JSON: "json"
});

const REQUEST_SCHEMA_V1 = Object.freeze({
  $id: "pnf-aims/provider-request-v1",
  type: "object",
  required: ["provider", "operation", "input"],
  properties: {
    requestId: { type: "string" },
    provider: { type: "string", minLength: 1 },
    operation: {
      type: "string",
      enum: Object.values(OPERATIONS)
    },
    callbackUrl: { type: "string" },
    input: {
      type: "object",
      properties: {
        text: { type: "string" },
        lyrics: { type: "string" },
        stylePrompt: { type: "string" },
        language: { type: "string" },
        voice: {
          type: "object",
          properties: {
            voiceId: { type: "string" },
            modelId: { type: "string" },
            speakingStyle: { type: "string" },
            stability: { type: "number" },
            similarityBoost: { type: "number" }
          }
        },
        melody: {
          type: "object",
          properties: {
            tempoBpm: { type: "integer" },
            key: { type: "string" },
            scale: { type: "string" },
            timeSignature: { type: "string" },
            seed: { type: "integer" },
            referenceAudioUrl: { type: "string" }
          }
        },
        audio: {
          type: "object",
          properties: {
            format: { type: "string", enum: ["wav", "mp3", "flac", "ogg"] },
            sampleRate: { type: "integer" },
            channels: { type: "integer" },
            targetDurationSec: { type: "number" }
          }
        },
        arlns: {
          type: "object",
          properties: {
            sourceText: { type: "string" },
            parsedDocument: { type: "object" }
          }
        },
        options: {
          type: "object",
          properties: {
            instrumental: { type: "boolean" },
            seed: { type: "integer" },
            stream: { type: "boolean" },
            responseMode: { type: "string", enum: ["sync", "async"] },
            safetyMode: { type: "string", enum: ["strict", "balanced", "off"] }
          }
        }
      }
    },
    metadata: { type: "object" }
  }
});

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validateRequest(request) {
  const errors = [];

  if (!isObject(request)) {
    return { ok: false, errors: ["request must be an object"] };
  }

  if (!request.provider || typeof request.provider !== "string") {
    errors.push("provider is required and must be a string");
  }

  if (!Object.values(OPERATIONS).includes(request.operation)) {
    errors.push(`operation must be one of: ${Object.values(OPERATIONS).join(", ")}`);
  }

  if (!isObject(request.input)) {
    errors.push("input is required and must be an object");
  }

  const input = request.input || {};

  if (request.operation === OPERATIONS.MELODY_GENERATION) {
    if (!input.stylePrompt && !input.text && !input.lyrics) {
      errors.push("melody_generation requires one of input.stylePrompt, input.text, or input.lyrics");
    }
  }

  if (request.operation === OPERATIONS.VOICE_SYNTH) {
    if (!input.text && !input.lyrics) {
      errors.push("voice_synth requires input.text or input.lyrics");
    }
    if (!isObject(input.voice) || !input.voice.voiceId) {
      errors.push("voice_synth requires input.voice.voiceId");
    }
  }

  if (request.operation === OPERATIONS.LYRICS_TO_AUDIO) {
    if (!input.lyrics || typeof input.lyrics !== "string") {
      errors.push("lyrics_to_audio requires input.lyrics");
    }
  }

  if (request.operation === OPERATIONS.TEXT_TO_AUDIO) {
    if (!input.text || typeof input.text !== "string") {
      errors.push("text_to_audio requires input.text");
    }
  }

  if (isObject(input.audio)) {
    if (input.audio.sampleRate !== undefined && (!Number.isInteger(input.audio.sampleRate) || input.audio.sampleRate <= 0)) {
      errors.push("input.audio.sampleRate must be a positive integer");
    }
    if (input.audio.channels !== undefined && ![1, 2].includes(input.audio.channels)) {
      errors.push("input.audio.channels must be 1 or 2");
    }
  }

  return {
    ok: errors.length === 0,
    errors
  };
}

function normalizeProviderResult(provider, operation, rawResult) {
  const status = rawResult?.status || JOB_STATUS.SUCCEEDED;

  const artifacts = Array.isArray(rawResult?.artifacts)
    ? rawResult.artifacts.map(artifact => ({
      kind: artifact.kind || ARTIFACT_KIND.AUDIO,
      url: artifact.url,
      mimeType: artifact.mimeType,
      durationSec: artifact.durationSec,
      sampleRate: artifact.sampleRate,
      channels: artifact.channels,
      sha256: artifact.sha256
    }))
    : [];

  return {
    provider,
    operation,
    status,
    jobId: rawResult?.jobId || null,
    artifacts,
    usage: {
      inputChars: rawResult?.usage?.inputChars ?? null,
      audioSeconds: rawResult?.usage?.audioSeconds ?? null,
      costUsd: rawResult?.usage?.costUsd ?? null
    },
    error: rawResult?.error
      ? {
        code: rawResult.error.code || "PROVIDER_ERROR",
        message: rawResult.error.message || "Provider request failed",
        retryable: Boolean(rawResult.error.retryable),
        providerCode: rawResult.error.providerCode || null
      }
      : null,
    rawProviderResponse: rawResult
  };
}

/*
Adapter contract:

class ProviderAdapter {
  async createJob(request) {}
  async getJob(jobId) {}
  async cancelJob(jobId) {}
}

Each adapter should:
1) validate request with validateRequest()
2) map normalized request -> provider API payload
3) map provider response -> normalizeProviderResult()
*/

module.exports = {
  OPERATIONS,
  JOB_STATUS,
  ARTIFACT_KIND,
  REQUEST_SCHEMA_V1,
  validateRequest,
  normalizeProviderResult
};
