// env-loader.js
// Secure environment variable loader and validator for provider credentials.
// Fails fast if required keys are missing.

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

let envBootstrapped = false;

function bootstrapEnv() {
  if (envBootstrapped) return;

  const candidates = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(__dirname, '../../.env')
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      dotenv.config({ path: candidate });
      break;
    }
  }

  envBootstrapped = true;
}

const requiredKeys = [];

const providerKeys = [
  'SUNO_API_KEY',
  'MUREKA_API_KEY'
];

const optionalKeys = [
  'ELEVENLABS_API_KEY',
  'ELEVENLABS_VOICE_ID',
  'PREFERRED_PROVIDER',
  'FALLBACK_PROVIDERS',
  'PROVIDER_REQUEST_TIMEOUT',
  'PROVIDER_DEBUG'
];

function loadEnv() {
  bootstrapEnv();

  const config = {};
  const missing = [];
  const missingProviders = [];
  const warnings = [];

  // Check always-required keys
  for (const key of requiredKeys) {
    const value = process.env[key];
    if (!value) {
      missing.push(key);
    } else if (value.includes('your_') || value === '') {
      warnings.push(`${key} appears to be a placeholder, not a real key`);
    } else {
      config[key] = value;
    }
  }

  // Require at least one music generation provider key
  for (const key of providerKeys) {
    const value = process.env[key];
    if (!value) {
      missingProviders.push(key);
    } else if (value.includes('your_') || value === '') {
      warnings.push(`${key} appears to be a placeholder, not a real key`);
    } else {
      config[key] = value;
    }
  }

  // Load optional keys
  for (const key of optionalKeys) {
    const value = process.env[key];
    if (value) {
      config[key] = value;
    }
  }

  // ElevenLabs fields are optional in general, but if key is provided then a voice ID is required.
  const elevenLabsKey = process.env.ELEVENLABS_API_KEY;
  const elevenLabsVoiceId = process.env.ELEVENLABS_VOICE_ID;

  if (elevenLabsKey && (!elevenLabsVoiceId || elevenLabsVoiceId.includes('your_'))) {
    missing.push('ELEVENLABS_VOICE_ID');
  }

  if (elevenLabsKey && elevenLabsKey.includes('your_')) {
    warnings.push('ELEVENLABS_API_KEY appears to be a placeholder, not a real key');
  }

  if (elevenLabsVoiceId && elevenLabsVoiceId.includes('your_')) {
    warnings.push('ELEVENLABS_VOICE_ID appears to be a placeholder, not a real key');
  }

  // Fail if required keys are missing
  if (missing.length > 0) {
    const errorMsg = `Missing required environment variables:\n  ${missing.join('\n  ')}\n\nCopy .env.example to .env and add your API keys.`;
    throw new Error(errorMsg);
  }

  if (!config.SUNO_API_KEY && !config.MUREKA_API_KEY) {
    warnings.push('No music provider key configured. Generation endpoints will return key-missing errors until SUNO_API_KEY or MUREKA_API_KEY is set.');
  }

  // Log warnings if any
  if (warnings.length > 0 && process.env.PROVIDER_DEBUG === 'true') {
    console.warn('⚠️  Environment Variable Warnings:');
    warnings.forEach(w => console.warn(`  - ${w}`));
  }

  return config;
}

function getConfig() {
  return loadEnv();
}

module.exports = {
  loadEnv,
  getConfig,
  requiredKeys,
  providerKeys,
  optionalKeys
};
