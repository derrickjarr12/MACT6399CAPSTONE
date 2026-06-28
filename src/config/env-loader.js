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

const requiredKeys = [
  'ELEVENLABS_API_KEY',
  'ELEVENLABS_VOICE_ID'
];

const providerKeys = [
  'SUNO_API_KEY',
  'MUREKA_API_KEY'
];

const optionalKeys = [
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

  // Check required keys
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

  // Fail if required keys are missing
  if (missing.length > 0) {
    const errorMsg = `Missing required environment variables:\n  ${missing.join('\n  ')}\n\nCopy .env.example to .env and add your API keys.`;
    throw new Error(errorMsg);
  }

  if (!config.SUNO_API_KEY && !config.MUREKA_API_KEY) {
    const errorMsg = `At least one music provider key is required:\n  SUNO_API_KEY or MUREKA_API_KEY\n\nCopy .env.example to .env and add your API keys.`;
    throw new Error(errorMsg);
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
